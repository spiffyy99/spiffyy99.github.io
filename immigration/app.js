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

  // -------- Passport selection (type-ahead, no button) ----------
  const passportChips = $("passportChips");
  const passportInput = $("passportInput");
  const passportDatalist = $("passportDatalist");
  const SELECTED_PASSPORTS = new Set();

  // Build an index for matching typed input -> code. Names are unique in our
  // catalog; we also accept the bare ISO-2 code typed directly (e.g. "US").
  const NAME_TO_CODE = new Map();
  for (const [c, n] of PASSPORTS) {
    NAME_TO_CODE.set(n.toLowerCase(), c);
    NAME_TO_CODE.set(c.toLowerCase(), c);
  }

  function refreshPassportDatalist() {
    passportDatalist.innerHTML = "";
    for (const [code, name] of PASSPORTS) {
      if (SELECTED_PASSPORTS.has(code)) continue;
      const opt = document.createElement("option");
      opt.value = name;
      passportDatalist.appendChild(opt);
    }
  }

  function renderPassportChips() {
    passportChips.innerHTML = "";
    if (SELECTED_PASSPORTS.size === 0) {
      const empty = document.createElement("div");
      empty.className = "chips-empty";
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
        refreshPassportDatalist();
      });
      chip.appendChild(x);
      passportChips.appendChild(chip);
    }
  }

  function tryAddPassportFromInput() {
    const raw = passportInput.value.trim();
    if (!raw) return false;
    const code = NAME_TO_CODE.get(raw.toLowerCase());
    if (!code || SELECTED_PASSPORTS.has(code)) return false;
    SELECTED_PASSPORTS.add(code);
    passportInput.value = "";
    renderPassportChips();
    refreshPassportDatalist();
    return true;
  }

  // The `input` event fires both on typing and on selecting from the datalist.
  // When it matches an exact catalog entry, instantly add the chip.
  passportInput.addEventListener("input", tryAddPassportFromInput);
  // Pressing Enter committed a typed value -> try to match it.
  passportInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryAddPassportFromInput();
    }
  });
  passportInput.addEventListener("blur", tryAddPassportFromInput);

  // -------- Destination rows ----------
  const destinationsContainer = $("destinations");
  const addDestinationBtn = $("addDestinationBtn");
  const MAX_DESTINATIONS = 10;

  function makeTogglePill(role, iconHtml, labelText, initiallyOn) {
    const lbl = document.createElement("label");
    lbl.className = "togglePill" + (initiallyOn ? " is-on" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.role = role;
    if (initiallyOn) cb.checked = true;
    cb.addEventListener("change", () => {
      lbl.classList.toggle("is-on", cb.checked);
    });
    const icon = document.createElement("span");
    icon.className = "pill-icon";
    icon.textContent = iconHtml;
    const txt = document.createElement("span");
    txt.textContent = labelText;
    lbl.append(cb, icon, txt);
    return lbl;
  }

  function buildDestinationRow(initial = {}) {
    const card = document.createElement("div");
    card.className = "destinationCard";

    // Top row: country (wide) + days (narrow)
    const topRow = document.createElement("div");
    topRow.className = "destTopRow";

    const fCountry = document.createElement("div");
    fCountry.className = "destField";
    const lblC = document.createElement("label");
    lblC.textContent = "Country";
    const sel = document.createElement("select");
    sel.dataset.role = "country";
    sel.innerHTML =
      `<option value="" disabled ${initial.code ? "" : "selected"}>Select a country&hellip;</option>` +
      COUNTRIES_DB.countries
        .map((c) => `<option value="${c.code}" ${initial.code === c.code ? "selected" : ""}>${c.name}</option>`)
        .join("");
    fCountry.append(lblC, sel);

    const fDays = document.createElement("div");
    fDays.className = "destField";
    const lblD = document.createElement("label");
    lblD.textContent = "Days";
    const days = document.createElement("input");
    days.type = "number";
    days.min = "1";
    days.max = "3650";
    days.value = initial.days != null ? String(initial.days) : "";
    days.placeholder = "";
    days.dataset.role = "days";
    fDays.append(lblD, days);

    topRow.append(fCountry, fDays);

    // Options row: pill toggles
    const optsRow = document.createElement("div");
    optsRow.className = "destOptionsRow";
    optsRow.append(
      makeTogglePill("multi", "\u21BB", "Multi-entry?", !!initial.multi),
      makeTogglePill("work", "\uD83D\uDCBC", "Working?", !!initial.work),
    );

    // Remove (top-right corner of card)
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "removeDestBtn";
    rm.title = "Remove this destination";
    rm.setAttribute("aria-label", "Remove this destination");
    rm.textContent = "\u00D7";
    rm.addEventListener("click", () => {
      card.remove();
      addDestinationBtn.hidden = false;
    });

    card.append(rm, topRow, optsRow);
    return card;
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
    per_entry: "Multi-entry (fresh allowance each time)",
    single_or_multiple: "Single or multiple",
    single_double_or_multiple: "Single, double, or multiple",
    multiple_entry_within_90_180_limit: "Multi-entry (within 90/180)",
  };
  // Compact label variants used in fact tiles where space is tight.
  const ENTRIES_SHORT = {
    single: "Single",
    multiple_entry: "Multi",
    per_entry: "Multi (per-entry)",
    single_or_multiple: "Single or multi",
    single_double_or_multiple: "Single / double / multi",
    multiple_entry_within_90_180_limit: "Multi (90/180)",
  };
  const METHOD_SHORT = {
    none: "Nothing in advance",
    on_arrival: "On arrival",
    online_before_travel: "Online, before travel",
    on_arrival_or_online_before_travel: "On arrival or online",
    online_or_embassy_before_travel: "Online or embassy",
    embassy_or_evisa_before_travel: "Embassy or eVisa",
    embassy_or_consulate_before_travel: "Embassy / consulate",
  };
  const pretty = (map, key) => map[key] || (key || "").replace(/_/g, " ");

  // Map a visa type to a category used for color-coding (CSS variable name).
  function visaCategory(visaType) {
    if (!visaType) return "other";
    if (visaType.startsWith("visa_free") || visaType === "visa_exempt_with_third_country_visa") return "free";
    if (visaType === "visa_on_arrival") return "onarrival";
    if (visaType.startsWith("evisa")) return "evisa";
    if (
      visaType === "tourist_visa" || visaType === "visitor_visa" ||
      visaType === "schengen_short_stay_visa"
    ) return "tourist";
    // All work / digital-nomad / temporary-residence / DTV / E33G / D8 / DE Rantau / Remotely from Georgia
    return "work";
  }
  const CATEGORY_ICON = {
    free: "\u2713",        // ✓
    onarrival: "\u2708",   // ✈
    evisa: "\uD83D\uDCBB", // 💻
    tourist: "\uD83D\uDCDC", // 📜
    work: "\uD83D\uDCBC",  // 💼
    other: "\u2756",       // ❖
  };
  const CATEGORY_VAR = {
    free: "var(--visa-free)",
    onarrival: "var(--visa-onarrival)",
    evisa: "var(--visa-evisa)",
    tourist: "var(--visa-tourist)",
    work: "var(--visa-work)",
    other: "var(--visa-other)",
  };
  // Compact display label for the badge (concise, not the long official name).
  function visaBadgeText(rule) {
    const cat = visaCategory(rule.visaType);
    if (cat === "free") {
      return rule.visaType === "visa_free_schengen" ? "Visa Free (Schengen)"
           : rule.visaType === "visa_exempt_with_third_country_visa" ? "Visa Exempt"
           : "Visa Free";
    }
    if (cat === "onarrival") return "Visa on Arrival";
    if (cat === "evisa") return "eVisa";
    if (cat === "tourist") return rule.visaType === "schengen_short_stay_visa" ? "Schengen Visa" : "Tourist Visa";
    // For work/long-stay, show the friendly name.
    return pretty(VISA_TYPE_LABELS, rule.visaType);
  }

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

  function tile(label, valueText, iconText) {
    const t = el("div", { class: "factTile" });
    t.append(el("div", { class: "ft-label" }, label));
    const v = el("div", { class: "ft-value" });
    if (iconText) {
      const ic = el("span", { class: "ft-icon" });
      ic.textContent = iconText;
      v.append(ic);
    }
    v.append(document.createTextNode(valueText));
    t.append(v);
    return t;
  }

  function renderFactGrid(rule, country) {
    const grid = el("div", { class: "factGrid" });

    // Allowed stay
    let stayTxt = "Not specified";
    if (rule.durationDays != null) {
      stayTxt = `${rule.durationDays} days`;
      if (rule.periodDays) stayTxt += ` / ${rule.periodDays}d`;
    }
    grid.append(tile("Allowed stay", stayTxt, "\uD83D\uDCC5"));

    // How to apply
    grid.append(tile("How to apply", pretty(METHOD_SHORT, rule.applicationMethod), "\uD83D\uDCDD"));

    // Entries
    grid.append(tile("Entries", pretty(ENTRIES_SHORT, rule.entries), "\u21BB"));

    // Extension info
    if (rule.extendable) {
      const extTxt = rule.extensionDays ? `+${rule.extensionDays} days` : "Possible";
      grid.append(tile("Extension", extTxt, "\u2795"));
    }

    // Zone (Schengen etc.)
    if (country.zone) {
      grid.append(tile("Zone", country.zone, "\uD83C\uDF10"));
    }

    return grid;
  }

  function renderStayBar(userDays, rule) {
    if (rule.durationDays == null) return null;
    const allowed = rule.durationDays;
    const userPct = Math.min(100, Math.round((userDays / allowed) * 100));
    const wrap = el("div", { class: "stayBar" + (userDays > allowed ? " over" : "") });
    const meta = el("div", { class: "sb-meta" });
    meta.append(
      el("span", {}, `Your stay: ${userDays}d`),
      el("span", {}, `Allowed: ${allowed}d`)
    );
    const track = el("div", { class: "sb-track" });
    const fill = el("div", { class: "sb-fill" });
    fill.style.width = userPct + "%";
    track.append(fill);
    wrap.append(meta, track);
    return wrap;
  }

  function renderRequirements(rule) {
    if (!rule.requirements || !rule.requirements.length) return null;
    const block = el("div", { class: "requirementsBlock" });
    block.append(el("div", { class: "rb-title" }, "Requirements"));
    const ul = el("ul", { class: "requirements" });
    for (const r of rule.requirements) ul.append(el("li", {}, r));
    block.append(ul);
    return block;
  }

  function renderPlanChips(dest) {
    const chips = el("div", { class: "planChips" });
    chips.append(
      el("span", { class: "planChip" },
        el("span", { class: "pc-icon" }, "\uD83D\uDCC5"),
        document.createTextNode(`${dest.days} day${dest.days === 1 ? "" : "s"}`)),
      el("span", { class: "planChip" },
        el("span", { class: "pc-icon" }, "\u21BB"),
        document.createTextNode(dest.multi ? "Multi-entry" : "Single entry"))
    );
    if (dest.work) {
      chips.append(
        el("span", { class: "planChip" },
          el("span", { class: "pc-icon" }, "\uD83D\uDCBC"),
          document.createTextNode("Remote work"))
      );
    }
    return chips;
  }

  function renderVisaBadge(rule) {
    const cat = visaCategory(rule.visaType);
    const badge = el("span", { class: "visaBadge" });
    badge.style.setProperty("--card-accent", CATEGORY_VAR[cat]);
    badge.append(
      el("span", { class: "vb-icon" }, CATEGORY_ICON[cat] || ""),
      document.createTextNode(visaBadgeText(rule))
    );
    return badge;
  }

  function calloutBox(type, iconText, ...children) {
    const c = el("div", { class: "callout " + type });
    c.append(el("span", { class: "c-icon" }, iconText));
    const inner = el("div", {});
    for (const ch of children) inner.append(typeof ch === "string" ? document.createTextNode(ch) : ch);
    c.append(inner);
    return c;
  }

  function renderResultCard(dest, country, results) {
    const card = el("div", { class: "resultCard" });

    // Header: flag + country + plan chips on the right
    const header = el("div", { class: "resultHeader" });
    header.append(
      el("span", { class: "flag" }, flagFromCode(country.code)),
      el("span", { class: "country" }, country.name),
      renderPlanChips(dest)
    );
    card.append(header);

    const purpose = dest.work ? "work" : "tourism";
    const match = results[purpose];
    const tourismMatch = results.tourism;

    if (match.best) {
      const rule = match.best.rule;
      const cat = visaCategory(rule.visaType);

      // Color-theme the whole card by visa category (left bar uses --card-accent).
      card.style.setProperty("--card-accent", CATEGORY_VAR[cat]);

      // Recommendation row: which passport + visa badge
      const p = PASSPORT_BY_CODE.get(match.best.passport);
      const recommend = el("div", { class: "recommend" });
      recommend.append(
        el("span", { class: "rec-label" }, "Use"),
        el("span", { class: "passport-pill" },
          el("span", { class: "chip-flag" }, p ? p.flag : ""),
          document.createTextNode(p ? p.name : match.best.passport)
        ),
        el("span", { class: "rec-label" }, "for"),
        renderVisaBadge(rule)
      );
      card.append(recommend);

      // Summary text (one short paragraph)
      if (rule.summary) {
        card.append(el("div", { class: "visaSummary" }, rule.summary));
      }

      // Visual: stay vs allowed bar
      const sb = renderStayBar(dest.days, rule);
      if (sb) card.append(sb);

      // Visual: fact tiles (allowed stay, how to apply, entries, etc.)
      card.append(renderFactGrid(rule, country));

      // Requirements (only if any)
      const reqs = renderRequirements(rule);
      if (reqs) card.append(reqs);

      // Heads-up callouts
      if (match.bestIgnoringDays && match.bestIgnoringDays.rule.rank < rule.rank) {
        const alt = match.bestIgnoringDays;
        const altP = PASSPORT_BY_CODE.get(alt.passport);
        const altLabel = visaBadgeText(alt.rule);
        card.append(calloutBox("info", "\uD83D\uDCA1",
          el("strong", {}, "Tip: "),
          document.createTextNode(
            `Trim your stay to ${alt.rule.durationDays} day${alt.rule.durationDays === 1 ? "" : "s"} ` +
            `and your ${altP ? altP.name : alt.passport} passport could enter as ${altLabel} ` +
            `— often with no advance application.`
          )
        ));
      }
      if (dest.multi && match.bestIgnoringEntries && match.bestIgnoringEntries.rule.rank < rule.rank) {
        const alt = match.bestIgnoringEntries;
        const altP = PASSPORT_BY_CODE.get(alt.passport);
        const altLabel = visaBadgeText(alt.rule);
        card.append(calloutBox("info", "\uD83D\uDCA1",
          el("strong", {}, "Tip: "),
          document.createTextNode(
            `If single entry is enough, your ${altP ? altP.name : alt.passport} passport qualifies for ${altLabel} — simpler.`
          )
        ));
      }

      if (rule.notes) {
        card.append(el("div", { class: "notesText" }, rule.notes));
      }

      if (purpose === "work" && tourismMatch && tourismMatch.best) {
        const tp = PASSPORT_BY_CODE.get(tourismMatch.best.passport);
        const tLabel = visaBadgeText(tourismMatch.best.rule);
        card.append(calloutBox("good", "\u2728",
          el("strong", {}, "Tourism alternative: "),
          document.createTextNode(
            `Skipping the work visa? Your ${tp ? tp.name : tourismMatch.best.passport} passport qualifies for ` +
            `${tLabel} (${tourismMatch.best.rule.durationDays || "?"} days). Local work is not permitted on a tourist visa.`
          )
        ));
      }
    } else {
      // No match for requested purpose
      card.classList.add("no-match");
      const msg = `No ${purpose === "work" ? "remote-work or digital-nomad" : "tourism"} option in our data fits your plan with the passports you've added.`;
      card.append(el("div", { class: "visaSummary" }, msg));

      const relax = match.bestIgnoringDays || match.bestIgnoringEntries || match.bestIgnoringBoth;
      if (relax) {
        const altP = PASSPORT_BY_CODE.get(relax.passport);
        const altLabel = visaBadgeText(relax.rule);
        const reasons = [];
        if (relax.rule.durationDays != null && relax.rule.durationDays < dest.days) {
          reasons.push(`it only allows ${relax.rule.durationDays} days (you want ${dest.days})`);
        }
        if (dest.multi && !entriesAllowMultiple(relax.rule)) {
          reasons.push(`it's single-entry only`);
        }
        const reasonTxt = reasons.length ? ` — ${reasons.join(" and ")}` : "";
        card.append(calloutBox("warn", "\u26A0",
          el("strong", {}, "Closest option: "),
          document.createTextNode(
            `Your ${altP ? altP.name : relax.passport} passport could use ${altLabel}, but it doesn't fully fit${reasonTxt}.`
          )
        ));
        if (relax.rule.notes) {
          card.append(el("div", { class: "notesText" }, relax.rule.notes));
        }
      } else if (purpose === "work") {
        card.append(calloutBox("warn", "\u26A0",
          el("strong", {}, "No remote-work program on file: "),
          document.createTextNode(
            "Working remotely from here usually requires a separate work permit, long-stay visa, or business visa — check the consulate."
          )
        ));
        if (tourismMatch && tourismMatch.best) {
          const tp = PASSPORT_BY_CODE.get(tourismMatch.best.passport);
          const tLabel = visaBadgeText(tourismMatch.best.rule);
          card.append(calloutBox("info", "\u2139",
            el("strong", {}, "For entry only: "),
            document.createTextNode(
              `Your ${tp ? tp.name : tourismMatch.best.passport} passport qualifies for ${tLabel}. Local employment is not permitted on a tourist visa.`
            )
          ));
        }
      } else {
        card.append(calloutBox("error", "\u2716",
          "None of the rules on file applies to your passports — verify directly with the consulate."
        ));
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
    refreshPassportDatalist();
    renderPassportChips();
    addDestinationRow(); // start with one empty row
  })();
})();
