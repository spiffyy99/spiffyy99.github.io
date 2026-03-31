function computeBestLayoverRoute(startCode, endCode, airportGraph) {
    const start = airportGraph[startCode];
    const end = airportGraph[endCode];
  
    if (!start || !end) {
      return {
        type: "invalid",
        reason: "Missing start or end airport in graph",
        legs: [],
        estimatedHours: null
      };
    }
  
    if (startCode === endCode) {
      return {
        type: "same_airport",
        legs: [startCode],
        estimatedHours: 0
      };
    }
  
    // Fast membership check for the origin routes
    const startRoutes = new Set(start.r || []);
  
    // Direct flight
    if (startRoutes.has(endCode)) {
      const directDistanceKm = haversineKm(start, end);
      return {
        type: "direct",
        legs: [startCode, endCode],
        estimatedHours: estimateFlightHours(directDistanceKm),
        distanceKm: round1(directDistanceKm)
      };
    }
  
    const directDistanceKm = haversineKm(start, end);
  
    let best = null;
  
    for (const hubCode of start.r || []) {
      if (hubCode === endCode) continue;
  
      const hub = airportGraph[hubCode];
      if (!hub) continue;
  
      // Only use medium/large airports as layover hubs
      if (hub.s !== "M" && hub.s !== "L") continue;
  
      // Must have direct onward route to final destination
      const hubRoutes = new Set(hub.r || []);
      if (!hubRoutes.has(endCode)) continue;
  
      const leg1DistanceKm = haversineKm(start, hub);
      const leg2DistanceKm = haversineKm(hub, end);
  
      // Path stretch: how inefficient is this compared to direct?
      const stretch = (leg1DistanceKm + leg2DistanceKm) / directDistanceKm;
  
      // Large hubs get more tolerance than medium hubs
      const maxStretch = hub.s === "L" ? 1.6 : 1.4;
      if (stretch > maxStretch) continue;
  
      // Optional sanity check:
      // On long routes, reject very tiny first hops.
      if (directDistanceKm > 3000 && leg1DistanceKm < 500) continue;
  
      const leg1Hours = estimateFlightHours(leg1DistanceKm);
      const leg2Hours = estimateFlightHours(leg2DistanceKm);
  
      // Simple layover heuristic
      const layoverHours = hub.s === "L" ? 2.5 : 2.0;
  
      const estimatedHours = leg1Hours + layoverHours + leg2Hours;
  
      // Prefer shorter total time, smaller detour, and stronger hubs
      const hubBonus = Math.min((hub.d || 0) / 100, 1.0);
      const score = estimatedHours + (stretch - 1.0) * 4 - hubBonus;
  
      const candidate = {
        type: "one_stop",
        hub: hubCode,
        legs: [startCode, hubCode, endCode],
        estimatedHours,
        leg1Hours,
        leg2Hours,
        layoverHours,
        distanceKm: round1(leg1DistanceKm + leg2DistanceKm),
        stretch: round3(stretch),
        score: round3(score)
      };
  
      if (!best || candidate.score < best.score) {
        best = candidate;
      }
    }
  
    if (best) {
      return {
        ...best,
        estimatedHours: round1(best.estimatedHours),
        leg1Hours: round1(best.leg1Hours),
        leg2Hours: round1(best.leg2Hours),
        layoverHours: round1(best.layoverHours)
      };
    }
  
    return {
      type: "no_simple_route",
      reason: "No direct or reasonable 1-stop route found",
      legs: [startCode, endCode],
      estimatedHours: null
    };
  }
  