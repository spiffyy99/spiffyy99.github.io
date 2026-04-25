/* Vibe Visa & Entry Briefing — vanilla JS, no build step.
   Loads countries.json, takes user passports + destinations, picks the best
   passport per destination, and renders a visa briefing. */

(function () {
  const $ = (id) => document.getElementById(id);

  // -------- Passport catalog (a curated common set) ----------
  // Each entry: code (ISO-2), name, flag emoji.
  const PASSPORTS = [
    ["US", "United States", "\uD83C\uDDFA\uD83C\uDDF8"],
    ["CA", "Canada", "\uD83C\uDDE8\uD83C\uDDE6"],
    ["MX", "Mexico", "\uD83C\uDDF2\uD83C\uDDFD"],
    ["GB", "United Kingdom", "\uD83C\uDDEC\uD83C\uDDE7"],
    ["IE", "Ireland", "\uD83C\uDDEE\uD83C\uDDEA"],
    ["AU", "Australia", "\uD83C\uDDE6\uD83C\uDDFA"],
    ["NZ", "New Zealand", "\uD83C\uDDF3\uD83C\uDDFF"],
    ["SG", "Singapore", "\uD83C\uDDF8\uD83C\uDDEC"],
    ["JP", "Japan", "\uD83C\uDDEF\uD83C\uDDF5"],
    ["KR", "South Korea", "\uD83C\uDDF0\uD83C\uDDF7"],
    ["CN", "China", "\uD83C\uDDE8\uD83C\uDDF3"],
    ["HK", "Hong Kong (SAR)", "\uD83C\uDDED\uD83C\uDDF0"],
    ["TW", "Taiwan", "\uD83C\uDDF9\uD83C\uDDFC"],
    ["IN", "India", "\uD83C\uDDEE\uD83C\uDDF3"],
    ["MY", "Malaysia", "\uD83C\uDDF2\uD83C\uDDFE"],
    ["TH", "Thailand", "\uD83C\uDDF9\uD83C\uDDED"],
    ["ID", "Indonesia", "\uD83C\uDDEE\uD83C\uDDE9"],
    ["VN", "Vietnam", "\uD83C\uDDFB\uD83C\uDDF3"],
    ["PH", "Philippines", "\uD83C\uDDF5\uD83C\uDDED"],
    ["AE", "United Arab Emirates", "\uD83C\uDDE6\uD83C\uDDEA"],
    ["SA", "Saudi Arabia", "\uD83C\uDDF8\uD83C\uDDE6"],
    ["IL", "Israel", "\uD83C\uDDEE\uD83C\uDDF1"],
    ["TR", "Türkiye", "\uD83C\uDDF9\uD83C\uDDF7"],
    ["RU", "Russia", "\uD83C\uDDF7\uD83C\uDDFA"],
    ["UA", "Ukraine", "\uD83C\uDDFA\uD83C\uDDE6"],
    ["ZA", "South Africa", "\uD83C\uDDFF\uD83C\uDDE6"],
    ["NG", "Nigeria", "\uD83C\uDDF3\uD83C\uDDEC"],
    ["KE", "Kenya", "\uD83C\uDDF0\uD83C\uDDEA"],
    ["EG", "Egypt", "\uD83C\uDDEA\uD83C\uDDEC"],
    ["BR", "Brazil", "\uD83C\uDDE7\uD83C\uDDF7"],
    ["AR", "Argentina", "\uD83C\uDDE6\uD83C\uDDF7"],
    ["CL", "Chile", "\uD83C\uDDE8\uD83C\uDDF1"],
    ["CO", "Colombia", "\uD83C\uDDE8\uD83C\uDDF4"],
    ["PE", "Peru", "\uD83C\uDDF5\uD83C\uDDEA"],
    // EU members (each individually selectable)
    ["AT", "Austria (EU)", "\uD83C\uDDE6\uD83C\uDDF9"],
    ["BE", "Belgium (EU)", "\uD83C\uDDE7\uD83C\uDDEA"],
    ["BG", "Bulgaria (EU)", "\uD83C\uDDE7\uD83C\uDDEC"],
    ["HR", "Croatia (EU)", "\uD83C\uDDED\uD83C\uDDF7"],
    ["CY", "Cyprus (EU)", "\uD83C\uDDE8\uD83C\uDDFE"],
    ["CZ", "Czechia (EU)", "\uD83C\uDDE8\uD83C\uDDFF"],
    ["DK", "Denmark (EU)", "\uD83C\uDDE9\uD83C\uDDF0"],
    ["EE", "Estonia (EU)", "\uD83C\uDDEA\uD83C\uDDEA"],
    ["FI", "Finland (EU)", "\uD83C\uDDEB\uD83C\uDDEE"],
    ["FR", "France (EU)", "\uD83C\uDDEB\uD83C\uDDF7"],
    ["DE", "Germany (EU)", "\uD83C\uDDE9\uD83C\uDDEA"],
    ["GR", "Greece (EU)", "\uD83C\uDDEC\uD83C\uDDF7"],
    ["HU", "Hungary (EU)", "\uD83C\uDDED\uD83C\uDDFA"],
    ["IT", "Italy (EU)", "\uD83C\uDDEE\uD83C\uDDF9"],
    ["LV", "Latvia (EU)", "\uD83C\uDDF1\uD83C\uDDFB"],
    ["LT", "Lithuania (EU)", "\uD83C\uDDF1\uD83C\uDDF9"],
    ["LU", "Luxembourg (EU)", "\uD83C\uDDF1\uD83C\uDDFA"],
    ["MT", "Malta (EU)", "\uD83C\uDDF2\uD83C\uDDF9"],
    ["NL", "Netherlands (EU)", "\uD83C\uDDF3\uD83C\uDDF1"],
    ["PL", "Poland (EU)", "\uD83C\uDDF5\uD83C\uDDF1"],
    ["PT", "Portugal (EU)", "\uD83C\uDDF5\uD83C\uDDF9"],
    ["RO", "Romania (EU)", "\uD83C\uDDF7\uD83C\uDDF4"],
    ["SK", "Slovakia (EU)", "\uD83C\uDDF8\uD83C\uDDF0"],
    ["SI", "Slovenia (EU)", "\uD83C\uDDF8\uD83C\uDDEE"],
    ["ES", "Spain (EU)", "\uD83C\uDDEA\uD83C\uDDF8"],
    ["SE", "Sweden (EU)", "\uD83C\uDDF8\uD83C\uDDEA"],
  ];
  const PASSPORT_BY_CODE = new Map(PASSPORTS.map(([c, n, f]) => [c, { code: c, name: n, flag: f }]));

  // -------- Theme toggle (persisted) --------
  const themeToggle = $("themeToggle");
  const themeIcon = $("themeIcon");
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    if (themeIcon) themeIcon.innerHTML = t === "dark" ? "&#9728;" : "&#9790;";
  }
  applyTheme(localStorage.getItem("immigration:theme") || "light");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem("immigration:theme", cur);
      applyTheme(cur);
    });
  }

  // -------- Data load --------
  let COUNTRIES_DB = null;
  let GROUP_EXPANSIONS = {};

  async function loadCountries() {
    if (COUNTRIES_DB) return COUNTRIES_DB;
    const res = await fetch("./countries.json");
    if (!res.ok) throw new Error(`Failed to load countries.json (${res.status})`);
    const data = await res.json();
    COUNTRIES_DB = data;
    GROUP_EXPANSIONS = data.passportGroups || {};
    return COUNTRIES_DB;
  }

  // -------- Passport selection ----------
  const passportChips = $("passportChips");
  const passportSelect = $("passportSelect");
  const addPassportBtn = $("addPassportBtn");
  const SELECTED_PASSPORTS = new Set();

  function populatePassportSelect() {
    passportSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a passport…";
    placeholder.disabled = true;
    placeholder.selected = true;
    passportSelect.appendChild(placeholder);
    for (const [code, name, flag] of PASSPORTS) {
      if (SELECTED_PASSPORTS.has(code)) continue;
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = `${flag}  ${name}`;
      passportSelect.appendChild(opt);
    }
  }

  function renderPassportChips() {
    passportChips.innerHTML = "";
    if (SELECTED_PASSPORTS.size === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.style.margin = "0";
      empty.textContent = "No passports added yet.";
      passportChips.appendChild(empty);
      return;
    }
    for (const code of SELECTED_PASSPORTS) {
      const p = PASSPORT_BY_CODE.get(code);
      if (!p) continue;
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<span class="chip-flag">${p.flag}</span><span>${p.name}</span>`;
      const x = document.createElement("button");
      x.type = "button";
      x.className = "chip-remove";
      x.setAttribute("aria-label", `Remove ${p.name}`);
      x.textContent = "\u00D7";
      x.addEventListener("click", () => {
        SELECTED_PASSPORTS.delete(code);
        renderPassportChips();
        populatePassportSelect();
        // Re-render destination country selects so available list stays fresh.
      });
      chip.appendChild(x);
      passportChips.appendChild(chip);
    }
  }

  addPassportBtn.addEventListener("click", () => {
    const v = passportSelect.value;
    if (!v) return;
    SELECTED_PASSPORTS.add(v);
    renderPassportChips();
    populatePassportSelect();
  });

  // -------- Destination rows ----------
  const destinationsContainer = $("destinations");
  const addDestinationBtn = $("addDestinationBtn");
  const MAX_DESTINATIONS = 10;

  function buildDestinationRow(initial = {}) {
    const row = document.createElement("div");
    row.className = "destinationRow";

    // Country select
    const fCountry = document.createElement("div");
    fCountry.className = "destField destField--country";
    const lblC = document.createElement("label");
    lblC.textContent = "Country";
    const sel = document.createElement("select");
    sel.dataset.role = "country";
    sel.innerHTML = `<option value="" disabled ${initial.code ? "" : "selected"}>Select…</option>` +
      (COUNTRIES_DB.countries
        .map((c) => `<option value="${c.code}" ${initial.code === c.code ? "selected" : ""}>${c.name}</option>`)
        .join(""));
    fCountry.appendChild(lblC);
    fCountry.appendChild(sel);

    // Days
    const fDays = document.createElement("div");
    fDays.className = "destField";
    const lblD = document.createElement("label");
    lblD.textContent = "Days";
    const days = document.createElement("input");
    days.type = "number";
    days.min = "1";
    days.max = "3650";
    days.value = initial.days != null ? String(initial.days) : "14";
    days.dataset.role = "days";
    fDays.appendChild(lblD);
    fDays.appendChild(days);

    // Multi-entry checkbox
    const lblM = document.createElement("label");
    lblM.className = "destCheckbox";
    const multi = document.createElement("input");
    multi.type = "checkbox";
    multi.dataset.role = "multi";
    if (initial.multi) multi.checked = true;
    lblM.appendChild(multi);
    lblM.appendChild(document.createTextNode("Multi-entry"));

    // Work checkbox
    const lblW = document.createElement("label");
    lblW.className = "destCheckbox";
    const work = document.createElement("input");
    work.type = "checkbox";
    work.dataset.role = "work";
    if (initial.work) work.checked = true;
    lblW.appendChild(work);
    lblW.appendChild(document.createTextNode("Want to work there"));

    // Remove
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "removeDestBtn";
    rm.title = "Remove";
    rm.textContent = "\u00D7";
    rm.addEventListener("click", () => {
      row.remove();
      addDestinationBtn.hidden = false;
    });

    row.append(fCountry, fDays, lblM, lblW, rm);
    return row;
  }

  function addDestinationRow(initial) {
    if (destinationsContainer.children.length >= MAX_DESTINATIONS) return;
    destinationsContainer.appendChild(buildDestinationRow(initial));
    if (destinationsContainer.children.length >= MAX_DESTINATIONS) {
      addDestinationBtn.hidden = true;
    }
  }

  addDestinationBtn.addEventListener("click", () => addDestinationRow());

  // -------- Matching logic ----------

  // Expand a passportGroups entry from a rule into a list of country codes
  // (or a wildcard token). Returns { codes: Set, wildcard: bool, conditional: bool }.
  function expandRulePassportGroups(groups) {
    const out = new Set();
    let wildcard = false;
    let hasConditional = false;
    for (const g of groups || []) {
      if (g === "*") { wildcard = true; continue; }
      if (typeof g === "string" && g.startsWith("HAS_")) { hasConditional = true; continue; }
      if (GROUP_EXPANSIONS[g]) {
        for (const c of GROUP_EXPANSIONS[g]) out.add(c);
        continue;
      }
      out.add(g);
    }
    return { codes: out, wildcard, conditional: hasConditional };
  }

  // Does this rule apply to the given passport (ignoring conditional groups)?
  function ruleAppliesTo(rule, passportCode) {
    const exp = expandRulePassportGroups(rule.passportGroups);
    if (exp.wildcard) return true;
    return exp.codes.has(passportCode);
  }

  function entriesAllowMultiple(rule) {
    return rule.entries !== "single";
  }

  function ruleSatisfiesDays(rule, days) {
    if (rule.durationDays == null) return true;
    return rule.durationDays >= days;
  }

  function ruleSatisfiesEntries(rule, wantsMultiple) {
    if (!wantsMultiple) return true;
    return entriesAllowMultiple(rule);
  }

  // Compare two candidates (lower is better). Lower rank wins; on tie, longer
  // durationDays wins; on tie, multi-entry wins.
  function candidateBetter(a, b) {
    if (b == null) return true;
    if (a.rule.rank !== b.rule.rank) return a.rule.rank < b.rule.rank;
    const ad = a.rule.durationDays || 0;
    const bd = b.rule.durationDays || 0;
    if (ad !== bd) return ad > bd;
    return entriesAllowMultiple(a.rule) && !entriesAllowMultiple(b.rule);
  }

  // Find the best (passport, rule) pair for one purpose, applying days+entries
  // hard filters. Also returns the best alternative that would have qualified
  // if either days or entries were relaxed (used for explanatory notes).
  function findBestMatch(country, passports, days, wantsMultiple, purpose) {
    let best = null;
    let bestIgnoringDays = null;     // would have worked with shorter stay
    let bestIgnoringEntries = null;  // would have worked if single-entry OK
    let bestIgnoringBoth = null;     // any rule for this purpose at all

    for (const passport of passports) {
      for (const rule of country.visaRules) {
        if (rule.purpose !== purpose) continue;
        if (!ruleAppliesTo(rule, passport)) continue;
        const cand = { passport, rule };

        if (candidateBetter(cand, bestIgnoringBoth)) bestIgnoringBoth = cand;

        const daysOK = ruleSatisfiesDays(rule, days);
        const entriesOK = ruleSatisfiesEntries(rule, wantsMultiple);

        if (daysOK && entriesOK) {
          if (candidateBetter(cand, best)) best = cand;
        }
        if (entriesOK && !daysOK) {
          if (candidateBetter(cand, bestIgnoringDays)) bestIgnoringDays = cand;
        }
        if (daysOK && !entriesOK) {
          if (candidateBetter(cand, bestIgnoringEntries)) bestIgnoringEntries = cand;
        }
      }
    }
    return { best, bestIgnoringDays, bestIgnoringEntries, bestIgnoringBoth };
  }

  // -------- Country flag emoji from ISO-2 code --------
  function flagFromCode(code) {
    if (!code || code.length !== 2) return "";
    const A = 0x1F1E6;
    const a = "A".charCodeAt(0);
    return String.fromCodePoint(A + code.charCodeAt(0) - a, A + code.charCodeAt(1) - a);
  }

  // -------- Pretty labels for visa types / methods / entries ----------
  const VISA_TYPE_LABELS = {
    visa_free: "Visa free",
    visa_free_schengen: "Visa free (Schengen)",
    visa_on_arrival: "Visa on arrival",
    evisa: "eVisa",
    evisa_or_tourist_visa: "eVisa or tourist visa",
    evisa_or_visitor_visa: "eVisa or visitor visa",
    tourist_visa: "Tourist visa",
    visitor_visa: "Visitor visa",
    schengen_short_stay_visa: "Schengen short-stay visa",
    visa_exempt_with_third_country_visa: "Visa-exempt (with qualifying 3rd-country visa)",
    digital_nomad_visa: "Digital nomad visa",
    destination_thailand_visa_dtv: "Destination Thailand Visa (DTV)",
    remote_worker_visa_e33g: "Remote Worker Visa (E33G)",
    d8_digital_nomad_visa: "D8 Digital Nomad Visa",
    de_rantau_nomad_pass: "DE Rantau Nomad Pass",
    remotely_from_georgia: "Remotely from Georgia",
    temporary_resident_visa: "Temporary Resident Visa",
  };
  const METHOD_LABELS = {
    none: "Nothing required before travel",
    on_arrival: "Apply on arrival",
    online_before_travel: "Apply online before travel",
    on_arrival_or_online_before_travel: "Apply on arrival, or online before travel",
    online_or_embassy_before_travel: "Apply online or at embassy before travel",
    embassy_or_evisa_before_travel: "Apply at embassy or via eVisa before travel",
    embassy_or_consulate_before_travel: "Apply at embassy/consulate before travel",
  };
  const ENTRIES_LABELS = {
    single: "Single entry",
    multiple_entry: "Multiple entry",
    per_entry: "Per entry (multi-entry, fresh allowance each time)",
    single_or_multiple: "Single or multiple entry",
    single_double_or_multiple: "Single, double, or multiple entry",
    multiple_entry_within_90_180_limit: "Multiple entry (within 90/180 limit)",
  };
  const pretty = (map, key) => map[key] || (key || "").replace(/_/g, " ");

  // -------- Rendering ----------

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  }

  function renderRuleDetails(rule, country) {
    const dl = el("dl", { class: "kvList" });
    dl.append(el("dt", {}, "Visa type"), el("dd", {}, pretty(VISA_TYPE_LABELS, rule.visaType)));
    dl.append(el("dt", {}, "How to apply"), el("dd", {}, pretty(METHOD_LABELS, rule.applicationMethod)));

    let durTxt = "Not specified";
    if (rule.durationDays != null) {
      durTxt = `Up to ${rule.durationDays} days`;
      if (rule.periodDays) durTxt += ` per ${rule.periodDays}-day period`;
      if (rule.extendable) {
        durTxt += rule.extensionDays ? ` (extendable by ${rule.extensionDays} days)` : " (may be extendable)";
      }
    }
    dl.append(el("dt", {}, "Allowed stay"), el("dd", {}, durTxt));

    dl.append(el("dt", {}, "Entries"), el("dd", {}, pretty(ENTRIES_LABELS, rule.entries)));

    if (country.zone) {
      dl.append(el("dt", {}, "Zone"), el("dd", {}, country.zone));
    }

    return dl;
  }

  function renderRequirements(rule) {
    if (!rule.requirements || !rule.requirements.length) return null;
    const ul = el("ul", { class: "requirements" });
    for (const r of rule.requirements) ul.append(el("li", {}, r));
    return ul;
  }

  function renderResultCard(dest, country, results) {
    const card = el("div", { class: "resultCard" });

    const header = el("div", { class: "resultHeader" });
    header.append(
      el("span", { class: "flag" }, flagFromCode(country.code)),
      el("span", { class: "country" }, country.name),
      el("span", { class: "stayPlan" },
        `Plan: ${dest.days} day${dest.days === 1 ? "" : "s"}, ${dest.multi ? "multi-entry" : "single entry"}` +
        (dest.work ? ", with remote work" : "")
      )
    );
    card.append(header);

    const purpose = dest.work ? "work" : "tourism";
    const match = results[purpose];
    const tourismMatch = results.tourism;

    if (match.best) {
      const p = PASSPORT_BY_CODE.get(match.best.passport);
      const recommend = el("div", { class: "recommend" });
      recommend.append(
        el("span", { class: "badge" }, "Use this passport"),
        el("span", { class: "passport-pill" },
          el("span", { class: "chip-flag" }, p ? p.flag : ""),
          document.createTextNode(p ? p.name : match.best.passport)
        )
      );
      card.append(recommend);

      const summary = el("div", { class: "visaSummary" }, match.best.rule.summary || "");
      card.append(summary);

      card.append(renderRuleDetails(match.best.rule, country));
      const reqs = renderRequirements(match.best.rule);
      if (reqs) {
        card.append(el("div", { class: "sectionTitle", style: "margin:10px 0 4px; font-size:13px;" }, "Requirements"));
        card.append(reqs);
      }

      // Explanatory: stay shorter would have been simpler.
      if (match.bestIgnoringDays && match.bestIgnoringDays.rule.rank < match.best.rule.rank) {
        const alt = match.bestIgnoringDays;
        const altP = PASSPORT_BY_CODE.get(alt.passport);
        const altLabel = pretty(VISA_TYPE_LABELS, alt.rule.visaType);
        card.append(
          el("div", { class: "callout info" },
            el("strong", {}, `Heads up: `),
            document.createTextNode(
              `If you shortened your stay to ${alt.rule.durationDays} day${alt.rule.durationDays === 1 ? "" : "s"} or less, ` +
              `you could enter on your ${altP ? altP.name : alt.passport} passport as ${altLabel} instead — ` +
              `no advance application needed in many cases.`
            )
          )
        );
      }

      // Explanatory: dropping multi-entry would have been simpler.
      if (dest.multi && match.bestIgnoringEntries && match.bestIgnoringEntries.rule.rank < match.best.rule.rank) {
        const alt = match.bestIgnoringEntries;
        const altP = PASSPORT_BY_CODE.get(alt.passport);
        const altLabel = pretty(VISA_TYPE_LABELS, alt.rule.visaType);
        card.append(
          el("div", { class: "callout info" },
            el("strong", {}, `Heads up: `),
            document.createTextNode(
              `If you only need single entry, your ${altP ? altP.name : alt.passport} passport qualifies for ` +
              `${altLabel} (a simpler option).`
            )
          )
        );
      }

      if (match.best.rule.notes) {
        card.append(el("div", { class: "notesText" }, "Note: " + match.best.rule.notes));
      }

      // Work-specific extras: also show tourism rule for entry context if different.
      if (purpose === "work" && tourismMatch && tourismMatch.best) {
        const tp = PASSPORT_BY_CODE.get(tourismMatch.best.passport);
        const tLabel = pretty(VISA_TYPE_LABELS, tourismMatch.best.rule.visaType);
        card.append(
          el("div", { class: "callout good" },
            el("strong", {}, "Tourism alternative: "),
            document.createTextNode(
              `If you'd rather skip the work visa, your ${tp ? tp.name : tourismMatch.best.passport} passport ` +
              `qualifies for ${tLabel} (${tourismMatch.best.rule.durationDays || "?"} days). ` +
              `Note that local work is not permitted on a tourist visa.`
            )
          )
        );
      }
    } else {
      // No match for the requested purpose — explain why and what would work.
      card.classList.add("no-match");
      let msg = `No ${purpose === "work" ? "remote-work / digital-nomad" : "tourism"} option in our data fits your plan with the passports you've added.`;
      card.append(el("div", { class: "visaSummary" }, msg));

      // Best rule that exists if we relax days
      const relax = match.bestIgnoringDays || match.bestIgnoringEntries || match.bestIgnoringBoth;
      if (relax) {
        const altP = PASSPORT_BY_CODE.get(relax.passport);
        const altLabel = pretty(VISA_TYPE_LABELS, relax.rule.visaType);
        const reasons = [];
        if (relax.rule.durationDays != null && relax.rule.durationDays < dest.days) {
          reasons.push(`it only allows up to ${relax.rule.durationDays} days (you want ${dest.days})`);
        }
        if (dest.multi && !entriesAllowMultiple(relax.rule)) {
          reasons.push(`it's single entry only`);
        }
        const reasonTxt = reasons.length ? ` because ${reasons.join(" and ")}` : "";
        card.append(
          el("div", { class: "callout warn" },
            el("strong", {}, "Closest option: "),
            document.createTextNode(
              `Your ${altP ? altP.name : relax.passport} passport could use ${altLabel}, ` +
              `but it doesn't fully fit your plan${reasonTxt}.`
            )
          )
        );
        if (relax.rule.notes) {
          card.append(el("div", { class: "notesText" }, "Note: " + relax.rule.notes));
        }
      } else if (purpose === "work") {
        card.append(
          el("div", { class: "callout warn" },
            el("strong", {}, "No remote-work program on file: "),
            document.createTextNode(
              "Working remotely from this country usually requires a separate work permit, " +
              "long-stay visa, or business visa — research the consulate's specific options."
            )
          )
        );
        if (tourismMatch && tourismMatch.best) {
          const tp = PASSPORT_BY_CODE.get(tourismMatch.best.passport);
          const tLabel = pretty(VISA_TYPE_LABELS, tourismMatch.best.rule.visaType);
          card.append(
            el("div", { class: "callout info" },
              el("strong", {}, "For entry only: "),
              document.createTextNode(
                `Your ${tp ? tp.name : tourismMatch.best.passport} passport qualifies for ${tLabel}. ` +
                `Local employment is not permitted on a tourist visa.`
              )
            )
          );
        }
      } else {
        card.append(
          el("div", { class: "callout error" },
            "None of the rules on file applies to your passports — verify directly with the consulate."
          )
        );
      }
    }

    return card;
  }

  // -------- Form submit ----------
  const form = $("visaForm");
  const errorBox = $("errorBox");
  const resultsSection = $("resultsSection");
  const resultsList = $("resultsList");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
  function clearError() {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  function readDestinations() {
    const out = [];
    for (const row of destinationsContainer.children) {
      const code = row.querySelector('[data-role="country"]').value;
      const days = parseInt(row.querySelector('[data-role="days"]').value, 10);
      const multi = row.querySelector('[data-role="multi"]').checked;
      const work = row.querySelector('[data-role="work"]').checked;
      if (!code) continue;
      if (!Number.isFinite(days) || days < 1) continue;
      out.push({ code, days, multi, work });
    }
    return out;
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    clearError();

    const passports = Array.from(SELECTED_PASSPORTS);
    if (passports.length === 0) {
      showError("Please add at least one passport.");
      return;
    }
    const destinations = readDestinations();
    if (destinations.length === 0) {
      showError("Please add at least one destination with a country and a number of days.");
      return;
    }

    resultsList.innerHTML = "";
    for (const dest of destinations) {
      const country = COUNTRIES_DB.countries.find((c) => c.code === dest.code);
      if (!country) continue;
      const tourism = findBestMatch(country, passports, dest.days, dest.multi, "tourism");
      const work = dest.work
        ? findBestMatch(country, passports, dest.days, dest.multi, "work")
        : { best: null, bestIgnoringDays: null, bestIgnoringEntries: null, bestIgnoringBoth: null };
      resultsList.appendChild(renderResultCard(dest, country, { tourism, work }));
    }
    resultsSection.style.display = "block";
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // -------- Init --------
  (async function init() {
    try {
      await loadCountries();
    } catch (e) {
      showError("Couldn't load visa data: " + e.message);
      return;
    }
    populatePassportSelect();
    renderPassportChips();
    addDestinationRow(); // start with one empty row
  })();
})();
