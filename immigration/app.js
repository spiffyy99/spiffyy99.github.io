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
    ["GE", "Georgia", "\uD83C\uDDEC\uD83C\uDDEA"],
    ["MA", "Morocco", "\uD83C\uDDF2\uD83C\uDDE6"],
    ["LK", "Sri Lanka", "\uD83C\uDDF1\uD83C\uDDF0"],
    ["NP", "Nepal", "\uD83C\uDDF3\uD83C\uDDF5"],
    ["KH", "Cambodia", "\uD83C\uDDF0\uD83C\uDDED"],
    ["LA", "Laos", "\uD83C\uDDF1\uD83C\uDDE6"],
    ["MN", "Mongolia", "\uD83C\uDDF2\uD83C\uDDF3"],
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

  // -------- Custom typeable combobox ----------
  // A small reusable component: input + filtered dropdown panel anchored
  // directly below it. Selection only happens on explicit click / Enter,
  // never on typing alone.
  //
  //   createCombobox({ items: [{value,label}], placeholder, onSelect })
  //   -> { root, setItems, clear, getValue, focus }
  function createCombobox({ items, placeholder, onSelect, role }) {
    const root = document.createElement("div");
    root.className = "combobox";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "cb-input";
    input.placeholder = placeholder || "";
    input.autocomplete = "off";

    // Hidden field carries the selected value so existing
    // `[data-role="..."]` queries keep working.
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    if (role) hidden.dataset.role = role;

    const panel = document.createElement("div");
    panel.className = "cb-panel";
    panel.hidden = true;

    root.append(input, hidden, panel);

    let currentItems = items.slice();
    let highlight = -1;

    function visibleItems() {
      const f = input.value.trim().toLowerCase();
      if (!f) return currentItems.slice();
      return currentItems.filter((it) => it.label.toLowerCase().includes(f));
    }

    function rebuild() {
      panel.innerHTML = "";
      const list = visibleItems();
      if (list.length === 0) {
        const e = document.createElement("div");
        e.className = "cb-empty";
        e.textContent = "No matches";
        panel.appendChild(e);
      } else {
        list.forEach((it, i) => {
          const opt = document.createElement("div");
          opt.className = "cb-option" + (i === highlight ? " is-active" : "");
          opt.textContent = it.label;
          opt.setAttribute("role", "option");
          // mousedown fires before input's blur — prevents the panel from
          // closing before the click registers.
          opt.addEventListener("mousedown", (e) => {
            e.preventDefault();
            select(it);
          });
          panel.appendChild(opt);
        });
      }
      panel.hidden = false;
    }

    function select(item) {
      input.value = item.label;
      hidden.value = item.value;
      panel.hidden = true;
      highlight = -1;
      if (typeof onSelect === "function") onSelect(item);
    }

    function open() { highlight = -1; rebuild(); }
    function close() { panel.hidden = true; }

    input.addEventListener("focus", open);
    input.addEventListener("input", () => {
      // Typing invalidates a previously committed selection.
      hidden.value = "";
      highlight = -1;
      rebuild();
    });
    // Delay close so option click can register first.
    input.addEventListener("blur", () => setTimeout(close, 120));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const list = visibleItems();
        if (list.length === 0) return;
        highlight = Math.min(list.length - 1, highlight + 1);
        rebuild();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const list = visibleItems();
        if (list.length === 0) return;
        highlight = Math.max(0, highlight <= 0 ? 0 : highlight - 1);
        rebuild();
      } else if (e.key === "Enter") {
        // Enter only commits when an item is actively highlighted by the user.
        const list = visibleItems();
        if (highlight >= 0 && list[highlight]) {
          e.preventDefault();
          select(list[highlight]);
        } else if (list.length === 1 && input.value.trim()) {
          e.preventDefault();
          select(list[0]);
        }
      } else if (e.key === "Escape") {
        close();
      }
    });

    return {
      root,
      setItems(newItems) {
        currentItems = newItems.slice();
        if (!panel.hidden) rebuild();
      },
      clear() {
        input.value = "";
        hidden.value = "";
        close();
      },
      getValue: () => hidden.value,
      focus: () => input.focus(),
    };
  }

  // -------- Passport selection (custom combobox) ----------
  const passportChips = $("passportChips");
  const passportComboMount = $("passportComboMount");
  const SELECTED_PASSPORTS = new Set();

  function passportComboItems() {
    return PASSPORTS
      .filter(([c]) => !SELECTED_PASSPORTS.has(c))
      .map(([c, n]) => ({ value: c, label: n }));
  }

  const passportCombo = createCombobox({
    items: passportComboItems(),
    placeholder: "Type a country name\u2026",
    onSelect: (item) => {
      SELECTED_PASSPORTS.add(item.value);
      passportCombo.clear();
      passportCombo.setItems(passportComboItems());
      renderPassportChips();
      syncDestinationsToPassports();
    },
  });
  passportComboMount.appendChild(passportCombo.root);

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
        passportCombo.setItems(passportComboItems());
        syncDestinationsToPassports();
      });
      chip.appendChild(x);
      passportChips.appendChild(chip);
    }
  }

  // -------- Destination rows ----------
  const destinationsContainer = $("destinations");
  const addDestinationBtn = $("addDestinationBtn");
  const MAX_DESTINATIONS = 10;

  // Country list for destination pickers, excluding any country the user
  // already holds a passport for (you don't need a visa to enter your own
  // country, so suggesting it would be confusing). Sorted alphabetically.
  function destinationCountryItems() {
    return COUNTRIES_DB.countries
      .filter((c) => !SELECTED_PASSPORTS.has(c.code))
      .map((c) => ({ value: c.code, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Keep destination rows consistent with the current passport set:
  //   - drop any rows whose country is now a passport-held country
  //   - refresh remaining comboboxes so passport countries disappear from suggestions
  //   - re-show the "add destination" button if rows were removed
  function syncDestinationsToPassports() {
    const cards = [...destinationsContainer.children];
    for (const card of cards) {
      const hidden = card.querySelector('input[data-role="country"]');
      if (hidden && hidden.value && SELECTED_PASSPORTS.has(hidden.value)) {
        card.remove();
      }
    }
    const items = destinationCountryItems();
    for (const card of destinationsContainer.children) {
      if (card._countryCombo) card._countryCombo.setItems(items);
    }
    addDestinationBtn.hidden = destinationsContainer.children.length >= MAX_DESTINATIONS;
    // Always keep at least one empty row visible so the form isn't blank.
    if (destinationsContainer.children.length === 0) {
      addDestinationRow();
    }
  }

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
    const countryItems = destinationCountryItems();
    const countryCombo = createCombobox({
      items: countryItems,
      placeholder: "Type a country name\u2026",
      role: "country",
    });
    if (initial.code && !SELECTED_PASSPORTS.has(initial.code)) {
      const found = countryItems.find((it) => it.value === initial.code);
      if (found) {
        countryCombo.root.querySelector(".cb-input").value = found.label;
        countryCombo.root.querySelector('input[data-role="country"]').value = found.value;
      }
    }
    card._countryCombo = countryCombo;
    fCountry.append(lblC, countryCombo.root);

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
  // Handles nested group references (e.g., OECD_HIGH_INCOME contains "EU").
  function expandRulePassportGroups(groups) {
    const out = new Set();
    let wildcard = false;
    let hasConditional = false;
    const visited = new Set(); // prevent infinite loops
    
    function expand(g) {
      if (visited.has(g)) return; // already processed
      visited.add(g);
      
      if (g === "*") { wildcard = true; return; }
      if (typeof g === "string" && g.startsWith("HAS_")) { hasConditional = true; return; }
      if (GROUP_EXPANSIONS[g]) {
        for (const c of GROUP_EXPANSIONS[g]) expand(c);
        return;
      }
      out.add(g);
    }
    
    for (const g of groups || []) {
      expand(g);
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
  // When purpose is "tourism", also consider work visas that don't require work.
  function findBestMatch(country, passports, days, wantsMultiple, purpose) {
    let best = null;
    let bestIgnoringDays = null;     // would have worked with shorter stay
    let bestIgnoringEntries = null;  // would have worked if single-entry OK
    let bestIgnoringBoth = null;     // any rule for this purpose at all

    for (const passport of passports) {
      for (const rule of country.visaRules) {
        // Match rules for the requested purpose. For tourism, also include
        // work visas that have requiresWork: false (e.g., working holiday visas).
        const purposeMatch = rule.purpose === purpose ||
          (purpose === "tourism" && rule.purpose === "work" && rule.requiresWork === false);
        
        if (!purposeMatch) continue;
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

  // Acronyms that should appear all-caps in formatted visa names.
  const VISA_ACRONYMS = new Set([
    "dtv", "eta", "voa", "esta", "etias", "etfs", "ets",
    "k", "f", "e", "c", "d", "j", "b",
    "uae", "us", "uk", "eu", "asean",
  ]);
  // Lowercase connector words inside formatted visa names.
  const VISA_CONNECTORS = new Set(["or", "and", "of", "to", "in", "on", "at", "for", "the", "with"]);

  // Smart fallback formatter for visa type slugs the LABELS map doesn't cover.
  // Examples:
  //   "f_1_d_workation_digital_nomad" -> "F-1-D Workation Digital Nomad"
  //   "k_eta_or_visa_free_entry"      -> "K-ETA or Visa Free Entry"
  //   "destination_thailand_visa_dtv" -> "Destination Thailand Visa DTV"
  //   "tourist_visa_c3"               -> "Tourist Visa C3"
  function prettyVisaType(visaType) {
    if (!visaType) return "";
    if (VISA_TYPE_LABELS[visaType]) return VISA_TYPE_LABELS[visaType];

    const parts = visaType.split("_");
    // A token is "code-like" if it's a single char/digit, OR a known short
    // acronym. Adjacent code-like tokens get joined with hyphens & uppercased.
    const isCodeLike = (t) =>
      /^[a-z0-9]$/.test(t) || /^\d+$/.test(t) ||
      (VISA_ACRONYMS.has(t) && t.length <= 4);

    const out = [];
    let i = 0;
    while (i < parts.length) {
      if (isCodeLike(parts[i])) {
        let j = i;
        while (j < parts.length && isCodeLike(parts[j])) j++;
        if (j - i >= 2) {
          out.push(parts.slice(i, j).map((s) => s.toUpperCase()).join("-"));
          i = j;
          continue;
        }
      }
      const t = parts[i];
      if (VISA_CONNECTORS.has(t)) {
        out.push(t);
      } else if (VISA_ACRONYMS.has(t)) {
        out.push(t.toUpperCase());
      } else if (/^[a-z]+\d+[a-z]*$/i.test(t)) {
        // Model-number style tokens like "c3", "e33g", "d8".
        out.push(t.toUpperCase());
      } else {
        out.push(t.charAt(0).toUpperCase() + t.slice(1));
      }
      i++;
    }
    return out.join(" ");
  }

  // Map a visa type to a category used for color-coding (CSS variable name).
  function visaCategory(visaType) {
    if (!visaType) return "other";
    const v = visaType.toLowerCase();
    if (v.includes("visa_free") || v === "visa_exempt_with_third_country_visa") return "free";
    if (v === "visa_on_arrival" || v.endsWith("_on_arrival")) return "onarrival";
    if (v.startsWith("evisa") || /(^|_)(eta|esta|etias)(_|$)/.test(v)) return "evisa";
    if (
      v === "tourist_visa" || v === "visitor_visa" ||
      v === "schengen_short_stay_visa" ||
      v.startsWith("tourist_visa_") || v.startsWith("visitor_visa_")
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
    const v = rule.visaType;
    if (cat === "free") {
      if (v === "visa_free") return "Visa Free";
      if (v === "visa_free_schengen") return "Visa Free (Schengen)";
      if (v === "visa_exempt_with_third_country_visa") return "Visa Exempt";
      // Combined types like "k_eta_or_visa_free_entry" -> "K-ETA or Visa Free Entry"
      return prettyVisaType(v);
    }
    if (cat === "onarrival") return "Visa on Arrival";
    if (cat === "evisa") {
      if (v === "evisa") return "eVisa";
      return prettyVisaType(v);
    }
    if (cat === "tourist") {
      if (v === "tourist_visa") return "Tourist Visa";
      if (v === "visitor_visa") return "Visitor Visa";
      if (v === "schengen_short_stay_visa") return "Schengen Visa";
      return prettyVisaType(v);
    }
    // Work / long-stay: smart formatter (uses VISA_TYPE_LABELS first).
    return prettyVisaType(v);
  }

  // Resolve the best official URL to surface on a card.
  function officialUrlFor(rule, country) {
    return (rule && rule.officialUrl) || (country && country.officialUrl) || null;
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

      // Special note if tourist is using a work visa that doesn't require work
      if (purpose === "tourism" && rule.purpose === "work" && rule.requiresWork === false) {
        card.append(calloutBox("info", "\u2139",
          document.createTextNode(
            `This is a work visa without a work requirement, so it&apos;s suitable for tourists seeking longer stays. Check local laws regarding tourism activities.`
          )
        ));
      }

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
      // No exact match — be helpful, not defeatist. The default answer is
      // always: "you'll need to apply for a visa, contact the consulate."
      card.classList.add("no-match");

      const relax = match.bestIgnoringDays || match.bestIgnoringEntries || match.bestIgnoringBoth;

      // Concise summary of why no instant option fits.
      let summary;
      if (relax && relax.rule.durationDays != null && dest.days > relax.rule.durationDays) {
        summary = `Your ${dest.days}-day stay is longer than the ${relax.rule.durationDays}-day ` +
                  `${visaBadgeText(relax.rule).toLowerCase()} window for this country.`;
      } else if (purpose === "work") {
        summary = `No remote-work or digital-nomad program is in our data for this country with the passports you've added.`;
      } else if (relax && dest.multi && !entriesAllowMultiple(relax.rule)) {
        summary = `The simpler entry options for this country are single-entry only.`;
      } else {
        summary = `None of the simplified entry options in our data covers this combination.`;
      }
      card.append(el("div", { class: "visaSummary" }, summary));

      // Always default to the practical answer: get a visa via the consulate.
      const visaPhrase = purpose === "work"
        ? "a long-stay or work visa (or remote-worker visa where available)"
        : "a tourist or long-stay visa";
      card.append(calloutBox("warn", "\uD83D\uDEC2",
        el("strong", {}, "What to do: "),
        document.createTextNode(
          `Apply for ${visaPhrase} before you travel. Contact the ${country.name} embassy or ` +
          `consulate in your country for current eligibility, processing times, and required documents.`
        )
      ));

      // Show the closest available option as context (not as the answer).
      if (relax) {
        const altP = PASSPORT_BY_CODE.get(relax.passport);
        const altLabel = visaBadgeText(relax.rule);
        const fitNote = (relax.rule.durationDays != null)
          ? ` (up to ${relax.rule.durationDays} days)`
          : "";
        card.append(calloutBox("info", "\uD83D\uDCA1",
          el("strong", {}, "Closest simpler option: "),
          document.createTextNode(
            `Your ${altP ? altP.name : relax.passport} passport could use ${altLabel}${fitNote} ` +
            `if you adjust your plan to fit.`
          )
        ));
        if (relax.rule.notes) {
          card.append(el("div", { class: "notesText" }, relax.rule.notes));
        }
      }

      // Tourism-as-entry alternative for the work case.
      if (purpose === "work" && tourismMatch && tourismMatch.best) {
        const tp = PASSPORT_BY_CODE.get(tourismMatch.best.passport);
        const tLabel = visaBadgeText(tourismMatch.best.rule);
        card.append(calloutBox("good", "\u2728",
          el("strong", {}, "For entry only: "),
          document.createTextNode(
            `Your ${tp ? tp.name : tourismMatch.best.passport} passport qualifies for ${tLabel}. ` +
            `Local employment is not permitted on a tourist visa.`
          )
        ));
      }

      // Remote-work-as-stay alternative for the tourism case: when the user
      // wants a long stay that no tourism rule covers, surface a working
      // visa that DOES cover the duration — but flag that it requires
      // qualifying remote employment / proof of work.
      if (purpose === "tourism" && results.work && results.work.best) {
        const w = results.work.best;
        const wp = PASSPORT_BY_CODE.get(w.passport);
        const wLabel = visaBadgeText(w.rule);
        const wDays = w.rule.durationDays != null ? `up to ${w.rule.durationDays} days` : "extended stays";
        card.append(calloutBox("info", "\uD83D\uDCBC",
          el("strong", {}, "If you'll be working remotely: "),
          document.createTextNode(
            `Your ${wp ? wp.name : w.passport} passport qualifies for ${wLabel} (${wDays}). ` +
            `These visas typically require proof of remote employment or qualifying activity — see requirements before applying.`
          )
        ));
      }
    }

    // Per-card link to the official government source.
    const url = officialUrlFor(match.best ? match.best.rule : null, country);
    if (url) {
      card.append(el("a", {
        class: "officialLink",
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
      }, `Official ${country.name} visa info \u2197`));
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
      // Always compute work too — even for tourism, we may surface a remote-work
      // visa as an alternative when the requested stay exceeds tourism limits.
      const work = findBestMatch(country, passports, dest.days, dest.multi, "work");
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
    renderPassportChips();
    addDestinationRow(); // start with one empty row
  })();
})();
