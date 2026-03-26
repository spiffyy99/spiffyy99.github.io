/* Vibe Travel Itinerary (frontend-only).
   - Uses Open-Meteo geocoding to get lat/lon + country
   - Uses IATAGeo to map lat/lon -> nearest airport (IATA)
   - Optimizes city order + start date by minimizing PTO and/or heuristic travel time
   - Optionally uses AeroDataBox `distance-time` for flight-duration display (cached, best-effort) */

(function () {
  const $ = (id) => document.getElementById(id);

  const STORAGE_KEYS = {
    geo: "travel:geoCache:v1",
    airport: "travel:airportCache:v1",
    flight: "travel:flightCache:v1",
  };

  // "Average" cruising speed heuristic (km/h), for travel-day/PTO modeling only.
  // This avoids making flight-duration API calls for every candidate permutation.
  const AVG_SPEED_KMH = 800;

  // Travel-block model thresholds (based on estimated flight duration hours).
  // These are the upper bounds for multi-day travel:
  // - Flights 8-14 hours: 2 calendar travel days
  // - Flights 14+ hours: 3 calendar travel days
  const TRAVEL_THRESHOLDS_H = {
    medium: 14,   // <= medium => up to 2 calendar travel days
  };

  // Travel block model with configurable threshold
  // - travelDayThresholdH: user-set threshold (in hours) for what requires a travel day
  // - redeyeOK: if true, flights under threshold can be overnight without using a travel day
  // - durationHours: estimated flight duration
  //
  // Returns:
  // - travelDays: number of calendar days consumed by travel (0 = no dedicated travel day)
  // - ptoOffsets: which travel day indices require PTO (if weekday and not holiday)
  // - noTravelDay: true if flight doesn't need a dedicated travel day
  function travelBlockModel(durationHours, redeyeOK, travelDayThresholdH = 3) {
    // If flight is under user's threshold AND user is OK with red-eyes,
    // no dedicated travel day needed - fly overnight (red-eye)
    if (durationHours < travelDayThresholdH && redeyeOK) {
      return { travelDays: 0, ptoOffsets: [], noTravelDay: true, isRedeye: true };
    }
    
    // If flight is under threshold but user doesn't want red-eyes,
    // still no travel day - work day then catch evening flight
    if (durationHours < travelDayThresholdH) {
      return { travelDays: 0, ptoOffsets: [], noTravelDay: true, isRedeye: false };
    }
    
    // Flight is at or above threshold - needs dedicated travel day(s)
    // Short-medium flights (threshold to 8h): 1 travel day
    if (durationHours <= 8) {
      // If redeyeOK, can take overnight and arrive refreshed - no PTO needed
      // If not redeyeOK, the travel day itself may need PTO
      const ptoOffsets = redeyeOK ? [] : [0];
      return { travelDays: 1, ptoOffsets, noTravelDay: false, isRedeye: false };
    }

    // Long flights (8-14h): 2 travel days
    if (durationHours <= TRAVEL_THRESHOLDS_H.medium) {
      // redeyeOK => overnight flight means arrival day is rest, no PTO on departure
      const ptoOffsets = redeyeOK ? [1] : [0, 1];
      return { travelDays: 2, ptoOffsets, noTravelDay: false, isRedeye: false };
    }

    // Very long flights (14h+): 3 travel days
    const ptoOffsets = redeyeOK ? [1, 2] : [0, 1, 2];
    return { travelDays: 3, ptoOffsets, noTravelDay: false, isRedeye: false };
  }

  function getDurationHoursFromDistanceKm(distanceKm, isWestward = false) {
    // Add a small factor for taxiing, climb/descent, routing inefficiencies.
    // Westward flights are typically longer due to headwinds (jet stream).
    const windFactor = isWestward ? 1.15 : 1.0; // 15% longer for westward
    const duration = (distanceKm / AVG_SPEED_KMH) * 1.12 * windFactor + 0.25;
    return Math.max(0.5, duration);
  }
  
  function isWestwardFlight(fromLon, toLon) {
    // Determine if flight is generally westward (going against jet stream)
    // Handle wrap-around at international date line
    let diff = toLon - fromLon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff < 0;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius km
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function isoDate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseISODate(iso) {
    // Treat as local date (no timezone shifting surprises).
    const [y, m, d] = iso.split("-").map((x) => Number(x));
    return new Date(y, m - 1, d);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function isWeekday(date) {
    const day = date.getDay(); // 0=Sun..6=Sat
    return day >= 1 && day <= 5;
  }

  // ---- Holiday engine (US federal defaults + user custom PTO-off dates) ----

  // Holiday definitions are keyed by "type" so we can compute per year.
  // Fixed-date holidays apply observed-day rules (Sat->Fri, Sun->Mon).
  const DEFAULT_HOLIDAYS = [
    { id: "new_years", name: "New Year's Day", type: "fixed_observed", month: 0, day: 1, tooltip: "Jan 1. Observed Mon if Sun, Fri if Sat." },
    { id: "mlk", name: "Martin Luther King Jr. Day", type: "nth_weekday", month: 0, weekday: 1, nth: 3, tooltip: "3rd Monday in January." },
    { id: "presidents", name: "Presidents Day", type: "nth_weekday", month: 1, weekday: 1, nth: 3, tooltip: "3rd Monday in February." },
    { id: "memorial", name: "Memorial Day", type: "last_weekday", month: 4, weekday: 1, tooltip: "Last Monday in May." },
    { id: "juneteenth", name: "Juneteenth", type: "fixed_observed", month: 5, day: 19, tooltip: "June 19. Observed Mon if Sun, Fri if Sat." },
    { id: "independence", name: "Independence Day", type: "fixed_observed", month: 6, day: 4, tooltip: "July 4. Observed Mon if Sun, Fri if Sat." },
    { id: "labor", name: "Labor Day", type: "nth_weekday", month: 8, weekday: 1, nth: 1, tooltip: "1st Monday in September." },
    { id: "veterans", name: "Veterans Day", type: "fixed_observed", month: 10, day: 11, tooltip: "Nov 11. Observed Mon if Sun, Fri if Sat." },
    { id: "thanksgiving", name: "Thanksgiving", type: "nth_weekday", month: 10, weekday: 4, nth: 4, tooltip: "4th Thursday in November." },
    { id: "christmas", name: "Christmas Day", type: "fixed_observed", month: 11, day: 25, tooltip: "Dec 25. Observed Mon if Sun, Fri if Sat." },
  ];

  function observedDateForFixed(day) {
    // Federal observed rules:
    // - if holiday falls on Saturday => observed Friday
    // - if holiday falls on Sunday => observed Monday
    // - otherwise => observed on the holiday itself
    const d = new Date(day);
    const dow = d.getDay();
    if (dow === 6) d.setDate(d.getDate() - 1);
    if (dow === 0) d.setDate(d.getDate() + 1);
    return d;
  }

  function computeHolidayDateForYear(holiday, year) {
    if (holiday.type === "fixed_observed") {
      const actual = new Date(year, holiday.month, holiday.day);
      return observedDateForFixed(actual);
    }

    if (holiday.type === "nth_weekday") {
      // nth weekday in month: weekday 0..6, where 0=Sun.
      const firstOfMonth = new Date(year, holiday.month, 1);
      const desired = holiday.weekday;
      const delta = (desired - firstOfMonth.getDay() + 7) % 7;
      const dayNum = 1 + delta + (holiday.nth - 1) * 7;
      return new Date(year, holiday.month, dayNum);
    }

    if (holiday.type === "last_weekday") {
      // last weekday in month
      const lastOfMonth = new Date(year, holiday.month + 1, 0); // last day of month
      const desired = holiday.weekday;
      const delta = (lastOfMonth.getDay() - desired + 7) % 7;
      const dayNum = lastOfMonth.getDate() - delta;
      return new Date(year, holiday.month, dayNum);
    }

    throw new Error("Unknown holiday type");
  }

  function buildPtoOffSet({ windowStartISO, windowEndISO, enabledHolidayIds, extraPtoOffDates }) {
    const windowStart = parseISODate(windowStartISO);
    const windowEnd = parseISODate(windowEndISO);

    const startYear = windowStart.getFullYear();
    const endYear = windowEnd.getFullYear();

    const ptoOff = new Set();

    // Default holiday offs.
    for (let y = startYear; y <= endYear; y++) {
      for (const holiday of DEFAULT_HOLIDAYS) {
        if (!enabledHolidayIds.has(holiday.id)) continue;
        const d = computeHolidayDateForYear(holiday, y);
        if (d >= windowStart && d <= windowEnd) ptoOff.add(isoDate(d));
      }
    }

    // Extra holidays are treated as exact calendar dates.
    for (const iso of extraPtoOffDates) {
      const d = parseISODate(iso);
      if (d >= windowStart && d <= windowEnd) ptoOff.add(iso);
    }

    return ptoOff;
  }
  
  // Build a map of date -> holiday info for display purposes
  function buildHolidayInfoMap({ windowStartISO, windowEndISO, enabledHolidayIds, extraPtoOffDates }) {
    const windowStart = parseISODate(windowStartISO);
    const windowEnd = parseISODate(windowEndISO);
    const startYear = windowStart.getFullYear();
    const endYear = windowEnd.getFullYear();
    
    const holidayMap = new Map();
    
    for (let y = startYear; y <= endYear; y++) {
      for (const holiday of DEFAULT_HOLIDAYS) {
        if (!enabledHolidayIds.has(holiday.id)) continue;
        
        const observedDate = computeHolidayDateForYear(holiday, y);
        if (observedDate >= windowStart && observedDate <= windowEnd) {
          // Check if this is an observed date (different from actual date for fixed holidays)
          let isObserved = false;
          if (holiday.type === "fixed_observed") {
            const actualDate = new Date(y, holiday.month, holiday.day);
            isObserved = isoDate(actualDate) !== isoDate(observedDate);
          }
          
          holidayMap.set(isoDate(observedDate), {
            name: holiday.name,
            observed: isObserved,
          });
        }
      }
    }
    
    // Extra holidays
    for (const iso of extraPtoOffDates) {
      const d = parseISODate(iso);
      if (d >= windowStart && d <= windowEnd && !holidayMap.has(iso)) {
        holidayMap.set(iso, {
          name: "Extra Holiday",
          observed: false,
        });
      }
    }
    
    return holidayMap;
  }

  // ---- Geocoding + nearest airport ----

  async function cachedJson(cacheKey, cacheObj, key, fetchFn) {
    if (cacheObj[key]) return cacheObj[key];
    const value = await fetchFn();
    cacheObj[key] = value;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
    } catch {
      // ignore quota/security errors
    }
    return value;
  }

  function loadCache(storageKey) {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }

  async function geocodeCity(cityName, geoCache) {
    const key = `geo:${cityName.toLowerCase().trim()}`;
    return cachedJson(STORAGE_KEYS.geo, geoCache, key, async () => {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        cityName
      )}&count=1&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
      const data = await res.json();
      const first = data?.results?.[0];
      if (!first) throw new Error("No geocoding results");
      return {
        latitude: first.latitude,
        longitude: first.longitude,
        country: first.country,
        name: first.name,
      };
    });
  }

  async function nearestAirport({ latitude, longitude, rangeMeters, airportCache }) {
    const key = `near:${latitude.toFixed(4)},${longitude.toFixed(4)}:${rangeMeters || 500000}`;
    const cacheObj = airportCache;
    return cachedJson(STORAGE_KEYS.airport, cacheObj, key, async () => {
      const types = "large_airport,medium_airport,small_airport";
      const url = `https://www.iatageo.com/v2/airports/nearest?lat=${encodeURIComponent(
        latitude
      )}&lng=${encodeURIComponent(longitude)}&types=${encodeURIComponent(types)}&range=${encodeURIComponent(
        rangeMeters || 500000
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Nearest airport lookup failed (${res.status})`);
      const data = await res.json();
      const airport = data?.data;
      if (!airport?.iataCode) throw new Error("No airport found");
      return {
        iataCode: airport.iataCode,
        icaoCode: airport.icaoCode,
        name: airport.name,
        latitude: airport.coordinates?.latitude ?? latitude,
        longitude: airport.coordinates?.longitude ?? longitude,
      };
    });
  }

  function isIataToken(token) {
    // Strict MVP: exactly 3 letters.
    return /^[A-Za-z]{3}$/.test(String(token).trim());
  }

  async function resolveInputToLocation({ input, geoCache, airportCache }) {
    const raw = String(input || "").trim();
    if (!raw) throw new Error("Empty location input");

    if (isIataToken(raw)) {
      const code = raw.toUpperCase();
      const key = `iata:${code}`;
      const cachedAirport = await cachedJson(STORAGE_KEYS.airport, airportCache, key, async () => {
        const url = `https://www.iatageo.com/v2/airports/iata/${encodeURIComponent(code)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`IATAGeo IATA lookup failed (${res.status})`);
        const payload = await res.json();
        const data = payload?.data;
        if (!data?.iataCode || !data?.coordinates) throw new Error("No airport found for IATA code");
        const airport = {
          iataCode: data.iataCode,
          icaoCode: data.icaoCode,
          name: data.name,
          latitude: data.coordinates.latitude,
          longitude: data.coordinates.longitude,
        };
        return {
          displayName: data.name || data.iataCode,
          country: "",
          airport,
        };
      });
      return cachedAirport;
    }

    const geo = await geocodeCity(raw, geoCache);
    const airport = await nearestAirport({
      latitude: geo.latitude,
      longitude: geo.longitude,
      rangeMeters: 500000,
      airportCache,
    });

    return {
      displayName: raw,
      country: geo.country || "",
      airport,
    };
  }

  // ---- Flight provider (optional, best-effort) ----

  function flightCacheKey(provider, from, to, model) {
    return `flight:${provider}:${from}:${to}:${model || ""}`;
  }

  function parseDurationHoursFromProviderPayload(payload) {
    // We don't want the app to crash if provider payload changes.
    // Try common shapes.
    const candidates = [];
    const data = payload?.data || payload;

    // Numbers could be in different keys.
    const directMinutes = data?.flightTimeMinutes ?? data?.flightTime?.minutes ?? data?.durationMinutes;
    if (typeof directMinutes === "number") candidates.push(directMinutes);

    const directHours = data?.flightTimeHours ?? data?.flightTime?.hours ?? data?.durationHours;
    if (typeof directHours === "number") candidates.push(directHours * 60);

    // Sometimes duration is a string like "08:30"
    const directStr = data?.flightTime ?? data?.flight_time ?? data?.duration;
    if (typeof directStr === "string") {
      const match = directStr.match(/(\d+)\s*h\s*(\d+)\s*m/i) || directStr.match(/(\d+):(\d+)/);
      if (match) {
        const hh = Number(match[1]);
        const mm = Number(match[2]);
        if (Number.isFinite(hh) && Number.isFinite(mm)) candidates.push(hh * 60 + mm);
      }
    }

    if (!candidates.length) return null;
    return Math.min(...candidates); // pick smallest parse result to be conservative
  }

  async function getFlightDurationMinutesAeroDataBox({ apiKey, fromIata, toIata, model, flightCache }) {
    const key = flightCacheKey("aedb", fromIata, toIata, model);
    if (flightCache[key] != null) return flightCache[key];

    const BASE_URL = "https://prod.api.market/api/v1/aedbx/aerodatabox";
    const modelParam =
      model && model !== "STD" ? `?flightTimeModel=${encodeURIComponent(model)}` : "";
    const url = `${BASE_URL}/airports/iata/${encodeURIComponent(fromIata)}/distance-time/${encodeURIComponent(
      toIata
    )}${modelParam}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-magicapi-key": apiKey,
      },
    });
    if (!res.ok) throw new Error(`AeroDataBox distance-time failed (${res.status})`);
    const payload = await res.json();

    const minutes = parseDurationHoursFromProviderPayload(payload);
    if (minutes == null) throw new Error("Could not parse flight duration from provider payload");

    flightCache[key] = minutes;
    try {
      localStorage.setItem(STORAGE_KEYS.flight, JSON.stringify(flightCache));
    } catch {
      // ignore
    }
    return minutes;
  }

  // ---- Optimization + itinerary simulation ----

  function permute(arr) {
    const results = [];
    function helper(path, used) {
      if (path.length === arr.length) {
        results.push(path.slice());
        return;
      }
      for (let i = 0; i < arr.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        path.push(arr[i]);
        helper(path, used);
        path.pop();
        used[i] = false;
      }
    }
    helper([], Array(arr.length).fill(false));
    return results;
  }

  function estimateLegDistanceKm(airportA, airportB) {
    return haversineKm(airportA.latitude, airportA.longitude, airportB.latitude, airportB.longitude);
  }
  
  function estimateLegDurationHours(airportA, airportB) {
    const distanceKm = estimateLegDistanceKm(airportA, airportB);
    const westward = isWestwardFlight(airportA.longitude, airportB.longitude);
    return getDurationHoursFromDistanceKm(distanceKm, westward);
  }

  function buildLegs(home, orderedCities) {
    // Returns legs in order: home->first, city->city, last->home
    const legs = [];
    if (!orderedCities.length) return legs;
    legs.push({ from: home, to: orderedCities[0], type: "outbound" });
    for (let i = 0; i < orderedCities.length - 1; i++) {
      legs.push({ from: orderedCities[i], to: orderedCities[i + 1], type: "between" });
    }
    legs.push({ from: orderedCities[orderedCities.length - 1], to: home, type: "return" });
    return legs;
  }

  function simulateItinerary({ home, orderedCities, startISO, redeyeOK, ptoOffSet, travelDayThresholdH = 3 }) {
    // Produce day-by-day entries + PTO required + heuristic flight hours.
    const days = [];
    let currentDate = parseISODate(startISO);
    let totalFlightHoursHeuristic = 0;
    let tripDays = 0; // Days actually in destination (excluding travel-only days)

    const legs = buildLegs(home, orderedCities);
    for (let legIdx = 0; legIdx < legs.length; legIdx++) {
      const leg = legs[legIdx];

      const durationHours = estimateLegDurationHours(leg.from.airport, leg.to.airport);
      totalFlightHoursHeuristic += durationHours;

      const model = travelBlockModel(durationHours, redeyeOK, travelDayThresholdH);
      
      // If noTravelDay, we don't add separate travel day entries
      // The flight happens overnight or same-day alongside other activities
      if (model.noTravelDay) {
        // Annotate the last city day already in the schedule with a departure note
        if (days.length > 0) {
          const lastDay = days[days.length - 1];
          const toLabel = leg.type === "return" ? "home" : leg.to.displayName;
          if (model.isRedeye) {
            lastDay.label += ` (red-eye to ${toLabel} ~${formatHours(durationHours)})`;
          } else {
            lastDay.label += ` (evening flight to ${toLabel} ~${formatHours(durationHours)})`;
            if (!lastDay.ptoRequired) {
              lastDay.workPlusFly = true;
            }
          }
        }
      } else {
        // Add travel day entries
        for (let t = 0; t < model.travelDays; t++) {
          const d = addDays(currentDate, t);
          const off = ptoOffSet.has(isoDate(d));
          const ptoRequired = isWeekday(d) && !off && model.ptoOffsets.includes(t);
          days.push({
            dateISO: isoDate(d),
            kind: "travel",
            label:
              leg.type === "outbound"
                ? `Travel: ${leg.from.displayName} -> ${leg.to.displayName}`
                : leg.type === "return"
                  ? `Return: ${leg.from.displayName} -> ${leg.to.displayName}`
                  : `Travel: ${leg.from.displayName} -> ${leg.to.displayName}`,
            ptoRequired,
            flightDurationHours: durationHours,
            fromIata: leg.from.airport?.iataCode,
            toIata: leg.to.airport?.iataCode,
            noTravelDay: false,
          });
        }
        currentDate = addDays(currentDate, model.travelDays);
      }

      // After travel, if the arrival is a city (not home), add stay days.
      if (leg.to !== home) {
        for (let s = 0; s < leg.to.stayDays; s++) {
          const d = addDays(currentDate, s);
          const off = ptoOffSet.has(isoDate(d));
          const ptoRequired = isWeekday(d) && !off;
          
          // First day of city: note if there was a short flight (for display)
          const flightNote = (s === 0 && model.noTravelDay) 
            ? ` (incl. ${formatHours(durationHours)} flight)` 
            : "";
          
          days.push({
            dateISO: isoDate(d),
            kind: "city",
            label: formatCityLabel(leg.to.displayName, leg.to.country) + flightNote,
            ptoRequired,
          });
          tripDays++;
        }
        currentDate = addDays(currentDate, leg.to.stayDays);
      }
    }

    const ptoRequiredTotal = days.reduce((sum, x) => sum + (x.ptoRequired ? 1 : 0), 0);
    const tripStartISO = days[0]?.dateISO;
    const tripEndISO = days[days.length - 1]?.dateISO;

    return {
      days,
      ptoRequired: ptoRequiredTotal,
      totalFlightHoursHeuristic,
      tripStartISO,
      tripEndISO,
      tripDays, // Days in destination cities
      // Store for recomputation if we fetch real flight durations later.
      heuristicTravelByLeg: legs.map((leg) => {
        const durationHours = estimateLegDurationHours(leg.from.airport, leg.to.airport);
        const distanceKm = estimateLegDistanceKm(leg.from.airport, leg.to.airport);
        return { distanceKm, durationHours };
      }),
    };
  }

  function compareItineraries(a, b, objective) {
    // objective: "ptoFirst" | "timeFirst"
    if (!a || !b) return a ? a : b;

    if (objective === "ptoFirst") {
      if (a.ptoRequired !== b.ptoRequired) return a.ptoRequired < b.ptoRequired ? a : b;
      if (a.totalFlightHoursHeuristic !== b.totalFlightHoursHeuristic)
        return a.totalFlightHoursHeuristic < b.totalFlightHoursHeuristic ? a : b;
      // Tie-breaker: earlier trip start
      return a.tripStartISO <= b.tripStartISO ? a : b;
    }

    // timeFirst
    if (a.totalFlightHoursHeuristic !== b.totalFlightHoursHeuristic)
      return a.totalFlightHoursHeuristic < b.totalFlightHoursHeuristic ? a : b;
    if (a.ptoRequired !== b.ptoRequired) return a.ptoRequired < b.ptoRequired ? a : b;
    return a.tripStartISO <= b.tripStartISO ? a : b;
  }

  function generateStartCandidates({ windowStartISO, windowEndISO, totalCalendarDaysNeeded }) {
    const start = parseISODate(windowStartISO);
    const end = parseISODate(windowEndISO);

    const latestStart = addDays(end, -(totalCalendarDaysNeeded - 1));
    const candidates = [];
    let cursor = start;
    while (cursor <= latestStart) {
      candidates.push(isoDate(cursor));
      cursor = addDays(cursor, 1);
    }
    return candidates;
  }

  function capCandidates(candidates, cap) {
    if (candidates.length <= cap) return candidates;
    const step = Math.ceil(candidates.length / cap);
    const capped = [];
    for (let i = 0; i < candidates.length; i += step) {
      capped.push(candidates[i]);
    }
    // Ensure the last candidate is included (helps when objective is sensitive to late dates).
    const last = candidates[candidates.length - 1];
    if (capped[capped.length - 1] !== last) capped.push(last);
    return capped;
  }

  function computeTotalCalendarDaysHeuristic({ home, orderedCities, redeyeOK, travelDayThresholdH = 3 }) {
    // We need a fixed template length for feasibility pruning.
    const legs = buildLegs(home, orderedCities);
    let total = 0;
    for (const leg of legs) {
      const durationHours = estimateLegDurationHours(leg.from.airport, leg.to.airport);
      const model = travelBlockModel(durationHours, redeyeOK, travelDayThresholdH);
      total += model.travelDays;
      if (leg.to !== home) total += leg.to.stayDays;
    }
    return total;
  }

  function heuristicOrder({ home, cities }) {
    // nearest neighbor starting from home, then 2-opt improvement based on heuristic flight hours.
    const remaining = new Set(cities.map((c) => c.id));
    const byId = new Map(cities.map((c) => [c.id, c]));

    let current = home;
    const route = [];
    while (remaining.size) {
      let bestId = null;
      let bestDist = Infinity;
      for (const id of remaining) {
        const c = byId.get(id);
        const distKm = estimateLegDistanceKm(current.airport, c.airport);
        if (distKm < bestDist) {
          bestDist = distKm;
          bestId = id;
        }
      }
      remaining.delete(bestId);
      const next = byId.get(bestId);
      route.push(next);
      current = next;
    }

    // 2-opt swap improvement:
    function routeFlightHours(routeArr, redeyeOK) {
      // flight time heuristic ignores redeye; just sum durations (distance-based) for scoring.
      const legs = buildLegs(home, routeArr);
      let sum = 0;
      for (const leg of legs) {
        sum += estimateLegDurationHours(leg.from.airport, leg.to.airport);
      }
      return sum;
    }

    // Use simple hill-climbing; keep it bounded.
    const maxIterations = 120;
    let improved = true;
    let iter = 0;
    let bestRoute = route.slice();
    let bestScore = routeFlightHours(bestRoute, true);
    while (improved && iter < maxIterations) {
      improved = false;
      iter++;
      for (let i = 0; i < bestRoute.length - 1; i++) {
        for (let j = i + 1; j < bestRoute.length; j++) {
          const newRoute = bestRoute.slice(0, i).concat(bestRoute.slice(i, j + 1).reverse()).concat(bestRoute.slice(j + 1));
          const newScore = routeFlightHours(newRoute, true);
          if (newScore + 1e-6 < bestScore) {
            bestScore = newScore;
            bestRoute = newRoute;
            improved = true;
          }
        }
      }
    }
    return bestRoute;
  }

  function optimizeOrderAndDates({ home, cities, windowStartISO, windowEndISO, redeyeOK, ptoOffSet, objective, travelDayThresholdH = 3 }) {
    const n = cities.length;
    if (n === 0) return null;

    let best = null;
    const capForExact = 8;
    const START_CANDIDATE_CAP = 60;
    if (n <= capForExact) {
      const orders = permute(cities);
      for (const orderedCities of orders) {
        const totalDaysNeeded = computeTotalCalendarDaysHeuristic({ home, orderedCities, redeyeOK, travelDayThresholdH });
        const startCandidates = generateStartCandidates({ windowStartISO, windowEndISO, totalCalendarDaysNeeded: totalDaysNeeded });
        const candidatesCapped = capCandidates(startCandidates, START_CANDIDATE_CAP);
        for (const startISO of candidatesCapped) {
          const sim = simulateItinerary({ home, orderedCities, startISO, redeyeOK, ptoOffSet, travelDayThresholdH });
          best = compareItineraries(best, sim, objective);
        }
      }
    } else {
      // For > 8 cities: heuristic route only. Start date still optimized by PTO.
      const route = heuristicOrder({ home, cities });
      const totalDaysNeeded = computeTotalCalendarDaysHeuristic({ home, orderedCities: route, redeyeOK, travelDayThresholdH });
      const startCandidates = generateStartCandidates({ windowStartISO, windowEndISO, totalCalendarDaysNeeded: totalDaysNeeded });
      const candidatesCapped = capCandidates(startCandidates, START_CANDIDATE_CAP);
      for (const startISO of candidatesCapped) {
        const sim = simulateItinerary({ home, orderedCities: route, startISO, redeyeOK, ptoOffSet, travelDayThresholdH });
        best = compareItineraries(best, sim, objective);
      }
    }

    return best;
  }

  // ---- Rendering ----

  function readDestinationsFromDOM(container) {
    const destRows = Array.from(container.querySelectorAll(".destRow"));
    return destRows.map((row) => {
      const city = row.querySelector("input[data-role='city']").value.trim();
      const stayDaysRaw = row.querySelector("input[data-role='stayDays']").value;
      const stayDays = Number(stayDaysRaw);
      return { city, stayDays: Number.isFinite(stayDays) && stayDays > 0 ? stayDays : null };
    });
  }

  // City/airport autocomplete using Open-Meteo geocoding API
  let autocompleteDebounce = null;
  
  function setupCityAutocomplete(input, container) {
    let listEl = null;
    let selectedIndex = -1;
    let results = [];
    
    function hideList() {
      if (listEl) {
        listEl.remove();
        listEl = null;
      }
      selectedIndex = -1;
      results = [];
    }
    
    function showList(items) {
      hideList();
      if (!items.length) return;
      
      results = items;
      listEl = document.createElement("div");
      listEl.className = "autocomplete-list";
      
      items.forEach((item, i) => {
        const div = document.createElement("div");
        div.className = "autocomplete-item";
        if (i === selectedIndex) div.classList.add("selected");
        
        const nameSpan = document.createElement("div");
        nameSpan.className = "city-name";
        nameSpan.textContent = item.name;
        
        const detailsSpan = document.createElement("div");
        detailsSpan.className = "city-details";
        const parts = [];
        if (item.admin1) parts.push(item.admin1);
        if (item.country) parts.push(item.country);
        if (item.iataCode) parts.push(`(${item.iataCode})`);
        detailsSpan.textContent = parts.join(", ");
        
        div.appendChild(nameSpan);
        div.appendChild(detailsSpan);
        
        div.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectItem(item);
        });
        
        listEl.appendChild(div);
      });
      
      container.appendChild(listEl);
    }
    
    function selectItem(item) {
      let displayValue = item.name;
      if (item.country && item.country !== item.name) {
        displayValue = `${item.name}, ${item.country}`;
      }
      if (item.iataCode) {
        displayValue = item.iataCode;
      }
      input.value = displayValue;
      hideList();
    }
    
    function updateSelection(items) {
      if (!listEl) return;
      const itemEls = listEl.querySelectorAll(".autocomplete-item");
      itemEls.forEach((el, i) => {
        el.classList.toggle("selected", i === selectedIndex);
      });
    }
    
    // Known major airports for IATA code lookups
    const MAJOR_AIRPORTS = {
      "JFK": { name: "New York JFK", city: "New York", country: "United States" },
      "LGA": { name: "New York LaGuardia", city: "New York", country: "United States" },
      "EWR": { name: "Newark", city: "Newark", country: "United States" },
      "LAX": { name: "Los Angeles", city: "Los Angeles", country: "United States" },
      "ORD": { name: "Chicago O'Hare", city: "Chicago", country: "United States" },
      "DFW": { name: "Dallas Fort Worth", city: "Dallas", country: "United States" },
      "DEN": { name: "Denver", city: "Denver", country: "United States" },
      "SFO": { name: "San Francisco", city: "San Francisco", country: "United States" },
      "SEA": { name: "Seattle-Tacoma", city: "Seattle", country: "United States" },
      "ATL": { name: "Atlanta", city: "Atlanta", country: "United States" },
      "BOS": { name: "Boston Logan", city: "Boston", country: "United States" },
      "MIA": { name: "Miami", city: "Miami", country: "United States" },
      "PHX": { name: "Phoenix", city: "Phoenix", country: "United States" },
      "IAH": { name: "Houston George Bush", city: "Houston", country: "United States" },
      "AUS": { name: "Austin-Bergstrom", city: "Austin", country: "United States" },
      "LHR": { name: "London Heathrow", city: "London", country: "United Kingdom" },
      "LGW": { name: "London Gatwick", city: "London", country: "United Kingdom" },
      "CDG": { name: "Paris Charles de Gaulle", city: "Paris", country: "France" },
      "ORY": { name: "Paris Orly", city: "Paris", country: "France" },
      "FRA": { name: "Frankfurt", city: "Frankfurt", country: "Germany" },
      "AMS": { name: "Amsterdam Schiphol", city: "Amsterdam", country: "Netherlands" },
      "MAD": { name: "Madrid Barajas", city: "Madrid", country: "Spain" },
      "BCN": { name: "Barcelona El Prat", city: "Barcelona", country: "Spain" },
      "FCO": { name: "Rome Fiumicino", city: "Rome", country: "Italy" },
      "MXP": { name: "Milan Malpensa", city: "Milan", country: "Italy" },
      "DUB": { name: "Dublin", city: "Dublin", country: "Ireland" },
      "ZRH": { name: "Zurich", city: "Zurich", country: "Switzerland" },
      "VIE": { name: "Vienna", city: "Vienna", country: "Austria" },
      "NRT": { name: "Tokyo Narita", city: "Tokyo", country: "Japan" },
      "HND": { name: "Tokyo Haneda", city: "Tokyo", country: "Japan" },
      "ICN": { name: "Seoul Incheon", city: "Seoul", country: "South Korea" },
      "PEK": { name: "Beijing Capital", city: "Beijing", country: "China" },
      "PVG": { name: "Shanghai Pudong", city: "Shanghai", country: "China" },
      "HKG": { name: "Hong Kong", city: "Hong Kong", country: "Hong Kong" },
      "SIN": { name: "Singapore Changi", city: "Singapore", country: "Singapore" },
      "BKK": { name: "Bangkok Suvarnabhumi", city: "Bangkok", country: "Thailand" },
      "SYD": { name: "Sydney", city: "Sydney", country: "Australia" },
      "MEL": { name: "Melbourne", city: "Melbourne", country: "Australia" },
      "YYZ": { name: "Toronto Pearson", city: "Toronto", country: "Canada" },
      "YTZ": { name: "Toronto Billy Bishop", city: "Toronto", country: "Canada" },
      "YVR": { name: "Vancouver", city: "Vancouver", country: "Canada" },
      "YUL": { name: "Montreal Trudeau", city: "Montreal", country: "Canada" },
      "YYC": { name: "Calgary", city: "Calgary", country: "Canada" },
      "MEX": { name: "Mexico City", city: "Mexico City", country: "Mexico" },
      "CUN": { name: "Cancun", city: "Cancun", country: "Mexico" },
      "GRU": { name: "Sao Paulo Guarulhos", city: "Sao Paulo", country: "Brazil" },
      "EZE": { name: "Buenos Aires Ezeiza", city: "Buenos Aires", country: "Argentina" },
      "DXB": { name: "Dubai", city: "Dubai", country: "United Arab Emirates" },
      "IST": { name: "Istanbul", city: "Istanbul", country: "Turkey" },
      "CPT": { name: "Cape Town", city: "Cape Town", country: "South Africa" },
      "JNB": { name: "Johannesburg", city: "Johannesburg", country: "South Africa" },
    };
    
    async function fetchSuggestions(query) {
      if (query.length < 2) {
        hideList();
        return;
      }
      
      const upperQuery = query.toUpperCase().trim();
      const lowerQuery = query.toLowerCase().trim();
      const items = [];
      
      // Search airports by code OR by name/city
      for (const [code, ap] of Object.entries(MAJOR_AIRPORTS)) {
        const matchesCode = code.startsWith(upperQuery);
        const matchesName = ap.name.toLowerCase().includes(lowerQuery);
        const matchesCity = ap.city.toLowerCase().includes(lowerQuery);
        
        if (matchesCode || matchesName || matchesCity) {
          items.push({
            name: `${ap.name} (${code})`,
            admin1: ap.city,
            country: ap.country,
            iataCode: code,
            // Prioritize exact code matches, then name matches
            priority: code === upperQuery ? 0 : (matchesCode ? 1 : 2),
          });
        }
      }
      
      // Sort by priority (exact matches first)
      items.sort((a, b) => a.priority - b.priority);
      
      // Limit airport results
      const airportResults = items.slice(0, 4);
      
      try {
        // Use Open-Meteo geocoding for city suggestions
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const res = await fetch(url);
        if (!res.ok) {
          if (airportResults.length) showList(airportResults);
          return;
        }
        const data = await res.json();
        
        // Filter to only include reasonable cities (population > 50000 or no population data)
        const cityResults = (data.results || [])
          .filter((r) => {
            // Filter out very small places
            if (r.population && r.population < 50000) return false;
            // Prioritize cities and towns
            if (r.feature_code && !["PPL", "PPLA", "PPLA2", "PPLA3", "PPLC"].includes(r.feature_code)) return false;
            return true;
          })
          .slice(0, 3)
          .map((r) => ({
            name: r.name,
            admin1: r.admin1,
            country: r.country,
            latitude: r.latitude,
            longitude: r.longitude,
            iataCode: null,
          }));
        
        // Airports first, then cities. Always show cities — they are distinct entries
        // (user may want to type a city name rather than pick an airport code).
        const combined = [...airportResults, ...cityResults];
        
        showList(combined.slice(0, 6));
      } catch (e) {
        // Show airport matches if API fails
        if (airportResults.length) showList(airportResults);
      }
    }
    
    input.addEventListener("input", () => {
      const query = input.value.trim();
      clearTimeout(autocompleteDebounce);
      autocompleteDebounce = setTimeout(() => fetchSuggestions(query), 250);
    });
    
    input.addEventListener("keydown", (e) => {
      if (!listEl || !results.length) return;
      
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        updateSelection(results);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection(results);
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        selectItem(results[selectedIndex]);
      } else if (e.key === "Escape") {
        hideList();
      }
    });
    
    input.addEventListener("blur", () => {
      // Delay to allow click on list item
      setTimeout(hideList, 150);
    });
    
    input.addEventListener("focus", () => {
      const query = input.value.trim();
      if (query.length >= 2) {
        fetchSuggestions(query);
      }
    });
  }

  function renderDestinations(container, destinations) {
    container.innerHTML = "";
    destinations.forEach((d, idx) => {
      const row = document.createElement("div");
      row.className = "destRow";
      row.dataset.index = String(idx);

      const cityCell = document.createElement("div");
      cityCell.className = "cityCell";
      const input = document.createElement("input");
      input.className = "cityInput";
      input.type = "text";
      input.value = d.city || "";
      input.placeholder = "Destination airport/city (e.g., Paris, France or LHR)";
      input.required = false;
      input.dataset.role = "city";
      input.autocomplete = "off";
      
      // Add autocomplete functionality
      setupCityAutocomplete(input, cityCell);
      
      cityCell.appendChild(input);

      const daysCell = document.createElement("div");
      daysCell.className = "daysCell";
      const daysInput = document.createElement("input");
      daysInput.type = "number";
      daysInput.min = "1";
      daysInput.step = "1";
      daysInput.placeholder = "Days";
      if (d.stayDays) daysInput.value = d.stayDays;
      daysInput.dataset.role = "stayDays";
      daysCell.appendChild(daysInput);

      const removeCell = document.createElement("div");
      removeCell.className = "removeCell";
      
      // Only show remove button if not the first destination (must have at least one)
      if (idx > 0) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "removeBtn";
        removeBtn.innerHTML = "&times;";
        removeBtn.title = "Remove destination";
        removeBtn.addEventListener("click", () => {
          const current = readDestinationsFromDOM(container);
          current.splice(idx, 1);
          renderDestinations(container, current);
        });
        removeCell.appendChild(removeBtn);
      }

      row.appendChild(cityCell);
      row.appendChild(daysCell);
      row.appendChild(removeCell);
      container.appendChild(row);
    });
  }

  function syncDestinationRows() {
    // Placeholder hook; kept for potential future features.
  }

  function renderHolidayDefaults(container) {
    container.innerHTML = "";
    for (const holiday of DEFAULT_HOLIDAYS) {
      const item = document.createElement("div");
      item.className = "holidayItem";
      if (holiday.tooltip) {
        item.setAttribute("data-tooltip", holiday.tooltip);
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.dataset.holidayId = holiday.id;
      checkbox.id = `holiday_${holiday.id}`;

      const label = document.createElement("label");
      label.setAttribute("for", checkbox.id);
      label.textContent = holiday.name;

      item.appendChild(checkbox);
      item.appendChild(label);
      container.appendChild(item);
    }
  }

  function renderExtraPtoDays(container, initialCount) {
    container.innerHTML = "";
    const count = initialCount || 0;
    for (let i = 0; i < count; i++) addExtraPtoDayRow(container);
  }

  function addExtraPtoDayRow(container) {
    const row = document.createElement("div");
    row.className = "extraDayRow";

    const input = document.createElement("input");
    input.type = "date";
    input.dataset.role = "extraPtoOff";
    input.required = false;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "removeBtn";
    removeBtn.innerHTML = "&times;";
    removeBtn.title = "Remove holiday";
    removeBtn.addEventListener("click", () => row.remove());

    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  function renderItinerary(best, ptoOffSet, holidayInfoMap) {
    const wrap = $("itineraryTableWrap");
    wrap.innerHTML = "";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Date", "Day", "Details", "PTO"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const tbody = document.createElement("tbody");
    
    for (const day of best.days) {
      const tr = document.createElement("tr");
      const dateObj = parseISODate(day.dateISO);
      const dayOfWeek = dayNames[dateObj.getDay()];
      
      // Date column
      const dateTd = document.createElement("td");
      dateTd.textContent = day.dateISO;
      
      // Day of week column
      const dayTd = document.createElement("td");
      dayTd.textContent = dayOfWeek;
      
      // Details column - include flight time for travel days
      const detailsTd = document.createElement("td");
      if (day.kind === "travel" && day.flightDurationHours) {
        const flightTime = formatHours(day.flightDurationHours);
        const halfDayNote = day.isHalfDay ? " (half-day)" : "";
        detailsTd.textContent = `${day.label} (~${flightTime}${halfDayNote})`;
      } else {
        detailsTd.textContent = day.label;
      }
      
      // PTO column - show reason (weekend, holiday name, or Yes/No)
      const ptoTd = document.createElement("td");
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const holidayInfo = holidayInfoMap ? holidayInfoMap.get(day.dateISO) : null;
      
      if (day.ptoRequired) {
        ptoTd.textContent = "Yes";
      } else if (day.workPlusFly) {
        ptoTd.textContent = "No (Work)";
      } else if (isWeekend) {
        ptoTd.textContent = "No (Weekend)";
      } else if (holidayInfo) {
        ptoTd.textContent = "No (Holiday)";
      } else {
        ptoTd.textContent = "No";
      }

      tr.appendChild(dateTd);
      tr.appendChild(dayTd);
      tr.appendChild(detailsTd);
      tr.appendChild(ptoTd);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function formatHours(hours) {
    if (!Number.isFinite(hours)) return "—";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }
  
  // Format city label to avoid duplicate country names
  // e.g. "New York, United States" + "United States" => "New York, United States" (not "New York, United States (United States)")
  function formatCityLabel(displayName, country) {
    if (!country) return displayName;
    // Check if the displayName already contains the country
    const lowerDisplay = displayName.toLowerCase();
    const lowerCountry = country.toLowerCase();
    if (lowerDisplay.includes(lowerCountry)) {
      return displayName;
    }
    return `${displayName} (${country})`;
  }

  function formatMinutes(minutes) {
    if (!Number.isFinite(minutes)) return "—";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

function renderSummary(best, flightTotalHours) {
  const wrap = $("resultsSummary");
  
  wrap.innerHTML = "";
  const cells = [
  { k: "Best start", v: best.tripStartISO },
  { k: "Trip ends", v: best.tripEndISO },
  { k: "PTO required", v: String(best.ptoRequired) },
  { k: "Days in destination", v: String(best.tripDays || best.days.filter(d => d.kind === "city").length) },
  { k: "Total calendar days", v: String(best.days.length) },
  { k: "Total flight time", v: formatHours(flightTotalHours) },
  ];
    cells.forEach((c) => {
      const item = document.createElement("div");
      item.className = "summaryItem";
      const k = document.createElement("div");
      k.className = "k";
      k.textContent = c.k;
      const v = document.createElement("div");
      v.className = "v";
      v.textContent = c.v;
      item.appendChild(k);
      item.appendChild(v);
      wrap.appendChild(item);
    });
  }

  // ---- Main flow ----

  document.addEventListener("DOMContentLoaded", () => {
    const destinationsContainer = $("destinations");
    const addDestinationBtn = $("addDestinationBtn");
    const holidayDefaults = $("holidayDefaults");
    const extraPtoOffContainer = $("extraPtoOffDays");
    const addExtraPtoOffBtn = $("addExtraPtoOffBtn");
    
    // Theme toggle
    const themeToggle = $("themeToggle");
    const themeIcon = $("themeIcon");
    
    function setTheme(dark) {
      if (dark) {
        document.documentElement.setAttribute("data-theme", "dark");
        themeIcon.innerHTML = "&#9788;"; // sun
        localStorage.setItem("travel:theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
        themeIcon.innerHTML = "&#9790;"; // moon
        localStorage.setItem("travel:theme", "light");
      }
    }
    
    // Load saved theme
    const savedTheme = localStorage.getItem("travel:theme");
    if (savedTheme === "dark") {
      setTheme(true);
    }
    
    themeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.hasAttribute("data-theme");
      setTheme(!isDark);
    });
    
    // Set minimum date to today for start/end date inputs
    const today = isoDate(new Date());
    const startDateInput = $("startDate");
    const endDateInput = $("endDate");
    startDateInput.min = today;
    endDateInput.min = today;
    
    // Add autocomplete to home city input
    const homeCityInput = $("homeCity");
    const homeCityField = homeCityInput.parentElement;
    homeCityField.style.position = "relative";
    setupCityAutocomplete(homeCityInput, homeCityField);

    // Render initial destination row (state is read from DOM on add/remove).
    renderDestinations(destinationsContainer, [{ city: "", stayDays: null }]);

    renderHolidayDefaults(holidayDefaults);
    renderExtraPtoDays(extraPtoOffContainer, 0);

addDestinationBtn.addEventListener("click", () => {
  const current = readDestinationsFromDOM(destinationsContainer);
  current.push({ city: "", stayDays: null });
  renderDestinations(destinationsContainer, current);
  });

    addExtraPtoOffBtn.addEventListener("click", () => {
      addExtraPtoDayRow(extraPtoOffContainer);
    });

    const form = $("itineraryForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBox = $("errorBox");
      errorBox.style.display = "none";
      errorBox.textContent = "";

  const homeCity = $("homeCity").value.trim();
  const startDateISO = $("startDate").value;
  const endDateISO = $("endDate").value;
  const redeyeOK = $("redeyeOk").checked;
  const travelDayThresholdH = Number($("travelDayThreshold").value) || 3;
  const objective = $("objective").value;
      const extraPtoInputs = Array.from(extraPtoOffContainer.querySelectorAll("input[data-role='extraPtoOff']"))
        .map((el) => el.value)
        .filter(Boolean);

      // Collect destination rows from DOM to keep the UI source of truth.
      const destRows = Array.from(destinationsContainer.querySelectorAll(".destRow"));
      const rawDestinations = destRows.map((row) => {
        const city = row.querySelector("input[data-role='city']").value.trim();
        const stayDays = Number(row.querySelector("input[data-role='stayDays']").value);
        return { city, stayDays };
      });
      const destinationList = rawDestinations.filter((d) => d.city.length > 0);

      if (!homeCity) return;
      if (!startDateISO || !endDateISO) return;

      if (destinationList.length === 0) {
        errorBox.textContent = "Please add at least one destination city.";
        errorBox.style.display = "block";
        return;
      }

      // MVP limitation: avoid duplicate destination city strings (would break order->stay-days inference).
      const seenDest = new Set();
      for (const d of destinationList) {
        const k = d.city.toLowerCase().trim();
        if (seenDest.has(k)) {
          errorBox.textContent = `Please avoid duplicate destinations: "${d.city}".`;
          errorBox.style.display = "block";
          return;
        }
        seenDest.add(k);
      }

      const windowStart = parseISODate(startDateISO);
      const windowEnd = parseISODate(endDateISO);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      if (windowStart < todayDate) {
        errorBox.textContent = "Start date must be today or in the future.";
        errorBox.style.display = "block";
        return;
      }
      
      if (windowEnd < windowStart) {
        errorBox.textContent = "End date must be on/after start date.";
        errorBox.style.display = "block";
        return;
      }

      const windowDays = Math.round((windowEnd - windowStart) / (24 * 60 * 60 * 1000)) + 1;
      const totalStayDays = destinationList.reduce((sum, d) => sum + d.stayDays, 0);

      if (totalStayDays > windowDays) {
        errorBox.textContent = `Instant validation: you want ${totalStayDays} city days, but your date window is only ${windowDays} days.`;
        errorBox.style.display = "block";
        return;
      }

      const enabledHolidayIds = new Set(
        Array.from(holidayDefaults.querySelectorAll("input[type='checkbox'][data-holiday-id]")).filter((el) => el.checked).map((el) => el.dataset.holidayId)
      );

      // Cache objects
      const geoCache = loadCache(STORAGE_KEYS.geo);
      const airportCache = loadCache(STORAGE_KEYS.airport);
      const flightCache = loadCache(STORAGE_KEYS.flight);

      try {
        const workBtn = e.submitter;
        if (workBtn && workBtn.disabled !== undefined) workBtn.disabled = true;

        $("resultsSummary").innerHTML = "";
        $("itineraryTableWrap").innerHTML = "";

        const normalizedKey = (s) => {
          const raw = String(s || "").trim();
          if (isIataToken(raw)) return `iata:${raw.toUpperCase()}`;
          return `city:${raw.toLowerCase()}`;
        };

        const resolvedByKey = new Map();
        async function getResolved(input) {
          const key = normalizedKey(input);
          if (resolvedByKey.has(key)) return resolvedByKey.get(key);
          const resolved = await resolveInputToLocation({ input, geoCache, airportCache });
          resolvedByKey.set(key, resolved);
          return resolved;
        }

        // Resolve home (airport anchor via IATA token, or city -> nearest airport).
        const homeResolved = await getResolved(homeCity);
        const home = {
          id: "home",
          displayName: homeResolved.displayName,
          country: homeResolved.country,
          airport: homeResolved.airport,
        };

        const cities = [];
        for (let idx = 0; idx < destinationList.length; idx++) {
          const d = destinationList[idx];
          const resolved = await getResolved(d.city);
          cities.push({
            id: `city_${idx}_${String(d.city).toLowerCase().replace(/\\s+/g, "_")}`,
            displayName: resolved.displayName,
            country: resolved.country,
            stayDays: d.stayDays,
            airport: resolved.airport,
          });
        }

        const ptoOffSet = buildPtoOffSet({
          windowStartISO: startDateISO,
          windowEndISO: endDateISO,
          enabledHolidayIds,
          extraPtoOffDates: extraPtoInputs,
        });

        const best = optimizeOrderAndDates({
          home,
          cities,
          windowStartISO: startDateISO,
          windowEndISO: endDateISO,
          redeyeOK,
          ptoOffSet,
          objective,
          travelDayThresholdH,
        });

        if (!best) {
          errorBox.textContent =
            "No feasible itinerary found within the selected date window given your holiday/PTO-off selection. Try widening the date window or adjusting stay days.";
          errorBox.style.display = "block";
          return;
        }

        // Flight segments: heuristic by default.
        // We don't return the ordered city list directly from the optimizer, so infer it from the simulation day labels.
        const orderedCities = deriveOrderedCitiesFromBest(best, home, cities);
        const legList = buildLegs(home, orderedCities);

        let finalBest = best;
        let totalFlightHours = best.totalFlightHoursHeuristic;
        
        // Build holiday info map for display
        const holidayInfoMap = buildHolidayInfoMap({
          windowStartISO: startDateISO,
          windowEndISO: endDateISO,
          enabledHolidayIds,
          extraPtoOffDates: extraPtoInputs,
        });

        // Optional: fetch real-ish flight durations (AeroDataBox).
        const apiKey = $("flightApiKey").value.trim();
        const flightModel = $("flightModel").value;
        if (apiKey) {
          // Only fetch for the selected itinerary legs (minimize API calls).
          // Then optionally recompute travel blocks using the returned durations.
          const flightSegments = [];
          for (let i = 0; i < legList.length; i++) {
            const leg = legList[i];
            const fromIata = leg.from.airport?.iataCode;
            const toIata = leg.to.airport?.iataCode;
            try {
              const minutes = await getFlightDurationMinutesAeroDataBox({
                apiKey,
                fromIata,
                toIata,
                model: flightModel,
                flightCache,
              });
              const hours = minutes / 60;
              flightSegments.push({
                durationMinutes: minutes,
                durationHours: hours,
              });
            } catch (err) {
              const durationHours = estimateLegDurationHours(leg.from.airport, leg.to.airport);
              flightSegments.push({
                durationMinutes: durationHours * 60,
                durationHours,
              });
            }
          }

          // If we managed to get durations, recompute travel blocks for transparency.
          const allMinutesOk = flightSegments.every((s) => Number.isFinite(s.durationMinutes));
          if (allMinutesOk) {
            // Re-simulate itinerary using real duration-based travel blocks.
            const overridden = simulateItineraryWithLegDurations({
              home,
              orderedCities,
              startISO: best.tripStartISO,
              redeyeOK,
              ptoOffSet,
              legDurationsHours: flightSegments.map((s) => s.durationMinutes / 60),
              travelDayThresholdH,
            });
            // Only accept the overridden itinerary if it still fits within the user's end date.
            if (overridden && overridden.days.length && overridden.tripEndISO <= endDateISO) {
              finalBest = overridden;
              totalFlightHours = flightSegments.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
            }
          }
        }

        renderSummary(finalBest, totalFlightHours);
        renderItinerary(finalBest, ptoOffSet, holidayInfoMap);
      } catch (err) {
        errorBox.textContent = `Something went wrong: ${err?.message || String(err)}`;
        errorBox.style.display = "block";
      } finally {
        const submitBtn = e.submitter;
        if (submitBtn && submitBtn.disabled !== undefined) submitBtn.disabled = false;
      }
    });
  });

  function deriveOrderedCitiesFromBest(best, home, cities) {
    // Best doesn't directly return the order. We'll infer from day labels where kind === 'city'.
    // That gives a city stay block order (with repetition impossible in this model).
    const cityNames = [];
    for (const d of best.days) {
      if (d.kind !== "city") continue;
      const match = d.label.match(/^(.+)\s\(/); // "City (country)"
      if (!match) continue;
      cityNames.push(match[1]);
    }
    // Collapse repeats into unique city stay blocks:
    const collapsed = [];
    for (const name of cityNames) {
      if (!collapsed.length || collapsed[collapsed.length - 1] !== name) collapsed.push(name);
    }

    const orderedCities = collapsed.map((name) => cities.find((c) => c.displayName === name)).filter(Boolean);
    return orderedCities;
  }

  function simulateItineraryWithLegDurations({ home, orderedCities, startISO, redeyeOK, ptoOffSet, legDurationsHours, travelDayThresholdH = 3 }) {
    const days = [];
    let currentDate = parseISODate(startISO);
    const legs = buildLegs(home, orderedCities);
    if (legDurationsHours.length !== legs.length) return null;

    let totalFlightHoursHeuristic = 0;
    let tripDays = 0;
    
    for (let legIdx = 0; legIdx < legs.length; legIdx++) {
      const leg = legs[legIdx];
      const durationHours = legDurationsHours[legIdx];
      if (!Number.isFinite(durationHours)) return null;
      totalFlightHoursHeuristic += durationHours;

      const model = travelBlockModel(durationHours, redeyeOK, travelDayThresholdH);

      if (model.noTravelDay) {
        // Annotate the last city day already in the schedule with a departure note
        if (days.length > 0) {
          const lastDay = days[days.length - 1];
          const toLabel = leg.type === "return" ? "home" : leg.to.displayName;
          if (model.isRedeye) {
            lastDay.label += ` (red-eye to ${toLabel} ~${formatHours(durationHours)})`;
          } else {
            lastDay.label += ` (evening flight to ${toLabel} ~${formatHours(durationHours)})`;
            if (!lastDay.ptoRequired) {
              lastDay.workPlusFly = true;
            }
          }
        }
      } else {
        for (let t = 0; t < model.travelDays; t++) {
          const d = addDays(currentDate, t);
          const off = ptoOffSet.has(isoDate(d));
          const ptoRequired = isWeekday(d) && !off && model.ptoOffsets.includes(t);
          days.push({
            dateISO: isoDate(d),
            kind: "travel",
            label:
              leg.type === "outbound"
                ? `Travel: ${leg.from.displayName} -> ${leg.to.displayName}`
                : leg.type === "return"
                  ? `Return: ${leg.from.displayName} -> ${leg.to.displayName}`
                  : `Travel: ${leg.from.displayName} -> ${leg.to.displayName}`,
            ptoRequired,
            flightDurationHours: durationHours,
            fromIata: leg.from.airport?.iataCode,
            toIata: leg.to.airport?.iataCode,
            noTravelDay: false,
          });
        }
        currentDate = addDays(currentDate, model.travelDays);
      }

      if (leg.to !== home) {
        for (let s = 0; s < leg.to.stayDays; s++) {
          const d = addDays(currentDate, s);
          const off = ptoOffSet.has(isoDate(d));
          const ptoRequired = isWeekday(d) && !off;
          
          const flightNote = (s === 0 && model.noTravelDay) 
            ? ` (incl. ${formatHours(durationHours)} flight)` 
            : "";
          
          days.push({
            dateISO: isoDate(d),
            kind: "city",
            label: formatCityLabel(leg.to.displayName, leg.to.country) + flightNote,
            ptoRequired,
          });
          tripDays++;
        }
        currentDate = addDays(currentDate, leg.to.stayDays);
      }
    }

    const ptoRequiredTotal = days.reduce((sum, x) => sum + (x.ptoRequired ? 1 : 0), 0);
    return {
      days,
      ptoRequired: ptoRequiredTotal,
      totalFlightHoursHeuristic,
      tripStartISO: days[0]?.dateISO,
      tripEndISO: days[days.length - 1]?.dateISO,
      tripDays,
    };
  }
})();

