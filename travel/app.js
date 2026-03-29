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
  const SELECTED_LOCATION_META = new WeakMap();

  // Travel block model with configurable threshold
  // - travelDayThresholdH: user-set threshold (in hours) for what requires a travel day
  // - redeyeOK: if true, flights under threshold can be overnight without using a travel day
  // - durationHours: estimated flight duration
  //
  // Returns:
  // - travelDays: number of calendar days consumed by travel (0 = no dedicated travel day)
  // - ptoOffsets: which travel day indices require PTO (if weekday and not holiday)
  // - noTravelDay: true if flight doesn't need a dedicated travel day
  function travelBlockModel(durationHours, redeyeOK, travelDayThresholdH = 3, redeyeOvernightH = 8) {
    // Always avoid dedicated travel days when flight time is under the user's threshold.
    if (durationHours < travelDayThresholdH) {
      return { travelDays: 0, ptoOffsets: [], noTravelDay: true, isRedeye: redeyeOK };
    }

    // If red-eye is allowed, split into overnight + next-day spillover.
    // ONLY use red-eye if it actually saves a travel day (spillover within threshold).
    // If spillover exceeds threshold, we'd need a travel day anyway, so skip the red-eye
    // and just do a regular daytime flight on a dedicated travel day.
    if (redeyeOK) {
      const spilloverHours = Math.max(0, durationHours - redeyeOvernightH);
      if (spilloverHours <= travelDayThresholdH) {
        // Red-eye saves a travel day - use it
        return {
          travelDays: 0,
          ptoOffsets: [],
          noTravelDay: true,
          isRedeye: true,
          spilloverHours,
          travelDayOnNextDay: false,
        };
      }
      // Spillover exceeds threshold: red-eye doesn't help, fall through to regular travel day logic
    }

    // Most flights, including typical long-haul, should use one travel day.
    if (durationHours <= 20) {
      return {
        travelDays: 1,
        ptoOffsets: [0],
        noTravelDay: false,
        isRedeye: false,
        spilloverHours: 0,
        travelDayOnNextDay: false,
      };
    }

    // Ultra-long legs: cap at 2 travel days.
    return {
      travelDays: 2,
      ptoOffsets: [0, 1],
      noTravelDay: false,
      isRedeye: false,
      spilloverHours: 0,
      travelDayOnNextDay: false,
    };
  }

  function getDurationHoursFromDistanceKm(distanceKm, isWestward = false) {
    // Calibrated heuristic aimed at realistic gate-to-gate estimates.
    let cruiseSpeedKmh;
    if (distanceKm < 1500) cruiseSpeedKmh = 700;
    else if (distanceKm < 4000) cruiseSpeedKmh = 780;
    else if (distanceKm < 9000) cruiseSpeedKmh = 840;
    else cruiseSpeedKmh = 900;

    const windFactor = isWestward ? 1.04 : 0.98;
    const airborneHours = (distanceKm / cruiseSpeedKmh) * windFactor;
    const groundTimeHours = distanceKm < 1200 ? 0.7 : distanceKm < 5000 ? 0.9 : 1.0;

    return Math.max(0.75, airborneHours + groundTimeHours);
  }

  function splitFlightHours(durationHours, isRedeye, redeyeOvernightH = 8) {
    if (!Number.isFinite(durationHours)) return { nightHours: 0, dayHours: 0 };
    if (!isRedeye) return { nightHours: 0, dayHours: durationHours };
    const nightHours = Math.min(durationHours, redeyeOvernightH);
    return { nightHours, dayHours: Math.max(0, durationHours - nightHours) };
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

  async function cachedJson(cacheKey, cacheObj, key, mustHaveKeys, fetchFn) {
    if (cacheObj[key]) {
      let hasAllKeys = true;
      if (mustHaveKeys) {
        for (const key of mustHaveKeys) {
          if (!cacheObj[key] || isNullOrEmpty(cacheObj[key])) {
            hasAllKeys = false;
          }
        }
      } 
      if (hasAllKeys) {
        return cacheObj[key];
      }
    }
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
    return cachedJson(STORAGE_KEYS.geo, geoCache, key, ["country", "name"], async () => {
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
    return cachedJson(STORAGE_KEYS.airport, cacheObj, key, ["iataCode", "icaoCode", "name", "city"], async () => {
      const types = "large_airport,medium_airport";
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
        city: airport.city || airport.municipality || "",
        latitude: airport.coordinates?.latitude ?? latitude,
        longitude: airport.coordinates?.longitude ?? longitude,
      };
    });
  }

  function isIataToken(token) {
    // Strict MVP: exactly 3 letters.
    return /^[A-Za-z]{3}$/.test(String(token).trim());
  }

  function inferCityFromAirportName(airportName = "") {
    for (const airport of airportsDB) {
      if (airport.n === airportName) return airport.c;
    }
    const cleaned = String(airportName || "")
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\b(international|intl|airport|airfield|terminal)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!cleaned) return "";
    return cleaned.split(/[-,/]/)[0].trim();
  }

  function normalizeTypedCity(rawInput = "") {
    const raw = String(rawInput || "").trim();
    if (!raw) return "";
    const looksAirportLike = /\b(airport|international|intl|terminal)\b/i.test(raw) || /\b[A-Za-z]{3}\b$/.test(raw);
    // Remove common airport words and trailing IATA-like tokens.
    const cleaned = raw
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\b(international|intl|airport|airfield|terminal)\b/gi, "")
      .replace(/\b[A-Za-z]{3}\b$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!cleaned) return "";
    // Keep the left-most place phrase, which is usually the city.
    const left = cleaned.split(",")[0].trim();
    if (!left) return "";
    if (!looksAirportLike) return left;
    const words = left.split(/\s+/);
    // Handle common two-word city prefixes.
    if (words.length >= 2 && ["new", "los", "san", "las", "rio", "abu", "ho", "st"].includes(words[0].toLowerCase())) {
      return `${words[0]} ${words[1]}`;
    }
    // If user typed "City SomethingAirport", prefer first token as city approximation.
    if (words.length >= 2) return words[0];
    return left;
  }

  function looksAirportLikeInput(rawInput = "") {
    const raw = String(rawInput || "").trim();
    if (!raw) return false;
    if (isIataToken(raw)) return true;
    return /\b(airport|international|intl|terminal|airfield)\b/i.test(raw);
  }

  function locationCityLabel(resolved, fallbackInput = "") {
    const city = String(
      resolved?.cityName || resolved?.airport?.city || resolved?.airport?.municipality || ""
    ).trim();
    if (city) return city;
    const inferred = inferCityFromAirportName(resolved?.airport?.name || resolved?.displayName);
    if (inferred) return inferred;
    const raw = String(fallbackInput || "").trim();
    if (!raw) return resolved?.displayName || "Unknown";
    if (isIataToken(raw)) return resolved?.airport?.city || inferred || raw.toUpperCase();
    return raw;
  }

  async function resolveInputToLocation({ input, geoCache, airportCache, preferredCity = "", preferredCountry = "" }) {
    const raw = String(input || "").trim();
    if (!raw) throw new Error("Empty location input");

    if (isIataToken(raw)) {
      const code = raw.toUpperCase();
      const key = `iata:${code}`;
      const cachedAirport = await cachedJson(STORAGE_KEYS.airport, airportCache, key, ["displayName", "cityName", "country"], async () => {
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
          city: data.city || data.municipality || "",
          latitude: data.coordinates.latitude,
          longitude: data.coordinates.longitude,
        };
        return {
          displayName: data.name || data.iataCode,
          cityName: preferredCity || data.city || data.municipality || inferCityFromAirportName(data.name || ""),
          country: preferredCountry || data.country || "",
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

    const typedCityGuess = normalizeTypedCity(raw);
    const airportLike = looksAirportLikeInput(raw);
    return {
      displayName: geo.name || typedCityGuess || raw,
      cityName: preferredCity
        ? preferredCity
        : airportLike
        ? (airport?.city || airport?.municipality || geo.name || typedCityGuess || raw)
        : (geo.name || typedCityGuess || airport?.city || airport?.municipality || raw),
      country: preferredCountry || geo.country || "",
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

  function buildLegs(home, orderedCities, returnDest) {
    // Returns legs in order: home->first, city->city, last->(returnDest||home)
    const dest = returnDest || home;
    const legs = [];
    if (!orderedCities.length) return legs;
    legs.push({ from: home, to: orderedCities[0], type: "outbound" });
    for (let i = 0; i < orderedCities.length - 1; i++) {
      legs.push({ from: orderedCities[i], to: orderedCities[i + 1], type: "between" });
    }
    legs.push({ from: orderedCities[orderedCities.length - 1], to: dest, type: "return" });
    return legs;
  }

  function simulateItinerary({ home, orderedCities, startISO, redeyeOK, ptoOffSet, travelDayThresholdH = 3, redeyeOvernightH = 8, returnDest }) {
    // Produce day-by-day entries + PTO required + heuristic flight hours.
    const days = [];
    let currentDate = parseISODate(startISO);
    let totalFlightHoursHeuristic = 0;
    let tripDays = 0; // Days actually in destination (excluding travel-only days)

    const legs = buildLegs(home, orderedCities, returnDest);
    for (let legIdx = 0; legIdx < legs.length; legIdx++) {
      const leg = legs[legIdx];

      const durationHours = estimateLegDurationHours(leg.from.airport, leg.to.airport);
      totalFlightHoursHeuristic += durationHours;

      const model = travelBlockModel(durationHours, redeyeOK, travelDayThresholdH, redeyeOvernightH);
      
      // If noTravelDay, we don't add separate travel day entries
      // The flight happens overnight or same-day alongside other activities
      const { nightHours, dayHours } = splitFlightHours(durationHours, !!model.isRedeye, redeyeOvernightH);
      
      if (model.noTravelDay) {
        // For outbound leg from home, we need to note the departure
        // For other legs, annotate the last city day
        if (leg.type === "outbound" && days.length === 0) {
          // First leg from home: show a travel entry (not a city day), so city-day
          // counters start only once the traveler has actually arrived.
          const d = currentDate;
          const toLabel = leg.to.cityName || leg.to.displayName;
          const fromLabel = leg.from.cityName || leg.from.displayName;
          
          // Build departure day label - only show what happens on THIS day
          let flightNote;
          if (model.isRedeye && nightHours > 0) {
            // Red-eye: show total flight time and overnight portion for departure day
            flightNote = ` (evening work, then red-eye to ${toLabel} ~${formatHours(durationHours)}, ${formatHours(nightHours)} overnight)`;
          } else {
            flightNote = ` (work, then evening flight to ${toLabel} ~${formatHours(durationHours)})`;
          }
          
          days.push({
            dateISO: isoDate(d),
            kind: "travel",
            label: `${fromLabel} → ${toLabel}${flightNote}`,
            ptoRequired: false,
            workPlusFly: true,
            noTravelDay: true,
            isRedeyeTravel: !!model.isRedeye,
            flightDurationHours: durationHours,
            // For departure day, we show overnight portion in the label, not in the generic display
            nightHours: 0, // Don't show split in generic renderer
            dayHours: 0,
            isDepartureDay: true,
            hasNextDaySpillover: model.isRedeye && dayHours > 0,
            spilloverHours: dayHours,
          });
          
          // Red-eye arrives the next calendar day - add an arrival row if there's spillover
          if (model.isRedeye) {
            currentDate = addDays(currentDate, 1);
            // If there's spillover (remaining flight time), note it on arrival day
            // But don't add a separate travel row - let the city days handle it
            // We'll add the spillover note to the first city day below
          }
        } else if (days.length > 0) {
          const lastDay = days[days.length - 1];
          const toLabel = leg.type === "return" ? (leg.to.cityName || "home") : (leg.to.cityName || leg.to.displayName);
          
          // Annotate the last day with departure info
          if (model.isRedeye && nightHours > 0) {
            lastDay.label += ` (evening departure to ${toLabel})`;
            // Store flight info on the last day for proper display
            lastDay.departureFlightDurationHours = durationHours;
            lastDay.departureNightHours = nightHours;
          } else {
            lastDay.label += ` (evening flight to ${toLabel} ~${formatHours(durationHours)})`;
          }
        }
      } else {
        if (model.travelDayOnNextDay) {
          // Red-eye departs previous evening; dedicated travel day is the next calendar day.
          const departTo = leg.type === "return" ? (leg.to.cityName || "home") : (leg.to.cityName || leg.to.displayName);
          const fromCity = leg.from.cityName || leg.from.displayName;
          
          if (days.length > 0) {
            // Annotate the last city day with evening departure
            days[days.length - 1].label += ` (evening departure to ${departTo})`;
            // Store the departure flight info
            days[days.length - 1].departureFlightDurationHours = durationHours;
            days[days.length - 1].departureNightHours = nightHours;
          } else {
            // No previous day, create a departure day
            days.push({
              dateISO: isoDate(currentDate),
              kind: "travel",
              label: `${fromCity} → ${departTo} (evening departure; ~${formatHours(durationHours)}, ${formatHours(nightHours)} overnight)`,
              ptoRequired: false,
              workPlusFly: true,
              noTravelDay: true,
              isRedeyeTravel: true,
              flightDurationHours: durationHours,
              nightHours: 0,
              dayHours: 0,
              isDepartureDay: true,
              departureNightHours: nightHours,
            });
          }
          currentDate = addDays(currentDate, 1);
        }
        
        // Add travel day entries - these are the "next day" spillover days
        for (let t = 0; t < model.travelDays; t++) {
          const d = addDays(currentDate, t);
          const off = ptoOffSet.has(isoDate(d));
          const ptoRequired = isWeekday(d) && !off && model.ptoOffsets.includes(t);
          const isRedeyeTravel = isWeekday(d) && !off && !model.ptoOffsets.includes(t) && redeyeOK;
          
          const fromCity = leg.from.cityName || leg.from.displayName;
          const toCity = leg.to.cityName || leg.to.displayName;
          
          let travelLabel;
          if (model.travelDays === 1) {
            // Single travel day
            if (model.travelDayOnNextDay && dayHours > 0) {
              // This is a spillover day from a red-eye that departed the previous evening
              travelLabel = `${fromCity} → ${toCity}`;
            } else if (leg.type === "outbound") {
              travelLabel = `Travel: ${fromCity} → ${toCity}`;
            } else if (leg.type === "return") {
              travelLabel = `Return: ${fromCity} → ${toCity}`;
            } else {
              travelLabel = `Travel: ${fromCity} → ${toCity}`;
            }
          } else {
            // Multi-day travel - clarify which day
            if (t === 0) {
              travelLabel = `Travel Day 1: Depart ${fromCity}`;
            } else if (t === model.travelDays - 1) {
              travelLabel = `Travel Day ${t + 1}: Arrive ${toCity}`;
            } else {
              travelLabel = `Travel Day ${t + 1}: ${fromCity} → ${toCity}`;
            }
          }
          
          // Determine what portion of the flight to show for this day
          let displayNightHours = 0;
          let displayDayHours = 0;
          let isArrivalDay = false;
          let arrivalSpilloverHours = 0;
          
          if (model.travelDayOnNextDay && t === 0) {
            // This is the arrival day after a red-eye departure
            isArrivalDay = true;
            arrivalSpilloverHours = dayHours; // The remaining portion after overnight
          } else if (!model.isRedeye) {
            // Regular daytime flight
            displayDayHours = durationHours;
          }
          
          days.push({
            dateISO: isoDate(d),
            kind: "travel",
            label: travelLabel,
            ptoRequired,
            flightDurationHours: durationHours,
            nightHours: displayNightHours,
            dayHours: displayDayHours,
            fromIata: leg.from.airport?.iataCode,
            toIata: leg.to.airport?.iataCode,
            noTravelDay: false,
            isRedeyeTravel,
            isArrivalDay,
            arrivalSpilloverHours,
          });
        }
        currentDate = addDays(currentDate, model.travelDays);
      }

      // After travel, if the arrival is a destination city (not the final return), add stay days.
      if (leg.type !== "return") {
        // Check if there's spillover from the previous travel leg (red-eye with no dedicated travel day)
        const lastDayEntry = days.length > 0 ? days[days.length - 1] : null;
        const pendingSpillover = lastDayEntry?.hasNextDaySpillover ? lastDayEntry.spilloverHours : 0;
        const fromLabel = leg.from.cityName || leg.from.displayName;
        const toLabel = leg.to.cityName || leg.to.displayName;
        
        for (let s = 0; s < leg.to.stayDays; s++) {
          const d = addDays(currentDate, s);
          const off = ptoOffSet.has(isoDate(d));
          let ptoRequired = isWeekday(d) && !off;
          let workPlusFly = false;
          
          let cityLabel = formatCityLabel(leg.to.cityName || leg.to.displayName, leg.to.country);
          let arrivalSpillover = 0;
          let arrivalFlightDuration = 0;
          
          // If this is the first day in this city and there's pending spillover from a red-eye
          if (s === 0 && pendingSpillover > 0) {
            arrivalSpillover = pendingSpillover;
            arrivalFlightDuration = lastDayEntry?.flightDurationHours || 0;
          }

          days.push({
            dateISO: isoDate(d),
            kind: "city",
            label: cityLabel,
            ptoRequired,
            workPlusFly,
            arrivalSpilloverHours: arrivalSpillover,
            arrivalFlightDurationHours: arrivalFlightDuration,
            arrivalFromCity: s === 0 && pendingSpillover > 0 ? fromLabel : null,
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
      orderedCities, // Preserved so callers don't need to re-derive order from labels
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

  function generateStartCandidates({ windowStartISO, windowEndISO, totalCalendarDaysNeeded, dateConstraint }) {
    const start = parseISODate(windowStartISO);
    const end = parseISODate(windowEndISO);

    const latestStart = addDays(end, -(totalCalendarDaysNeeded - 1));
    const candidates = [];
    let cursor = start;
    while (cursor <= latestStart) {
      candidates.push(isoDate(cursor));
      cursor = addDays(cursor, 1);
    }

    if (!dateConstraint || dateConstraint.mode === "range") return candidates;

    if (dateConstraint.mode === "range+dow") {
      const { direction, dayOfWeek } = dateConstraint;
      return candidates.filter((iso) => {
        if (direction === "depart") {
          return parseISODate(iso).getDay() === dayOfWeek;
        } else {
          const endDate = addDays(parseISODate(iso), totalCalendarDaysNeeded - 1);
          return endDate.getDay() === dayOfWeek;
        }
      });
    }

    if (dateConstraint.mode === "specific") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { direction, date } = dateConstraint;
      if (direction === "depart") {
        const d = parseISODate(date);
        return d >= start && d <= latestStart ? [date] : [];
      } else {
        const arriveDate = parseISODate(date);
        const startDate = addDays(arriveDate, -(totalCalendarDaysNeeded - 1));
        const startISO = isoDate(startDate);
        // Only accept if the computed start is feasible (not in the past) and within the window.
        if (startDate < today) return [];
        return startDate >= start && startDate <= latestStart ? [startISO] : [];
      }
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

  function computeTotalCalendarDaysHeuristic({ home, orderedCities, returnDest, redeyeOK, travelDayThresholdH = 3, redeyeOvernightH = 8 }) {
    // We need a fixed template length for feasibility pruning.
    const legs = buildLegs(home, orderedCities, returnDest);
    let total = 0;
    for (const leg of legs) {
      const durationHours = estimateLegDurationHours(leg.from.airport, leg.to.airport);
      const model = travelBlockModel(durationHours, redeyeOK, travelDayThresholdH, redeyeOvernightH);
      total += model.travelDays;
      if (leg.type !== "return") total += leg.to.stayDays;
    }
    return total;
  }

  function heuristicOrder({ home, cities, returnDest }) {
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
      const legs = buildLegs(home, routeArr, returnDest);
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

  function optimizeOrderAndDates({ home, cities, windowStartISO, windowEndISO, redeyeOK, ptoOffSet, objective, travelDayThresholdH = 3, redeyeOvernightH = 8, returnDest, dateConstraint }) {
    const n = cities.length;
    if (n === 0) return null;

    let best = null;
    const capForExact = 8;
    // Use more start-date candidates for small city counts (exact search) to reduce
    // the risk of declaring one order "better" due to missing its optimal start date.
    const START_CANDIDATE_CAP = n <= 5 ? 180 : 80;
    if (n <= capForExact) {
      const orders = permute(cities);
      for (const orderedCities of orders) {
        const totalDaysNeeded = computeTotalCalendarDaysHeuristic({ home, orderedCities, returnDest, redeyeOK, travelDayThresholdH, redeyeOvernightH });
        const startCandidates = generateStartCandidates({ windowStartISO, windowEndISO, totalCalendarDaysNeeded: totalDaysNeeded, dateConstraint });
        const candidatesCapped = capCandidates(startCandidates, START_CANDIDATE_CAP);
        for (const startISO of candidatesCapped) {
          const sim = simulateItinerary({ home, orderedCities, startISO, redeyeOK, ptoOffSet, travelDayThresholdH, redeyeOvernightH, returnDest });
          best = compareItineraries(best, sim, objective);
        }
      }
    } else {
      // For > 8 cities: heuristic route only. Start date still optimized by PTO.
      const route = heuristicOrder({ home, cities, returnDest });
      const totalDaysNeeded = computeTotalCalendarDaysHeuristic({ home, orderedCities: route, returnDest, redeyeOK, travelDayThresholdH, redeyeOvernightH });
      const startCandidates = generateStartCandidates({ windowStartISO, windowEndISO, totalCalendarDaysNeeded: totalDaysNeeded, dateConstraint });
      const candidatesCapped = capCandidates(startCandidates, START_CANDIDATE_CAP);
      for (const startISO of candidatesCapped) {
        const sim = simulateItinerary({ home, orderedCities: route, startISO, redeyeOK, ptoOffSet, travelDayThresholdH, redeyeOvernightH, returnDest });
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

  // City/airport autocomplete using airports.json database + Open-Meteo geocoding
  let autocompleteDebounce = null;
  let airportsDB = null; // Will be loaded on first use
  
  async function loadAirportsDB() {
    if (airportsDB) return airportsDB;
    try {
      const res = await fetch('./airports.json');
      if (!res.ok) throw new Error('Failed to load airports database');
      airportsDB = await res.json();
      console.log(`Loaded ${airportsDB.length} airports`);
      return airportsDB;
    } catch (e) {
      console.error('Could not load airports.json:', e);
      return [];
    }
  }
  
  function searchAirports(query, airports, limit = 6) {
    if (!airports || !airports.length) return [];
    const q = query.toLowerCase().trim();
    if (q.length < 2) return [];
    
    const results = [];
    const qUpper = q.toUpperCase();
    
    for (const ap of airports) {
      // Priority scoring: exact IATA = 0, IATA prefix = 1, exact keyword = 2, city starts with = 3, city contains = 4, name = 5
      let priority = 999;
      let matched = false;
      let matchedKeyword = null; // Track which keyword matched (for bali, hawaii, etc)
      
      // IATA exact match
      if (ap.i === qUpper) {
        priority = 0;
        matched = true;
      }
      // IATA starts with
      else if (ap.i.startsWith(qUpper)) {
        priority = 1;
        matched = true;
      }
      // Exact keyword match (for bali, hawaii, maldives etc)
      else if (ap.k && ap.k.some(kw => kw === q || kw.startsWith(q))) {
        priority = 2;
        matched = true;
        // Find the matching keyword and capitalize it
        matchedKeyword = ap.k.find(kw => kw === q || kw.startsWith(q));
        if (matchedKeyword) {
          matchedKeyword = matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1);
          ap.c = matchedKeyword;
        }
      }
      // City name starts with query or matches word boundary
      else if (ap.c) {
        const cityLower = ap.c.toLowerCase();
        if (cityLower.startsWith(q) || cityLower.includes(' ' + q) || cityLower.includes(',' + q)) {
          priority = 3;
          matched = true;
        } else if (cityLower.includes(q)) {
          // Partial match in middle of word - lower priority
          priority = 5;
          matched = true;
        }
      }
      
      // Airport name match (only if not already matched)
      if (!matched && ap.n && ap.n.toLowerCase().includes(q)) {
        priority = 6;
        matched = true;
      }
      // Country match (lower priority)
      if (!matched && ap.o && ap.o.toLowerCase().includes(q)) {
        priority = 7;
        matched = true;
      }
      
      if (matched) {
        results.push({ ...ap, priority });
      }
    }
    
    // Sort by priority, then by size (L before M), then alphabetically
    results.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.s !== b.s) return a.s === 'L' ? -1 : 1;
      return (a.c || a.n).localeCompare(b.c || b.n);
    });
    
    return results.slice(0, limit);
  }
  
  // Extract clean city name from airport city field or name
  function extractCityName(ap) {
    // The city field often has format "City, Region" - take first part
    if (ap.c) {
      const parts = ap.c.split(',');
      return parts[0].trim();
    }
    // Fallback: try to extract from airport name
    return inferCityFromAirportName(ap.n);
  }
  
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
        // Show city name prominently, with airport name if different
        const cityName = item.city || extractCityName(item) || item.name;
        if (item.iataCode) {
          nameSpan.textContent = `${cityName} (${item.iataCode})`;
        } else {
          nameSpan.textContent = cityName;
        }
        
        const detailsSpan = document.createElement("div");
        detailsSpan.className = "city-details";
        const parts = [];
        // Show airport name if it's different from city
        if (item.airportName && item.airportName !== cityName) {
          parts.push(item.airportName);
        }
        if (item.country) parts.push(item.country);
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
      // Use IATA code as the input value for airports
      if (item.iataCode) {
        input.value = item.iataCode;
      } else {
        input.value = item.city || item.name;
        if (item.country) {
          input.value += `, ${item.country}`;
        }
      }
      
      // Store the resolved city name for later use
      const selectedCity = item.city || extractCityName(item) || item.name || "";
      const selectedCountry = item.country || "";
      const selectedIata = item.iataCode || "";
      input.dataset.selectedCity = selectedCity;
      input.dataset.selectedCountry = selectedCountry;
      input.dataset.selectedIata = selectedIata;
      SELECTED_LOCATION_META.set(input, {
        city: selectedCity,
        country: selectedCountry,
        iata: selectedIata,
      });
      hideList();
    }
    
    function updateSelection() {
      if (!listEl) return;
      const itemEls = listEl.querySelectorAll(".autocomplete-item");
      itemEls.forEach((el, i) => {
        el.classList.toggle("selected", i === selectedIndex);
      });
    }
    
    async function fetchSuggestions(query) {
      if (query.length < 2) {
        hideList();
        return;
      }
      
      // Load airports database
      const airports = await loadAirportsDB();
      
      // Search airports
      const airportResults = searchAirports(query, airports, 5);
      
      // Transform to common format
      const airportItems = airportResults.map(ap => ({
        name: ap.n,
        airportName: ap.n,
        city: extractCityName(ap),
        country: ap.o,
        iataCode: ap.i,
        latitude: parseFloat(ap.t),
        longitude: parseFloat(ap.g),
      }));
      
      // Also search Open-Meteo for cities not in airport database
      let cityItems = [];
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const cityResults = (data.results || [])
            .filter(r => {
              // Prefer actual cities over regions
              const code = r.feature_code;
              // PPLC = capital, PPLA = admin center, PPL = populated place
              if (["PPLC", "PPLA", "PPLA2", "PPLA3", "PPL"].includes(code)) {
                return true;
              }
              // Include places with significant population
              if (r.population && r.population >= 50000) {
                return true;
              }
              return false;
            })
            .slice(0, 3)
            .map(r => ({
              name: r.name,
              city: r.name,
              admin1: r.admin1,
              country: r.country,
              latitude: r.latitude,
              longitude: r.longitude,
              iataCode: null,
            }));
          
          // Deduplicate - don't show city if we already have an airport for it
          const seenCities = new Set(airportItems.map(a => (a.city || '').toLowerCase()));
          cityItems = cityResults.filter(c => !seenCities.has((c.city || '').toLowerCase()));
        }
      } catch (e) {
        // Ignore geocoding errors
      }
      
      // Combine: airports first, then cities
      const combined = [...airportItems, ...cityItems.slice(0, 2)];
      showList(combined.slice(0, 6));
    }
    
    input.addEventListener("input", () => {
      const query = input.value.trim();
      // Clear previously selected metadata when user types
      delete input.dataset.selectedCity;
      delete input.dataset.selectedCountry;
      delete input.dataset.selectedIata;
      SELECTED_LOCATION_META.delete(input);
      clearTimeout(autocompleteDebounce);
      autocompleteDebounce = setTimeout(() => fetchSuggestions(query), 150);
    });
    
    input.addEventListener("keydown", (e) => {
      if (!listEl || !results.length) return;
      
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        updateSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        selectItem(results[selectedIndex]);
      } else if (e.key === "Escape") {
        hideList();
      }
    });
    
    input.addEventListener("blur", () => {
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
      input.placeholder = "Destination airport/city";
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
          addDestinationBtn.hidden = false;
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
    ["Date", "Day", "Details", "Day # in City", "PTO"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const tbody = document.createElement("tbody");
    
    // Track days in each city
    const cityDayCount = {};
    let currentCity = null;
    
    for (const day of best.days) {
      const tr = document.createElement("tr");
      const dateObj = parseISODate(day.dateISO);
      const dayOfWeek = dayNames[dateObj.getDay()];
      
      // Track city days
      let daysInCity = "";
      if (day.kind === "city") {
        const cityLabel = day.label.split(" (")[0]; // Extract city name
        if (cityLabel !== currentCity) {
          currentCity = cityLabel;
          cityDayCount[cityLabel] = 0;
        }
        cityDayCount[cityLabel]++;
        daysInCity = String(cityDayCount[cityLabel]);
      }
      
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
        
        // Check if this is an arrival day with spillover from previous night's red-eye
        if (day.isArrivalDay && day.arrivalSpilloverHours > 0) {
          // Show the remaining portion of the flight
          detailsTd.textContent = `${day.label} (~${flightTime}; ${formatHours(day.arrivalSpilloverHours)} remaining)`;
        } else if (day.isDepartureDay) {
          // Departure day - label already contains the flight info
          detailsTd.textContent = day.label;
        } else if (!day.noTravelDay && !day.isArrivalDay) {
          // Regular travel day (full day flight, not a red-eye spillover)
          detailsTd.textContent = `${day.label} (~${flightTime})`;
        } else {
          detailsTd.textContent = day.label;
        }
      } else if (day.kind === "city" && day.arrivalSpilloverHours > 0) {
        // First city day after a red-eye with spillover
        const flightTime = formatHours(day.arrivalFlightDurationHours);
        const spillover = formatHours(day.arrivalSpilloverHours);
        const fromCity = day.arrivalFromCity || "";
        if (fromCity) {
          detailsTd.textContent = `${fromCity} → ${day.label} (~${flightTime}; ${spillover} remaining). Day 1 in ${day.label.split(" (")[0]}`;
        } else {
          detailsTd.textContent = `${day.label} (arrival; ${spillover} remaining from flight)`;
        }
      } else if (day.kind === "city" && day.departureFlightDurationHours) {
        // City day with evening departure - show both daytime and overnight portions
        const flightTime = formatHours(day.departureFlightDurationHours);
        const nightPortion = day.departureNightHours ? formatHours(day.departureNightHours) : null;
        if (nightPortion && day.departureNightHours < day.departureFlightDurationHours) {
          const dayPortion = formatHours(day.departureFlightDurationHours - day.departureNightHours);
          detailsTd.textContent = `${day.label} (~${flightTime}; ${dayPortion} during day, ${nightPortion} overnight)`;
        } else if (nightPortion) {
          detailsTd.textContent = `${day.label} (~${flightTime}; ${nightPortion} overnight)`;
        } else {
          detailsTd.textContent = `${day.label} (~${flightTime})`;
        }
      } else {
        detailsTd.textContent = day.label;
      }
      
      // Days in City column
      const cityDaysTd = document.createElement("td");
      cityDaysTd.textContent = daysInCity || "—";
      
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
      } else if (day.isRedeyeTravel) {
        ptoTd.textContent = "No (Work)";
      } else if (day.kind === "travel") {
        // Travel day on a weekday that doesn't need PTO (likely due to optimization)
        ptoTd.textContent = "No (Work)";
      } else {
        // This should rarely happen - only for edge cases
        ptoTd.textContent = "No (Weekend)";
      }

      tr.appendChild(dateTd);
      tr.appendChild(dayTd);
      tr.appendChild(detailsTd);
      tr.appendChild(cityDaysTd);
      tr.appendChild(ptoTd);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function formatHours(hours) {
    if (!Number.isFinite(hours)) return "—";
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
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

function renderSummary(best, flightTotalHours, home, orderedCities, returnDest) {
  const wrap = $("resultsSummary");
  wrap.innerHTML = "";

  // Route display (full-width row)
  if (home && orderedCities && orderedCities.length) {
    const routeWrap = document.createElement("div");
    routeWrap.className = "routeRow";
    const routeLabel = document.createElement("span");
    routeLabel.className = "routeLabel";
    routeLabel.textContent = "Optimized route:";
    const routeStops = [home, ...orderedCities, returnDest || home];
    const routeText = document.createElement("span");
    routeText.className = "routeText";
    routeText.textContent = routeStops.map((c) => c.cityName || c.displayName).join(" → ");
    routeWrap.appendChild(routeLabel);
    routeWrap.appendChild(routeText);
    wrap.appendChild(routeWrap);
  }

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

  // ---- CSV/XLS Export ----
  
  function exportItineraryToCSV(best, ptoOffSet, holidayInfoMap) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    // CSV Headers
    const headers = ["Date", "Day", "Details", "Day # in City", "PTO"];
    const rows = [headers];
    
    // Track days in each city
    const cityDayCount = {};
    let currentCity = null;
    
    for (const day of best.days) {
      const dateObj = parseISODate(day.dateISO);
      const dayOfWeek = dayNames[dateObj.getDay()];
      
      // Track city days
      let daysInCity = "";
      if (day.kind === "city") {
        const cityLabel = day.label.split(" (")[0]; // Extract city name
        if (cityLabel !== currentCity) {
          currentCity = cityLabel;
          cityDayCount[cityLabel] = 0;
        }
        cityDayCount[cityLabel]++;
        daysInCity = String(cityDayCount[cityLabel]);
      }
      
      // Details - match renderItinerary logic
      let details = day.label;
      if (day.kind === "travel" && day.flightDurationHours) {
        const flightTime = formatHours(day.flightDurationHours);
        if (day.isArrivalDay && day.arrivalSpilloverHours > 0) {
          details = `${day.label} (~${flightTime}; ${formatHours(day.arrivalSpilloverHours)} remaining)`;
        } else if (day.isDepartureDay) {
          details = day.label;
        } else if (!day.noTravelDay && !day.isArrivalDay) {
          details = `${day.label} (~${flightTime})`;
        }
      } else if (day.kind === "city" && day.arrivalSpilloverHours > 0) {
        const flightTime = formatHours(day.arrivalFlightDurationHours);
        const spillover = formatHours(day.arrivalSpilloverHours);
        const fromCity = day.arrivalFromCity || "";
        if (fromCity) {
          details = `${fromCity} → ${day.label} (~${flightTime}; ${spillover} remaining). Day 1 in ${day.label.split(" (")[0]}`;
        } else {
          details = `${day.label} (arrival; ${spillover} remaining from flight)`;
        }
      } else if (day.kind === "city" && day.departureFlightDurationHours) {
        const flightTime = formatHours(day.departureFlightDurationHours);
        const nightPortion = day.departureNightHours ? formatHours(day.departureNightHours) : null;
        if (nightPortion && day.departureNightHours < day.departureFlightDurationHours) {
          const dayPortion = formatHours(day.departureFlightDurationHours - day.departureNightHours);
          details = `${day.label} (~${flightTime}; ${dayPortion} during day, ${nightPortion} overnight)`;
        } else if (nightPortion) {
          details = `${day.label} (~${flightTime}; ${nightPortion} overnight)`;
        } else {
          details = `${day.label} (~${flightTime})`;
        }
      }
      
      // PTO
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const holidayInfo = holidayInfoMap ? holidayInfoMap.get(day.dateISO) : null;
      
      let pto;
      if (day.ptoRequired) {
        pto = "Yes";
      } else if (day.workPlusFly) {
        pto = "No (Work)";
      } else if (isWeekend) {
        pto = "No (Weekend)";
      } else if (holidayInfo) {
        pto = "No (Holiday)";
      } else if (day.isRedeyeTravel) {
        pto = "No (Work)";
      } else if (day.kind === "travel") {
        pto = "No (Work)";
      } else {
        pto = "No (Weekend)";
      }
      
      rows.push([
        day.dateISO,
        dayOfWeek,
        details,
        daysInCity || "—",
        pto
      ]);
    }
    
    // Convert to CSV
    const csvContent = rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',')
    ).join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `travel-itinerary-${best.tripStartISO}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  function exportItineraryToXLS(best, ptoOffSet, holidayInfoMap) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    // Build HTML table for XLS
    let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
    html += '<head>';
    html += '<meta charset="UTF-8">';
    html += '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>';
    html += '<x:Name>Itinerary</x:Name>';
    html += '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>';
    html += '</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
    html += '</head><body>';
    html += '<table border="1">';
    
    // Headers
    html += '<thead><tr>';
    html += '<th>Date</th><th>Day</th><th>Details</th><th>Day # in City</th><th>PTO</th>';
    html += '</tr></thead><tbody>';
    
    // Track days in each city
    const cityDayCount = {};
    let currentCity = null;
    
    for (const day of best.days) {
      const dateObj = parseISODate(day.dateISO);
      const dayOfWeek = dayNames[dateObj.getDay()];
      
      // Track city days
      let daysInCity = "";
      if (day.kind === "city") {
        const cityLabel = day.label.split(" (")[0];
        if (cityLabel !== currentCity) {
          currentCity = cityLabel;
          cityDayCount[cityLabel] = 0;
        }
        cityDayCount[cityLabel]++;
        daysInCity = String(cityDayCount[cityLabel]);
      }
      
      // Details - match renderItinerary logic
      let details = day.label;
      if (day.kind === "travel" && day.flightDurationHours) {
        const flightTime = formatHours(day.flightDurationHours);
        if (day.isArrivalDay && day.arrivalSpilloverHours > 0) {
          details = `${day.label} (~${flightTime}; ${formatHours(day.arrivalSpilloverHours)} remaining)`;
        } else if (day.isDepartureDay) {
          details = day.label;
        } else if (!day.noTravelDay && !day.isArrivalDay) {
          details = `${day.label} (~${flightTime})`;
        }
      } else if (day.kind === "city" && day.arrivalSpilloverHours > 0) {
        const flightTime = formatHours(day.arrivalFlightDurationHours);
        const spillover = formatHours(day.arrivalSpilloverHours);
        const fromCity = day.arrivalFromCity || "";
        if (fromCity) {
          details = `${fromCity} → ${day.label} (~${flightTime}; ${spillover} remaining). Day 1 in ${day.label.split(" (")[0]}`;
        } else {
          details = `${day.label} (arrival; ${spillover} remaining from flight)`;
        }
      } else if (day.kind === "city" && day.departureFlightDurationHours) {
        const flightTime = formatHours(day.departureFlightDurationHours);
        const nightPortion = day.departureNightHours ? formatHours(day.departureNightHours) : null;
        if (nightPortion && day.departureNightHours < day.departureFlightDurationHours) {
          const dayPortion = formatHours(day.departureFlightDurationHours - day.departureNightHours);
          details = `${day.label} (~${flightTime}; ${dayPortion} during day, ${nightPortion} overnight)`;
        } else if (nightPortion) {
          details = `${day.label} (~${flightTime}; ${nightPortion} overnight)`;
        } else {
          details = `${day.label} (~${flightTime})`;
        }
      }
      
      // PTO
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const holidayInfo = holidayInfoMap ? holidayInfoMap.get(day.dateISO) : null;
      
      let pto;
      if (day.ptoRequired) {
        pto = "Yes";
      } else if (day.workPlusFly) {
        pto = "No (Work)";
      } else if (isWeekend) {
        pto = "No (Weekend)";
      } else if (holidayInfo) {
        pto = "No (Holiday)";
      } else if (day.isRedeyeTravel) {
        pto = "No (Work)";
      } else if (day.kind === "travel") {
        pto = "No (Work)";
      } else {
        pto = "No (Weekend)";
      }
      
      html += '<tr>';
      html += `<td>${day.dateISO}</td>`;
      html += `<td>${dayOfWeek}</td>`;
      html += `<td>${details.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
      html += `<td>${daysInCity || "—"}</td>`;
      html += `<td>${pto}</td>`;
      html += '</tr>';
    }
    
    html += '</tbody></table></body></html>';
    
    // Download as XLS
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `travel-itinerary-${best.tripStartISO}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  function exportItinerary(best, ptoOffSet, holidayInfoMap, format) {
    if (format === 'xls') {
      exportItineraryToXLS(best, ptoOffSet, holidayInfoMap);
    } else {
      exportItineraryToCSV(best, ptoOffSet, holidayInfoMap);
    }
  }

  // ---- Main flow ----

  document.addEventListener("DOMContentLoaded", () => {
    const destinationsContainer = $("destinations");
    const addDestinationBtn = $("addDestinationBtn");
    const holidayDefaults = $("holidayDefaults");
    const extraPtoOffContainer = $("extraPtoOffDays");
    const addExtraPtoOffBtn = $("addExtraPtoOffBtn");
    const redeyeCheckbox = $("redeyeOk");
    const redeyeOvernightField = $("redeyeOvernightField");
    
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
    
    // Set default dates
    const today = new Date();
    const todayISO = isoDate(today);
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    const oneMonthISO = isoDate(oneMonthLater);
    
    const startDateInput = $("startDate");
    const endDateInput = $("endDate");
    startDateInput.min = todayISO;
    endDateInput.min = todayISO;
    startDateInput.value = todayISO;
    endDateInput.value = oneMonthISO;

    const specificDateInput = $("specificDate");
    if (specificDateInput) {
      specificDateInput.min = todayISO;
      specificDateInput.value = oneMonthISO;
    }

    // Return city toggle
    const returnCityToggle = $("returnCityToggle");
    const returnCityField = $("returnCityField");
    const returnCityInput = $("returnCity");
    if (returnCityToggle && returnCityField && returnCityInput) {
      returnCityField.style.position = "relative";
      setupCityAutocomplete(returnCityInput, returnCityField);
      returnCityToggle.addEventListener("click", () => {
        const visible = returnCityField.style.display !== "none";
        returnCityField.style.display = visible ? "none" : "";
        returnCityToggle.textContent = visible
          ? "+ Return to a different location"
          : "− Return to home city";
        if (visible) {
          returnCityInput.value = "";
          SELECTED_LOCATION_META.delete(returnCityInput);
          delete returnCityInput.dataset.selectedCity;
          delete returnCityInput.dataset.selectedCountry;
        }
      });
    }

    // Date mode + DOW toggle
    const dateModeSelect = $("dateMode");
    const startDateField = $("startDateField");
    const endDateField = $("endDateField");
    const dowToggle = $("dowToggle");
    const dowDirectionField = $("dowDirectionField");
    const dowDayField = $("dowDayField");
    const specificDirectionField = $("specificDirectionField");
    const specificDateField = $("specificDateField");

    function syncDateModeFields() {
      const mode = dateModeSelect ? dateModeSelect.value : "range";
      const isRange = mode === "range";
      const isSpecific = mode === "specific";
      const dowActive = dowDirectionField && dowDirectionField.style.display !== "none";
      
      if (startDateField) startDateField.style.display = isRange ? "" : "none";
      if (endDateField) endDateField.style.display = isRange ? "" : "none";
      if (dowToggle) dowToggle.style.display = isRange ? "" : "none";
      if (dowDirectionField) dowDirectionField.style.display = isRange && dowActive ? "" : "none";
      if (dowDayField) dowDayField.style.display = isRange && dowActive ? "" : "none";
      if (specificDirectionField) specificDirectionField.style.display = isSpecific ? "" : "none";
      if (specificDateField) specificDateField.style.display = isSpecific ? "" : "none";
    }
    
    if (dowToggle) {
      dowToggle.addEventListener("click", () => {
        const visible = dowDirectionField && dowDirectionField.style.display !== "none";
        if (dowDirectionField) dowDirectionField.style.display = visible ? "none" : "";
        if (dowDayField) dowDayField.style.display = visible ? "none" : "";
        dowToggle.textContent = visible
          ? "+ Depart/arrive on specific day of week"
          : "− Depart/arrive on specific day of week";
      });
    }
    
    syncDateModeFields();
    if (dateModeSelect) dateModeSelect.addEventListener("change", syncDateModeFields);

    // Try to detect user location
    const homeCityInput = $("homeCity");
    const homeCityField = homeCityInput.parentElement;
    homeCityField.style.position = "relative";
    setupCityAutocomplete(homeCityInput, homeCityField);

    function syncRedeyeOvernightVisibility() {
      if (!redeyeOvernightField || !redeyeCheckbox) return;
      redeyeOvernightField.style.display = redeyeCheckbox.checked ? "flex" : "none";
    }
    syncRedeyeOvernightVisibility();
    if (redeyeCheckbox) {
      redeyeCheckbox.addEventListener("change", syncRedeyeOvernightVisibility);
    }

    // Permission-free fallback based on browser timezone, e.g.
    // "America/Los_Angeles" -> "Los Angeles".
    function guessCityFromTimezone() {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        const parts = tz.split("/");
        const last = parts[parts.length - 1] || "";
        const city = last.replace(/_/g, " ").trim();
        return city || null;
      } catch {
        return null;
      }
    }

    const tzCity = guessCityFromTimezone();
    if (tzCity && !homeCityInput.value.trim()) {
      homeCityInput.value = tzCity;
    }
    
    // Attempt geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            // Reverse geocode to get city name
            const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(
              lat
            )}&longitude=${encodeURIComponent(lon)}&language=en&format=json`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              const place = data?.results?.[0];
              const city = place?.name || place?.admin1 || place?.country;
              if (city) {
                homeCityInput.value = city;
              }
            }
          } catch (e) {
            // Silent fail - user can enter manually
          }
        },
        () => {
          // Silent fail - user denied or error
        }
      );
    }

    // Render initial destination row (state is read from DOM on add/remove).
    renderDestinations(destinationsContainer, [{ city: "", stayDays: null }]);

    renderHolidayDefaults(holidayDefaults);
    renderExtraPtoDays(extraPtoOffContainer, 0);

addDestinationBtn.addEventListener("click", () => {
  const current = readDestinationsFromDOM(destinationsContainer);
  if (current.length < 10) current.push({ city: "", stayDays: null });
  if (current.length >= 10) addDestinationBtn.hidden = true;
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
      
      // Hide results section until new results are ready
      const resultsSection = $("resultsSection");
      resultsSection.style.display = "none";

  const homeCityInputEl = $("homeCity");
  const homeCity = homeCityInputEl.value.trim();
  const homeMeta = SELECTED_LOCATION_META.get(homeCityInputEl);
  const homePreferredCity = String(homeMeta?.city || homeCityInputEl.dataset.selectedCity || "").trim();
  const homePreferredCountry = String(homeMeta?.country || homeCityInputEl.dataset.selectedCountry || "").trim();

  const dateMode = ($("dateMode") && $("dateMode").value) || "range";
  const redeyeOK = $("redeyeOk").checked;
  const travelDayThresholdH = (() => { const v = Number($("travelDayThreshold").value); return isNaN(v) ? 3 : v; })();
  const redeyeOvernightH = (() => { const v = Number($("redeyeOvernightHours").value); return isNaN(v) ? 8 : v; })();
  const objective = $("objective").value;
      const extraPtoInputs = Array.from(extraPtoOffContainer.querySelectorAll("input[data-role='extraPtoOff']"))
        .map((el) => el.value)
        .filter(Boolean);

      // Collect destination rows from DOM to keep the UI source of truth.
      const destRows = Array.from(destinationsContainer.querySelectorAll(".destRow"));
      const rawDestinations = destRows.map((row) => {
        const cityInput = row.querySelector("input[data-role='city']");
        const city = cityInput.value.trim();
        const cityMeta = SELECTED_LOCATION_META.get(cityInput);
        const stayDays = Number(row.querySelector("input[data-role='stayDays']").value);
        return {
          city,
          stayDays,
          preferredCity: String(cityMeta?.city || cityInput.dataset.selectedCity || "").trim(),
          preferredCountry: String(cityMeta?.country || cityInput.dataset.selectedCountry || "").trim(),
        };
      });
      const destinationList = rawDestinations.filter((d) => d.city.length > 0);

      // Build effective date window and date constraint from selected date mode.
      let startDateISO, endDateISO, dateConstraint;
      if (dateMode === "specific") {
        const specificDateISO = $("specificDate").value;
        const specificDirection = ($("specificDirection") && $("specificDirection").value) || "depart";
        if (!specificDateISO) {
          errorBox.textContent = "Please enter a specific date.";
          errorBox.style.display = "block";
          return;
        }
        const specificDateObj = parseISODate(specificDateISO);
        const todayCheck = new Date(); todayCheck.setHours(0, 0, 0, 0);
        if (specificDateObj < todayCheck) {
          errorBox.textContent = "The specific date must be today or in the future.";
          errorBox.style.display = "block";
          return;
        }
        const bufferDays = 90;
        if (specificDirection === "depart") {
          startDateISO = specificDateISO;
          endDateISO = isoDate(addDays(specificDateObj, bufferDays));
        } else {
          startDateISO = isoDate(addDays(specificDateObj, -bufferDays));
          endDateISO = specificDateISO;
        }
        dateConstraint = { mode: "specific", direction: specificDirection, date: specificDateISO };
      } else {
        startDateISO = $("startDate").value;
        endDateISO = $("endDate").value;
        const dowDirectionEl = $("dowDirection");
        const dowDayEl = $("dowDay");
        const dowFieldsVisible = dowDirectionEl && dowDirectionEl.style.display !== "none";
        if (dowFieldsVisible) {
          const dowDirection = (dowDirectionEl && dowDirectionEl.value) || "depart";
          const dowDay = parseInt((dowDayEl && dowDayEl.value) ?? "1", 10);
          dateConstraint = { mode: "range+dow", direction: dowDirection, dayOfWeek: dowDay };
        } else {
          dateConstraint = { mode: "range" };
        }
      }

      if (!homeCity) return;
      if (!startDateISO || !endDateISO) return;

      for (const row of destRows) {
        const stayDays = Number(row.querySelector("input[data-role='stayDays']").value);
        if (stayDays < 1) {
          errorBox.textContent = "Each destination city must have at least 1 day of stay.";
          errorBox.style.display = "block";
          return;
        }
      }

      if (destinationList.length === 0) {
        errorBox.textContent = "Please add at least one destination city.";
        errorBox.style.display = "block";
        return;
      }

      // Auto-remove any destination that matches the home city (case-insensitive).
      const homeCityLower = homeCity.toLowerCase().trim();
      const dedupedDestinations = destinationList.filter((d) => d.city.toLowerCase().trim() !== homeCityLower);
      if (dedupedDestinations.length < destinationList.length) {
        // Silently removed home city from destinations; update the list
        destinationList.length = 0;
        dedupedDestinations.forEach((d) => destinationList.push(d));
      }

      if (destinationList.length === 0) {
        errorBox.textContent = "Please add at least one destination city (different from your home city).";
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
      
      if (dateMode !== "specific" && windowStart < todayDate) {
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

      if (dateMode !== "specific" && totalStayDays > windowDays) {
        errorBox.textContent = `Input error: you want ${totalStayDays} city days, but your date window is only ${windowDays} days.`;
        errorBox.style.display = "block";
        return;
      }

      // Validate DOW constraint against the actual feasible start-date range.
      if (dateConstraint?.mode === "range+dow") {
        const { direction, dayOfWeek } = dateConstraint;
        const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        // Estimate minimum trip calendar days (travel + stay) heuristically: stayDays + 2 travel legs.
        const minTripDays = totalStayDays + 2;
        const latestFeasibleStart = addDays(windowEnd, -(minTripDays - 1));
        let found = false;
        if (latestFeasibleStart >= windowStart) {
          if (direction === "depart") {
            // Trip starts on a candidate in [windowStart, latestFeasibleStart].
            let cur = new Date(windowStart);
            while (cur <= latestFeasibleStart) {
              if (cur.getDay() === dayOfWeek) { found = true; break; }
              cur = addDays(cur, 1);
            }
          } else {
            // Trip ends on the target DOW; end dates in [windowStart + minTripDays - 1, windowEnd].
            let cur = addDays(windowStart, minTripDays - 1);
            while (cur <= windowEnd) {
              if (cur.getDay() === dayOfWeek) { found = true; break; }
              cur = addDays(cur, 1);
            }
          }
        }
        if (!found) {
          const dayName = dayNames[dayOfWeek];
          errorBox.textContent = `No feasible ${direction === "depart" ? "departure on" : "return on"} ${dayName} is possible within the selected date range (considering your stay days). Widen the range or choose a different day.`;
          errorBox.style.display = "block";
          return;
        }
      }

      const enabledHolidayIds = new Set(
        Array.from(holidayDefaults.querySelectorAll("input[type='checkbox'][data-holiday-id]")).filter((el) => el.checked).map((el) => el.dataset.holidayId)
      );

      // Cache objects
      const geoCache = loadCache(STORAGE_KEYS.geo);
      const airportCache = {}; //loadCache(STORAGE_KEYS.airport); disable as this can be incorrect
      const flightCache = loadCache(STORAGE_KEYS.flight);

      const loadingEl = $("loadingIndicator");
      try {
        const workBtn = e.submitter;
        if (workBtn && workBtn.disabled !== undefined) workBtn.disabled = true;
        if (loadingEl) loadingEl.style.display = "flex";

        $("resultsSummary").innerHTML = "";
        $("itineraryTableWrap").innerHTML = "";

        const normalizedKey = (s) => {
          const raw = String(s || "").trim();
          if (isIataToken(raw)) return `iata:${raw.toUpperCase()}`;
          return `city:${raw.toLowerCase()}`;
        };

        const resolvedByKey = new Map();
        async function getResolved(input, preferredCity = "", preferredCountry = "") {
          const key = `${normalizedKey(input)}|pc:${preferredCity.toLowerCase()}|co:${preferredCountry.toLowerCase()}`;
          if (resolvedByKey.has(key)) return resolvedByKey.get(key);
          const resolved = await resolveInputToLocation({ input, geoCache, airportCache, preferredCity, preferredCountry });
          resolvedByKey.set(key, resolved);
          return resolved;
        }

        // Resolve home (airport anchor via IATA token, or city -> nearest airport).
        const homeResolved = await getResolved(homeCity, homePreferredCity, homePreferredCountry);
        const homeCityName = homePreferredCity || locationCityLabel(homeResolved, homeCity);
        
        const home = {
          id: "home",
          displayName: homeResolved.displayName,
          cityName: homeCityName,
          country: homeResolved.country,
          airport: homeResolved.airport,
        };

        const rawCities = [];
        for (let idx = 0; idx < destinationList.length; idx++) {
          const d = destinationList[idx];
          const resolved = await getResolved(d.city, d.preferredCity, d.preferredCountry);
          
          // Final authority for rendered city labels:
          // if user selected an autocomplete suggestion, use that selected city directly.
          const cityName = d.preferredCity || locationCityLabel(resolved, d.city);
          
          rawCities.push({
            id: `city_${idx}_${String(d.city).toLowerCase().replace(/\\s+/g, "_")}`,
            displayName: resolved.displayName,
            cityName: cityName,
            country: resolved.country,
            stayDays: d.stayDays,
            airport: resolved.airport,
            _inputCity: d.city,
          });
        }

        // Deduplicate by:
        // 1. Airport IATA code (same airport)
        // 2. City name (from API data)
        // 3. Distance (airports within 50km are same city)
        const homeIata = home.airport?.iataCode;
        
        const seenIata = new Set();
        const seenCities = new Set();
        if (homeIata) seenIata.add(homeIata);
        
        // Normalize city name for comparison
        const normalizeCity = (city) => String(city || "").toLowerCase().trim().replace(/\s+/g, "");
        seenCities.add(normalizeCity(home.cityName));
        
        // Check for duplicates among destinations (not including home)
        const destCitySeen = new Set();
        const destDuplicates = [];
        for (const c of rawCities) {
          const cityKey = normalizeCity(c.cityName);
          if (destCitySeen.has(cityKey)) {
            destDuplicates.push(c._inputCity || c.displayName);
          } else {
            destCitySeen.add(cityKey);
          }
          
          // Also check distance between destinations
          for (const other of rawCities) {
            if (other === c || !c.airport || !other.airport) continue;
            const dist = haversineKm(
              c.airport.latitude, c.airport.longitude,
              other.airport.latitude, other.airport.longitude
            );
            if (dist < 50 && !destDuplicates.includes(c._inputCity || c.displayName)) {
              destDuplicates.push(c._inputCity || c.displayName);
              break;
            }
          }
        }
        
        if (destDuplicates.length > 0) {
          errorBox.textContent = `Cannot submit: Duplicate destinations detected (same city or airports within 50km): ${destDuplicates.join(", ")}. Please remove duplicates before continuing.`;
          errorBox.style.display = "block";
          return;
        }

        // Now check home vs destinations
        const homeRemoved = [];
        for (const c of rawCities) {
          const iata = c.airport?.iataCode;
          const cityKey = normalizeCity(c.cityName);
          const homeCityKey = normalizeCity(home.cityName);
          
          // Check if same as home by IATA, city name, or distance
          if (iata && iata === homeIata) {
            homeRemoved.push(c._inputCity || c.displayName);
            continue;
          }
          
          if (cityKey === homeCityKey) {
            homeRemoved.push(c._inputCity || c.displayName);
            continue;
          }
          
          if (c.airport && home.airport) {
            const dist = haversineKm(
              home.airport.latitude, home.airport.longitude,
              c.airport.latitude, c.airport.longitude
            );
            if (dist < 50) {
              homeRemoved.push(c._inputCity || c.displayName);
            }
          }
        }
        
        const cities = [];
        const removedCityNames = [];
        
        for (const c of rawCities) {
          const iata = c.airport?.iataCode;
          const cityKey = normalizeCity(c.cityName);
          
          // Skip if it's same as home
          if (homeRemoved.includes(c._inputCity || c.displayName)) {
            removedCityNames.push(c._inputCity || c.displayName);
            continue;
          }
          
          const { _inputCity, ...cityWithoutMeta } = c;
          cities.push(cityWithoutMeta);
        }

        if (removedCityNames.length > 0) {
          // Warn the user but don't block — just continue with the deduplicated list.
          errorBox.textContent = `Duplicate location(s) removed (same airport as home or another destination): ${removedCityNames.join(", ")}.`;
          errorBox.style.display = "block";
        }

        if (cities.length === 0) {
          errorBox.textContent = "No unique destinations remain after removing duplicates. Please add destinations different from your home city.";
          errorBox.style.display = "block";
          return;
        }

        // Resolve optional return city.
        let returnDest = null;
        const returnCityEl = $("returnCity");
        const returnCityFieldEl = $("returnCityField");
        const returnCityVisible = returnCityFieldEl && returnCityFieldEl.style.display !== "none";
        if (returnCityVisible && returnCityEl && returnCityEl.value.trim()) {
          const rcInput = returnCityEl.value.trim();
          const rcMeta = SELECTED_LOCATION_META.get(returnCityEl);
          const rcPreferredCity = String(rcMeta?.city || returnCityEl.dataset.selectedCity || "").trim();
          const rcPreferredCountry = String(rcMeta?.country || returnCityEl.dataset.selectedCountry || "").trim();
          const rcResolved = await getResolved(rcInput, rcPreferredCity, rcPreferredCountry);
          const rcCityName = rcPreferredCity || locationCityLabel(rcResolved, rcInput);
          returnDest = {
            id: "returnDest",
            displayName: rcResolved.displayName,
            cityName: rcCityName,
            country: rcResolved.country,
            airport: rcResolved.airport,
          };
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
          redeyeOvernightH,
          returnDest,
          dateConstraint,
        });

        if (!best) {
          let noItineraryMsg = "No feasible itinerary found within the selected date window given your holiday/PTO-off selection. Try widening the date window or adjusting stay days.";
          if (dateConstraint?.mode === "specific" && dateConstraint.direction === "arrive") {
            noItineraryMsg = `No feasible itinerary found: the required trip start date (${dateConstraint.date} minus stay + travel days) falls in the past or outside the allowed window. Please choose a later arrival date.`;
          } else if (dateConstraint?.mode === "specific" && dateConstraint.direction === "depart") {
            noItineraryMsg = `No feasible itinerary found starting on ${dateConstraint.date}. Verify your destinations and stay days fit within a reasonable trip length.`;
          } else if (dateConstraint?.mode === "range+dow") {
            const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
            noItineraryMsg = `No feasible itinerary found: no ${dayNames[dateConstraint.dayOfWeek]} ${dateConstraint.direction === "depart" ? "departure" : "return"} date lines up with your destinations and stay days in the given window.`;
          }
          errorBox.textContent = noItineraryMsg;
          errorBox.style.display = "block";
          return;
        }

        // Use the city order stored in the best simulation result directly — no label parsing needed.
        const orderedCities = best.orderedCities;
        const legList = buildLegs(home, orderedCities, returnDest);

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
              redeyeOvernightH,
              returnDest,
            });
            // Only accept the overridden itinerary if it still fits within the user's end date.
            if (overridden && overridden.days.length && overridden.tripEndISO <= endDateISO) {
              finalBest = overridden;
              totalFlightHours = flightSegments.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
            }
          }
        }

        renderSummary(finalBest, totalFlightHours, home, finalBest.orderedCities || orderedCities, returnDest);
        renderItinerary(finalBest, ptoOffSet, holidayInfoMap);
        
        // Show results section and setup export
        const resultsSection = $("resultsSection");
        resultsSection.style.display = "block";
        
        // Setup export button
        const exportBtn = $("exportBtn");
        const exportFormat = $("exportFormat");
        exportBtn.onclick = () => exportItinerary(finalBest, ptoOffSet, holidayInfoMap, exportFormat.value);
      } catch (err) {
        errorBox.textContent = `Something went wrong: ${err?.message || String(err)}`;
        errorBox.style.display = "block";
      } finally {
        const submitBtn = e.submitter;
        if (submitBtn && submitBtn.disabled !== undefined) submitBtn.disabled = false;
        if (loadingEl) loadingEl.style.display = "none";
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

  function simulateItineraryWithLegDurations({ home, orderedCities, startISO, redeyeOK, ptoOffSet, legDurationsHours, travelDayThresholdH = 3, redeyeOvernightH = 8, returnDest }) {
    const days = [];
    let currentDate = parseISODate(startISO);
    const legs = buildLegs(home, orderedCities, returnDest);
    if (legDurationsHours.length !== legs.length) return null;

    let totalFlightHoursHeuristic = 0;
    let tripDays = 0;
    
    for (let legIdx = 0; legIdx < legs.length; legIdx++) {
      const leg = legs[legIdx];
      const durationHours = legDurationsHours[legIdx];
      if (!Number.isFinite(durationHours)) return null;
      totalFlightHoursHeuristic += durationHours;

      const model = travelBlockModel(durationHours, redeyeOK, travelDayThresholdH, redeyeOvernightH);
      const { nightHours, dayHours } = splitFlightHours(durationHours, !!model.isRedeye, redeyeOvernightH);

      if (model.noTravelDay) {
        if (leg.type === "outbound" && days.length === 0) {
          const d = currentDate;
          const toLabel = leg.to.cityName || leg.to.displayName;
          const fromLabel = leg.from.cityName || leg.from.displayName;
          
          let flightNote;
          if (model.isRedeye && nightHours > 0) {
            flightNote = ` (evening work, then red-eye to ${toLabel} ~${formatHours(durationHours)}, ${formatHours(nightHours)} overnight)`;
          } else {
            flightNote = ` (work, then evening flight to ${toLabel} ~${formatHours(durationHours)})`;
          }
          
          days.push({
            dateISO: isoDate(d),
            kind: "travel",
            label: `${fromLabel} → ${toLabel}${flightNote}`,
            ptoRequired: false,
            workPlusFly: true,
            noTravelDay: true,
            isRedeyeTravel: !!model.isRedeye,
            flightDurationHours: durationHours,
            nightHours: 0,
            dayHours: 0,
            isDepartureDay: true,
            hasNextDaySpillover: model.isRedeye && dayHours > 0,
            spilloverHours: dayHours,
          });
          if (model.isRedeye) currentDate = addDays(currentDate, 1);
        } else if (days.length > 0) {
          const lastDay = days[days.length - 1];
          const toLabel = leg.type === "return" ? (leg.to.cityName || "home") : (leg.to.cityName || leg.to.displayName);
          if (model.isRedeye && nightHours > 0) {
            lastDay.label += ` (evening departure to ${toLabel})`;
            lastDay.departureFlightDurationHours = durationHours;
            lastDay.departureNightHours = nightHours;
          } else {
            lastDay.label += ` (evening flight to ${toLabel} ~${formatHours(durationHours)})`;
          }
        }
      } else {
        if (model.travelDayOnNextDay) {
          const departTo = leg.type === "return" ? (leg.to.cityName || "home") : (leg.to.cityName || leg.to.displayName);
          const fromCity = leg.from.cityName || leg.from.displayName;
          
          if (days.length > 0) {
            days[days.length - 1].label += ` (evening departure to ${departTo})`;
            days[days.length - 1].departureFlightDurationHours = durationHours;
            days[days.length - 1].departureNightHours = nightHours;
          } else {
            days.push({
              dateISO: isoDate(currentDate),
              kind: "travel",
              label: `${fromCity} → ${departTo} (evening departure; ~${formatHours(durationHours)}, ${formatHours(nightHours)} overnight)`,
              ptoRequired: false,
              workPlusFly: true,
              noTravelDay: true,
              isRedeyeTravel: true,
              flightDurationHours: durationHours,
              nightHours: 0,
              dayHours: 0,
              isDepartureDay: true,
              departureNightHours: nightHours,
            });
          }
          currentDate = addDays(currentDate, 1);
        }
        
        for (let t = 0; t < model.travelDays; t++) {
          const d = addDays(currentDate, t);
          const off = ptoOffSet.has(isoDate(d));
          const ptoRequired = isWeekday(d) && !off && model.ptoOffsets.includes(t);
          const isRedeyeTravel = isWeekday(d) && !off && !model.ptoOffsets.includes(t) && redeyeOK;
          
          const fromCity = leg.from.cityName || leg.from.displayName;
          const toCity = leg.to.cityName || leg.to.displayName;
          
          let travelLabel;
          if (model.travelDays === 1) {
            if (model.travelDayOnNextDay && dayHours > 0) {
              travelLabel = `${fromCity} → ${toCity}`;
            } else if (leg.type === "outbound") {
              travelLabel = `Travel: ${fromCity} → ${toCity}`;
            } else if (leg.type === "return") {
              travelLabel = `Return: ${fromCity} → ${toCity}`;
            } else {
              travelLabel = `Travel: ${fromCity} → ${toCity}`;
            }
          } else {
            if (t === 0) {
              travelLabel = `Travel Day 1: Depart ${fromCity}`;
            } else if (t === model.travelDays - 1) {
              travelLabel = `Travel Day ${t + 1}: Arrive ${toCity}`;
            } else {
              travelLabel = `Travel Day ${t + 1}: ${fromCity} → ${toCity}`;
            }
          }
          
          let isArrivalDay = false;
          let arrivalSpilloverHours = 0;
          if (model.travelDayOnNextDay && t === 0) {
            isArrivalDay = true;
            arrivalSpilloverHours = dayHours;
          }
          
          days.push({
            dateISO: isoDate(d),
            kind: "travel",
            label: travelLabel,
            ptoRequired,
            flightDurationHours: durationHours,
            nightHours: 0,
            dayHours: 0,
            fromIata: leg.from.airport?.iataCode,
            toIata: leg.to.airport?.iataCode,
            noTravelDay: false,
            isRedeyeTravel,
            isArrivalDay,
            arrivalSpilloverHours,
          });
        }
        currentDate = addDays(currentDate, model.travelDays);
      }

      if (leg.type !== "return") {
        const lastDayEntry = days.length > 0 ? days[days.length - 1] : null;
        const pendingSpillover = lastDayEntry?.hasNextDaySpillover ? lastDayEntry.spilloverHours : 0;
        const fromLabel = leg.from.cityName || leg.from.displayName;
        
        for (let s = 0; s < leg.to.stayDays; s++) {
          const d = addDays(currentDate, s);
          const off = ptoOffSet.has(isoDate(d));
          let ptoRequired = isWeekday(d) && !off;
          let workPlusFly = false;
          
          let cityLabel = formatCityLabel(leg.to.cityName || leg.to.displayName, leg.to.country);
          let arrivalSpillover = 0;
          let arrivalFlightDuration = 0;
          
          if (s === 0 && pendingSpillover > 0) {
            arrivalSpillover = pendingSpillover;
            arrivalFlightDuration = lastDayEntry?.flightDurationHours || 0;
          }

          days.push({
            dateISO: isoDate(d),
            kind: "city",
            label: cityLabel,
            ptoRequired,
            workPlusFly,
            arrivalSpilloverHours: arrivalSpillover,
            arrivalFlightDurationHours: arrivalFlightDuration,
            arrivalFromCity: s === 0 && pendingSpillover > 0 ? fromLabel : null,
          });
          tripDays++;
        }
        currentDate = addDays(currentDate, leg.to.stayDays);
      }
    }

    const ptoRequiredTotal = days.reduce((sum, x) => sum + (x.ptoRequired ? 1 : 0), 0);
    return {
      days,
      orderedCities,
      ptoRequired: ptoRequiredTotal,
      totalFlightHoursHeuristic,
      tripStartISO: days[0]?.dateISO,
      tripEndISO: days[days.length - 1]?.dateISO,
      tripDays,
    };
  }
})();

