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
  const TRAVEL_THRESHOLDS_H = {
    short: 8, // <= short => 1 calendar travel day
    medium: 14, // <= medium => 2 calendar travel days
  };

  // PTO impact model for multi-day travel blocks (heuristic).
  // We use a simplified rule because we don't have exact departure/arrival times:
  // - single-day travel => 0 PTO (assumes you can work before leaving and after arriving same day)
  // - multi-day travel => redeyeOK reduces PTO impact
  function travelBlockModel(durationHours, redeyeOK) {
    if (durationHours <= TRAVEL_THRESHOLDS_H.short) {
      return { travelDays: 1, ptoOffsets: [] }; // first (and only) travel day consumes no PTO
    }

    if (durationHours <= TRAVEL_THRESHOLDS_H.medium) {
      const travelDays = 2;
      // redeyeOK => count PTO on the *first* travel day only; no PTO on the second
      const ptoOffsets = redeyeOK ? [0] : [0, 1];
      return { travelDays, ptoOffsets };
    }

    const travelDays = 3;
    // Longer flights: redeyeOK reduces PTO impact but doesn't eliminate it entirely.
    const ptoOffsets = redeyeOK ? [0, 1] : [0, 1, 2];
    return { travelDays, ptoOffsets };
  }

  function getDurationHoursFromDistanceKm(distanceKm) {
    // Add a small factor for taxiing, climb/descent, routing inefficiencies.
    const duration = (distanceKm / AVG_SPEED_KMH) * 1.12 + 0.25;
    return Math.max(0.5, duration);
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
    { id: "new_years", name: "New Year's Day", type: "fixed_observed", month: 0, day: 1 },
    { id: "mlk", name: "Martin Luther King Jr. Day", type: "nth_weekday", month: 0, weekday: 1, nth: 3 }, // 3rd Mon Jan
    { id: "presidents", name: "Presidents Day", type: "nth_weekday", month: 1, weekday: 1, nth: 3 }, // 3rd Mon Feb
    { id: "memorial", name: "Memorial Day", type: "last_weekday", month: 4, weekday: 1 }, // last Mon May
    { id: "juneteenth", name: "Juneteenth", type: "fixed_observed", month: 5, day: 19 },
    { id: "independence", name: "Independence Day", type: "fixed_observed", month: 6, day: 4 },
    { id: "labor", name: "Labor Day", type: "nth_weekday", month: 8, weekday: 1, nth: 1 }, // 1st Mon Sep
    { id: "veterans", name: "Veterans Day", type: "fixed_observed", month: 10, day: 11 },
    { id: "thanksgiving", name: "Thanksgiving", type: "nth_weekday", month: 10, weekday: 4, nth: 4 }, // 4th Thu Nov
    { id: "christmas", name: "Christmas Day", type: "fixed_observed", month: 11, day: 25 },
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

    // Extra PTO-off dates are treated as exact calendar dates.
    for (const iso of extraPtoOffDates) {
      const d = parseISODate(iso);
      if (d >= windowStart && d <= windowEnd) ptoOff.add(iso);
    }

    return ptoOff;
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

  function simulateItinerary({ home, orderedCities, startISO, redeyeOK, ptoOffSet }) {
    // Produce day-by-day entries + PTO required + heuristic flight hours.
    const days = [];
    let currentDate = parseISODate(startISO);
    let totalFlightHoursHeuristic = 0;

    const legs = buildLegs(home, orderedCities);
    for (let legIdx = 0; legIdx < legs.length; legIdx++) {
      const leg = legs[legIdx];

      const distanceKm = estimateLegDistanceKm(leg.from.airport, leg.to.airport);
      const durationHours = getDurationHoursFromDistanceKm(distanceKm);
      totalFlightHoursHeuristic += durationHours;

      const model = travelBlockModel(durationHours, redeyeOK);
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
                ? `Return travel: ${leg.from.displayName} -> ${leg.to.displayName}`
                : `Travel: ${leg.from.displayName} -> ${leg.to.displayName}`,
          ptoRequired,
        });
      }
      currentDate = addDays(currentDate, model.travelDays);

      // After travel, if the arrival is a city (not home), add stay days.
      if (leg.to !== home) {
        for (let s = 0; s < leg.to.stayDays; s++) {
          const d = addDays(currentDate, s);
          const off = ptoOffSet.has(isoDate(d));
          const ptoRequired = isWeekday(d) && !off;
          days.push({
            dateISO: isoDate(d),
            kind: "city",
            label: `${leg.to.displayName} (${leg.to.country || "—"})`,
            ptoRequired,
          });
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
      // Store for recomputation if we fetch real flight durations later.
      heuristicTravelByLeg: legs.map((leg) => {
        const distanceKm = estimateLegDistanceKm(leg.from.airport, leg.to.airport);
        const durationHours = getDurationHoursFromDistanceKm(distanceKm);
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

  function computeTotalCalendarDaysHeuristic({ home, orderedCities, redeyeOK }) {
    // We need a fixed template length for feasibility pruning.
    const legs = buildLegs(home, orderedCities);
    let total = 0;
    for (const leg of legs) {
      const distanceKm = estimateLegDistanceKm(leg.from.airport, leg.to.airport);
      const durationHours = getDurationHoursFromDistanceKm(distanceKm);
      const model = travelBlockModel(durationHours, redeyeOK);
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
        const distanceKm = estimateLegDistanceKm(leg.from.airport, leg.to.airport);
        sum += getDurationHoursFromDistanceKm(distanceKm);
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

  function optimizeOrderAndDates({ home, cities, windowStartISO, windowEndISO, redeyeOK, ptoOffSet, objective }) {
    const n = cities.length;
    if (n === 0) return null;

    let best = null;
    const capForExact = 8;
    const START_CANDIDATE_CAP = 60;
    if (n <= capForExact) {
      const orders = permute(cities);
      for (const orderedCities of orders) {
        const totalDaysNeeded = computeTotalCalendarDaysHeuristic({ home, orderedCities, redeyeOK });
        const startCandidates = generateStartCandidates({ windowStartISO, windowEndISO, totalCalendarDaysNeeded: totalDaysNeeded });
        const candidatesCapped = capCandidates(startCandidates, START_CANDIDATE_CAP);
        for (const startISO of candidatesCapped) {
          const sim = simulateItinerary({ home, orderedCities, startISO, redeyeOK, ptoOffSet });
          best = compareItineraries(best, sim, objective);
        }
      }
    } else {
      // For > 8 cities: heuristic route only. Start date still optimized by PTO.
      const route = heuristicOrder({ home, cities });
      const totalDaysNeeded = computeTotalCalendarDaysHeuristic({ home, orderedCities: route, redeyeOK });
      const startCandidates = generateStartCandidates({ windowStartISO, windowEndISO, totalCalendarDaysNeeded: totalDaysNeeded });
      const candidatesCapped = capCandidates(startCandidates, START_CANDIDATE_CAP);
      for (const startISO of candidatesCapped) {
        const sim = simulateItinerary({ home, orderedCities: route, startISO, redeyeOK, ptoOffSet });
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
      return { city, stayDays: Number.isFinite(stayDays) && stayDays > 0 ? stayDays : 5 };
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
      cityCell.appendChild(input);

      const daysCell = document.createElement("div");
      const daysInput = document.createElement("input");
      daysInput.type = "number";
      daysInput.min = "1";
      daysInput.step = "1";
      daysInput.value = d.stayDays || 5;
      daysInput.dataset.role = "stayDays";
      daysInput.title = "How many full days to spend in this city (travel days are handled separately).";
      daysCell.appendChild(daysInput);

      const removeCell = document.createElement("div");
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "smallBtn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        const current = readDestinationsFromDOM(container);
        current.splice(idx, 1);
        renderDestinations(container, current);
      });
      removeCell.appendChild(removeBtn);

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
    removeBtn.className = "smallBtn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => row.remove());

    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  function renderItinerary(best, ptoOffSet) {
    const wrap = $("itineraryTableWrap");
    wrap.innerHTML = "";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Date", "Type", "Details", "PTO"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const day of best.days) {
      const tr = document.createElement("tr");
      const dateTd = document.createElement("td");
      dateTd.textContent = day.dateISO;
      const typeTd = document.createElement("td");
      typeTd.textContent = day.kind === "travel" ? "Travel" : "City";
      const detailsTd = document.createElement("td");
      detailsTd.textContent = day.label;
      const ptoTd = document.createElement("td");
      ptoTd.textContent = day.ptoRequired ? "Yes" : "No";

      tr.appendChild(dateTd);
      tr.appendChild(typeTd);
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

  function formatMinutes(minutes) {
    if (!Number.isFinite(minutes)) return "—";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  function renderSegments(segments) {
    const wrap = $("segmentsWrap");
    wrap.innerHTML = "";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Leg", "From", "To", "Estimated flight", "Duration source"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");

    for (const s of segments) {
      const tr = document.createElement("tr");
      const legTd = document.createElement("td");
      legTd.textContent = s.legLabel;
      const fromTd = document.createElement("td");
      fromTd.textContent = s.from;
      const toTd = document.createElement("td");
      toTd.textContent = s.to;
      const durTd = document.createElement("td");
      durTd.textContent = s.durationText;
      const srcTd = document.createElement("td");
      srcTd.textContent = s.sourceLabel;
      tr.appendChild(legTd);
      tr.appendChild(fromTd);
      tr.appendChild(toTd);
      tr.appendChild(durTd);
      tr.appendChild(srcTd);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function renderSummary(best, flightTotalHours) {
    const wrap = $("resultsSummary");

    wrap.innerHTML = "";
    const cells = [
      { k: "Best start", v: best.tripStartISO },
      { k: "Trip ends", v: best.tripEndISO },
      { k: "PTO required", v: String(best.ptoRequired) },
      { k: "Trip length (calendar days)", v: String(best.days.length) },
      { k: "Total travel time (flight est.)", v: formatHours(flightTotalHours) },
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

    // Render initial destination row (state is read from DOM on add/remove).
    renderDestinations(destinationsContainer, [{ city: "", stayDays: 5 }]);

    renderHolidayDefaults(holidayDefaults);
    renderExtraPtoDays(extraPtoOffContainer, 0);

    addDestinationBtn.addEventListener("click", () => {
      const current = readDestinationsFromDOM(destinationsContainer);
      current.push({ city: "", stayDays: 5 });
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
        $("segmentsWrap").innerHTML = "";

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

        const segmentsHeuristic = [];
        const legList = buildLegs(home, orderedCities);
        for (let i = 0; i < legList.length; i++) {
          const leg = legList[i];
          const distanceKm = estimateLegDistanceKm(leg.from.airport, leg.to.airport);
          const durationHours = getDurationHoursFromDistanceKm(distanceKm);
          segmentsHeuristic.push({
            legLabel: i + 1,
            from: leg.from.displayName,
            to: leg.to.displayName,
            durationText: formatHours(durationHours),
            sourceLabel: "Heuristic (distance/speed)",
            durationMinutes: durationHours * 60,
          });
        }

        let finalBest = best;
        let totalFlightHours = best.totalFlightHoursHeuristic;

        // Optional: fetch real-ish flight durations for segment display (AeroDataBox).
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
                legLabel: i + 1,
                from: leg.from.displayName,
                to: leg.to.displayName,
                durationText: formatMinutes(minutes),
                sourceLabel: "AeroDataBox distance-time",
                durationMinutes: minutes,
                durationHours: hours,
              });
            } catch (err) {
              const distanceKm = estimateLegDistanceKm(leg.from.airport, leg.to.airport);
              const durationHours = getDurationHoursFromDistanceKm(distanceKm);
              flightSegments.push({
                legLabel: i + 1,
                from: leg.from.displayName,
                to: leg.to.displayName,
                durationText: formatHours(durationHours),
                sourceLabel: `Fallback (AeroDataBox error)`,
                durationMinutes: durationHours * 60,
                durationHours,
              });
            }
          }

          renderSegments(flightSegments);

          // If we managed to get at least 1 real duration, recompute travel blocks for transparency.
          // We require all legs to have parseable minutes; otherwise keep heuristic itinerary.
          const allMinutesOk = flightSegments.every((s) => Number.isFinite(s.durationMinutes));
          if (allMinutesOk) {
            // Re-simulate itinerary using real duration-based travel blocks.
            // We re-run simulation but with overridden durationHours per leg.
            const overridden = simulateItineraryWithLegDurations({
              home,
              orderedCities,
              startISO: best.tripStartISO,
              redeyeOK,
              ptoOffSet,
              legDurationsHours: flightSegments.map((s) => s.durationMinutes / 60),
            });
            // Only accept the overridden itinerary if it still fits within the user's end date.
            if (overridden && overridden.days.length && overridden.tripEndISO <= endDateISO) {
              finalBest = overridden;
              totalFlightHours = flightSegments.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
            }
          }
        } else {
          renderSegments(segmentsHeuristic);
        }

        renderSummary(finalBest, totalFlightHours);
        renderItinerary(finalBest, ptoOffSet);
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

  function simulateItineraryWithLegDurations({ home, orderedCities, startISO, redeyeOK, ptoOffSet, legDurationsHours }) {
    const days = [];
    let currentDate = parseISODate(startISO);
    const legs = buildLegs(home, orderedCities);
    if (legDurationsHours.length !== legs.length) return null;

    let totalFlightHoursHeuristic = 0;
    for (let legIdx = 0; legIdx < legs.length; legIdx++) {
      const leg = legs[legIdx];
      const durationHours = legDurationsHours[legIdx];
      if (!Number.isFinite(durationHours)) return null;
      totalFlightHoursHeuristic += durationHours;

      const model = travelBlockModel(durationHours, redeyeOK);
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
                ? `Return travel: ${leg.from.displayName} -> ${leg.to.displayName}`
                : `Travel: ${leg.from.displayName} -> ${leg.to.displayName}`,
          ptoRequired,
        });
      }
      currentDate = addDays(currentDate, model.travelDays);

      if (leg.to !== home) {
        for (let s = 0; s < leg.to.stayDays; s++) {
          const d = addDays(currentDate, s);
          const off = ptoOffSet.has(isoDate(d));
          const ptoRequired = isWeekday(d) && !off;
          days.push({
            dateISO: isoDate(d),
            kind: "city",
            label: `${leg.to.displayName} (${leg.to.country || "—"})`,
            ptoRequired,
          });
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
    };
  }
})();

