// ── State ──
let airlineData = null;

const state = {
  theme: localStorage.getItem('tb-theme') || 'light',
  units: localStorage.getItem('tb-units') || 'metric',
  bags: { personal: false, carryOn: false, checked: 0 },
  flights: [] // { iata, tierIndex }
};

// ── Conversion helpers ──
const CM_TO_IN = 0.393701;
const KG_TO_LB = 2.20462;
function cmToIn(cm) { return +(cm * CM_TO_IN).toFixed(1); }
function kgToLb(kg) { return +(kg * KG_TO_LB).toFixed(1); }

function formatDim(cmArr) {
  if (!cmArr) return null;
  if (state.units === 'metric') {
    return cmArr.length === 1 ? `${cmArr[0]} cm (linear)` : `${cmArr[0]} x ${cmArr[1]} x ${cmArr[2]} cm`;
  }
  const inArr = cmArr.map(cmToIn);
  return inArr.length === 1 ? `${inArr[0]} in (linear)` : `${inArr[0]} x ${inArr[1]} x ${inArr[2]} in`;
}

function formatWeight(kg) {
  if (kg === null || kg === undefined) return null;
  return state.units === 'metric' ? `${kg} kg` : `${kgToLb(kg)} lbs`;
}

// ── Theme ──
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = state.theme === 'dark'
      ? '<i data-lucide="sun" style="width:18px;height:18px"></i>'
      : '<i data-lucide="moon" style="width:18px;height:18px"></i>';
    lucide.createIcons();
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tb-theme', state.theme);
  applyTheme();
}

// ── Units ──
function setUnits(u) {
  state.units = u;
  localStorage.setItem('tb-units', u);
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === u);
  });
  renderAirlineCards();
  renderSummary();
}

// ── Airline helpers ──
function getAirline(iata) {
  return airlineData.airlines.find(a => a.iata === iata);
}

// ── Global bag controls ──
function togglePersonal() {
  state.bags.personal = document.getElementById('personal-toggle').checked;
  renderAirlineCards();
  renderSummary();
}

function toggleCarryOn() {
  state.bags.carryOn = document.getElementById('carryOn-toggle').checked;
  renderAirlineCards();
  renderSummary();
}

function setCheckedCount(delta) {
  const newVal = state.bags.checked + delta;
  if (newVal < 0 || newVal > 2) return;
  state.bags.checked = newVal;
  renderGlobalBags();
  renderAirlineCards();
  renderSummary();
}

function renderGlobalBags() {
  document.getElementById('count-checked').textContent = state.bags.checked;
  const dec = document.querySelector('[data-testid="decrement-checked"]');
  const inc = document.querySelector('[data-testid="increment-checked"]');
  if (dec) dec.disabled = state.bags.checked <= 0;
  if (inc) inc.disabled = state.bags.checked >= 2;
}

// ── Airline search dropdown ──
function openDropdown() {
  document.getElementById('airline-dropdown').style.display = 'block';
  filterDropdown();
}

function filterDropdown() {
  const query = document.getElementById('airline-search').value.toLowerCase().trim();
  const dd = document.getElementById('airline-dropdown');
  const selectedIatas = state.flights.map(f => f.iata);

  const matches = airlineData.airlines.filter(a => {
    if (selectedIatas.includes(a.iata)) return false;
    if (!query) return true;
    return a.name.toLowerCase().includes(query) || a.iata.toLowerCase().includes(query);
  }).sort((a, b) => a.name.localeCompare(b.name));

  dd.innerHTML = matches.length === 0
    ? '<div class="dropdown-empty">No airlines found</div>'
    : matches.map(a => `
        <button class="dropdown-item" data-testid="dropdown-item-${a.iata}" onmousedown="addAirline('${a.iata}')">
          <span class="dropdown-iata">${a.iata}</span><span>${a.name}</span>
        </button>`).join('');
}

function addAirline(iata) {
  if (state.flights.find(f => f.iata === iata)) return;
  // Auto-select the cheapest tier that supports current bag selection
  const airline = getAirline(iata);
  let bestTier = 0;
  if (airline) {
    const idx = airline.ticketTiers.findIndex(t => isTierSupported(t));
    if (idx !== -1) bestTier = idx;
  }
  state.flights.push({ iata, tierIndex: bestTier });
  document.getElementById('airline-search').value = '';
  document.getElementById('airline-dropdown').style.display = 'none';
  renderSelectedTags();
  renderAirlineCards();
  renderSummary();
}

function removeAirline(iata) {
  state.flights = state.flights.filter(f => f.iata !== iata);
  renderSelectedTags();
  renderAirlineCards();
  renderSummary();
}

function setTier(iata, tierIndex) {
  const flight = state.flights.find(f => f.iata === iata);
  if (flight) {
    const airline = getAirline(iata);
    const tier = airline?.ticketTiers[tierIndex];
    // Prevent selecting unsupported tiers
    if (tier && !isTierSupported(tier)) return;
    flight.tierIndex = tierIndex;
    renderAirlineCards();
    renderSummary();
  }
}

// ── Tier support check ──
function isTierSupported(tier) {
  if (state.bags.personal && !tier.included.personal) return false;
  if (state.bags.carryOn && !tier.included.carryOn && tier.avgAddOnPriceUsd.carryOn === null) return false;
  if (state.bags.checked > 0 && tier.checkedBags) {
    const first = tier.checkedBags[0];
    if (first && !first.included && first.avgAddOnPriceUsd === null) return false;
  }
  return true;
}

function getTierUnsupportedReason(tier) {
  const reasons = [];
  if (state.bags.personal && !tier.included.personal) reasons.push('personal item');
  if (state.bags.carryOn && !tier.included.carryOn && tier.avgAddOnPriceUsd.carryOn === null) reasons.push('carry-on');
  if (state.bags.checked > 0 && tier.checkedBags) {
    const first = tier.checkedBags[0];
    if (first && !first.included && first.avgAddOnPriceUsd === null) reasons.push('checked bags');
  }
  return reasons;
}

// ── Selected tags ──
function renderSelectedTags() {
  const container = document.getElementById('selected-airlines');
  document.getElementById('airline-count-label').textContent = `${state.flights.length} selected`;
  if (state.flights.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = state.flights.map(f => {
    const a = getAirline(f.iata);
    return a ? `<span class="airline-tag" data-testid="airline-tag-${f.iata}">
      <span class="airline-tag-iata">${a.iata}</span><span class="airline-tag-name">${a.name}</span>
      <button class="airline-tag-remove" data-testid="remove-airline-${f.iata}" onclick="removeAirline('${f.iata}')" aria-label="Remove ${a.name}">
        <i data-lucide="x" style="width:14px;height:14px"></i></button></span>` : '';
  }).join('');
  lucide.createIcons();
}

// ── Cost calculation (v2 schema) ──
function getFlightCost(flight) {
  const airline = getAirline(flight.iata);
  if (!airline) return 0;
  const tier = airline.ticketTiers[flight.tierIndex];
  if (!tier) return 0;
  if (!isTierSupported(tier)) return 0;
  let cost = 0;

  // Carry-on
  if (state.bags.carryOn && !tier.included.carryOn) {
    const price = tier.avgAddOnPriceUsd.carryOn;
    if (price !== null && price > 0) cost += price;
  }

  // Checked bags — use the checkedBags array
  // If a bag's price is null and it's not included, fall back to 1st bag's price
  if (state.bags.checked > 0 && tier.checkedBags) {
    const firstBagPrice = tier.checkedBags[0] ? tier.checkedBags[0].avgAddOnPriceUsd : null;
    for (let i = 0; i < state.bags.checked; i++) {
      const bagEntry = tier.checkedBags[i];
      if (!bagEntry) { if (firstBagPrice !== null) cost += firstBagPrice; continue; }
      if (!bagEntry.included) {
        const price = bagEntry.avgAddOnPriceUsd !== null ? bagEntry.avgAddOnPriceUsd : firstBagPrice;
        if (price !== null && price > 0) cost += price;
      }
    }
  }

  return cost;
}

function getTotalCost() {
  return state.flights.reduce((sum, f) => sum + getFlightCost(f), 0);
}

// ── Minimum dimensions ──
function getMinDimensions() {
  if (state.flights.length === 0) return null;
  const result = { personal: { dims: null, weight: null }, carryOn: { dims: null, weight: null }, checked: { dims: null, weight: null } };

  for (const bt of ['personal', 'carryOn', 'checked']) {
    let minDims = null, minWeight = null, hasDim = false, hasWeight = false;
    for (const flight of state.flights) {
      const airline = getAirline(flight.iata);
      if (!airline) continue;
      const bag = airline.baggage[bt];
      if (!bag) continue;
      if (bag.dimensionsCm) {
        hasDim = true;
        if (bag.dimensionsCm.length === 1) {
          if (!minDims) minDims = [...bag.dimensionsCm];
          else if (minDims.length === 1) minDims[0] = Math.min(minDims[0], bag.dimensionsCm[0]);
        } else if (bag.dimensionsCm.length === 3) {
          if (!minDims) minDims = [...bag.dimensionsCm];
          else if (minDims.length === 3) { minDims[0] = Math.min(minDims[0], bag.dimensionsCm[0]); minDims[1] = Math.min(minDims[1], bag.dimensionsCm[1]); minDims[2] = Math.min(minDims[2], bag.dimensionsCm[2]); }
        }
      }
      if (bag.weightKg !== null && bag.weightKg !== undefined) {
        hasWeight = true;
        minWeight = minWeight === null ? bag.weightKg : Math.min(minWeight, bag.weightKg);
      }
    }
    result[bt] = { dims: hasDim ? minDims : null, weight: hasWeight ? minWeight : null };
  }
  return result;
}

// ── Render: Airline Cards ──
function renderAirlineCards() {
  const container = document.getElementById('airline-cards');
  if (state.flights.length === 0) {
    container.innerHTML = `<div class="section"><div class="empty-state" data-testid="empty-state">
      <i data-lucide="plane" style="width:48px;height:48px"></i>
      <p>Search and add airlines above to get started</p>
      <p class="hint">Choose the airlines you'll be flying with</p></div></div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.flights.map(flight => {
    const airline = getAirline(flight.iata);
    if (!airline) return '';
    const tier = airline.ticketTiers[flight.tierIndex];
    const totalCost = getFlightCost(flight);
    const supported = isTierSupported(tier);
    const unsupportedReasons = supported ? [] : getTierUnsupportedReason(tier);

    // Build tier options with disabled for unsupported
    const tierOptions = airline.ticketTiers.map((t, i) => {
      const sup = isTierSupported(t);
      const reasons = sup ? [] : getTierUnsupportedReason(t);
      const label = sup ? t.name : `${t.name} — no ${reasons.join(', ')}`;
      return `<option value="${i}" ${i === flight.tierIndex ? 'selected' : ''} ${!sup ? 'disabled' : ''}>${label}</option>`;
    }).join('');

    const bodyContent = supported ? `
          <div class="bag-spec-grid">
            ${renderPersonalSpec(airline, tier)}
            ${renderCarryOnSpec(airline, tier)}
            ${renderCheckedSpec(airline, tier)}
          </div>
          <div class="airline-note">${airline.notes}</div>`
      : `<div class="unsupported-overlay" data-testid="unsupported-overlay-${flight.iata}">
            <i data-lucide="circle-alert" style="width:24px;height:24px"></i>
            <div class="unsupported-text">Selected baggage not supported on this tier</div>
            <div class="unsupported-detail">No ${unsupportedReasons.join(', ')} on ${tier.name}. Choose a different tier above.</div>
          </div>`;

    return `
      <div class="section flight-card ${supported ? '' : 'flight-card-unsupported'}" data-testid="flight-card-${flight.iata}">
        <div class="flight-card-header">
          <div class="flight-card-airline">
            <span class="flight-card-iata">${airline.iata}</span>
            <span class="flight-card-name">${airline.name}</span>
          </div>
          <span class="flight-card-total" data-testid="flight-total-${flight.iata}">${supported ? '$' + totalCost : '—'}</span>
        </div>
        <div class="flight-card-body">
          <div class="tier-row">
            <span class="tier-label">Ticket Tier</span>
            <select class="tier-select" data-testid="tier-select-${flight.iata}" onchange="setTier('${flight.iata}', parseInt(this.value))">
              ${tierOptions}
            </select>
          </div>
          ${bodyContent}
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

function renderPersonalSpec(airline, tier) {
  const bag = airline.baggage.personal;
  const dimStr = bag ? formatDim(bag.dimensionsCm) : null;
  const weightStr = bag ? formatWeight(bag.weightKg) : null;
  const wantPersonal = state.bags.personal;
  const isIncluded = tier.included.personal;
  const isUnavailable = wantPersonal && !isIncluded;
  const cls = isUnavailable ? 'bag-spec unavailable' : 'bag-spec';

  let statusHtml = '';
  if (!wantPersonal) {
    statusHtml = '';
  } else if (isIncluded) {
    statusHtml = '<span class="bag-spec-status included">Included</span>';
  } else {
    statusHtml = '<span class="bag-spec-status unavailable-msg">Not included in this tier</span>';
  }

  return `<div class="${cls}" data-testid="bag-spec-personal-${airline.iata}">
    <div class="bag-spec-label">Personal Item</div>
    <div class="bag-spec-dims">${dimStr || '<span class="dim-na">No size limit listed</span>'}</div>
    <div class="bag-spec-weight">${weightStr || '<span class="dim-na">No weight limit</span>'}</div>
    ${statusHtml}</div>`;
}

function renderCarryOnSpec(airline, tier) {
  const bag = airline.baggage.carryOn;
  const dimStr = bag ? formatDim(bag.dimensionsCm) : null;
  const weightStr = bag ? formatWeight(bag.weightKg) : null;
  const wantCarryOn = state.bags.carryOn;
  const isIncluded = tier.included.carryOn;
  const price = tier.avgAddOnPriceUsd.carryOn;
  const isUnavailable = wantCarryOn && !isIncluded && price === null;
  const cls = isUnavailable ? 'bag-spec unavailable' : 'bag-spec';

  let statusHtml = '';
  if (!wantCarryOn) {
    statusHtml = '';
  } else if (isIncluded) {
    statusHtml = '<span class="bag-spec-status included">Included</span>';
  } else if (price === null) {
    statusHtml = '<span class="bag-spec-status unavailable-msg">Not available on this tier</span>';
  } else if (price === 0) {
    statusHtml = '<span class="bag-spec-status included">Free add-on</span>';
  } else {
    statusHtml = `<span class="bag-spec-status paid">$${price}</span>`;
  }

  return `<div class="${cls}" data-testid="bag-spec-carryOn-${airline.iata}">
    <div class="bag-spec-label">Carry-On</div>
    <div class="bag-spec-dims">${dimStr || '<span class="dim-na">No size limit listed</span>'}</div>
    <div class="bag-spec-weight">${weightStr || '<span class="dim-na">No weight limit</span>'}</div>
    ${statusHtml}</div>`;
}

function renderCheckedSpec(airline, tier) {
  const bag = airline.baggage.checked;
  const dimStr = bag ? formatDim(bag.dimensionsCm) : null;
  const weightStr = bag ? formatWeight(bag.weightKg) : null;
  const checkedCount = state.bags.checked;
  const oversizedFee = airline.oversizedCheckedBagCostUsd;
  const overweightFee = airline.overweightCheckedBagCostUsd;

  // Resolve: is this bag effectively included or paid?
  const firstBag = (tier.checkedBags && tier.checkedBags[0]) ? tier.checkedBags[0] : null;
  const firstBagIncluded = firstBag ? firstBag.included : false;
  const firstBagPrice = firstBag ? firstBag.avgAddOnPriceUsd : null;

  function resolvePrice(entry) {
    if (!entry) return firstBagPrice;
    if (entry.included) return 0;
    return entry.avgAddOnPriceUsd !== null ? entry.avgAddOnPriceUsd : firstBagPrice;
  }

  function isEffectivelyIncluded(entry, idx) {
    if (!entry) return firstBagIncluded;
    if (entry.included) return true;
    // If price is null and falls back to 1st bag which is included, treat as included
    if (entry.avgAddOnPriceUsd === null && firstBagIncluded) return true;
    return false;
  }

  // No grey-out needed now since null prices fall back to 1st bag price
  const cls = 'bag-spec';

  let statusHtml = '';
  if (checkedCount === 0) {
    statusHtml = '';
  } else if (tier.checkedBags) {
    const lines = [];
    for (let i = 0; i < checkedCount; i++) {
      const entry = tier.checkedBags[i];
      const w = entry ? formatWeight(entry.weightKg) : (tier.checkedBags[0] ? formatWeight(tier.checkedBags[0].weightKg) : null);
      if (isEffectivelyIncluded(entry, i)) {
        lines.push(`<div class="checked-bag-line incl">Bag ${i + 1}: Included${w ? ' (' + w + ')' : ''}</div>`);
      } else {
        const price = resolvePrice(entry);
        if (price !== null && price > 0) {
          const isFallback = entry && entry.avgAddOnPriceUsd === null;
          lines.push(`<div class="checked-bag-line cost">Bag ${i + 1}: $${price}${w ? ' (' + w + ')' : ''}${isFallback ? ' *' : ''}</div>`);
        } else {
          lines.push(`<div class="checked-bag-line unavail">Bag ${i + 1}: Varies by route${w ? ' (' + w + ')' : ''}</div>`);
        }
      }
    }
    // Footnote for fallback pricing (only for paid fallbacks, not included ones)
    const hasFallback = tier.checkedBags.slice(0, checkedCount).some((e, i) => i > 0 && e && !e.included && e.avgAddOnPriceUsd === null && firstBagPrice !== null && firstBagPrice > 0 && !firstBagIncluded);
    if (hasFallback) {
      lines.push(`<div class="checked-bag-footnote">* Estimated from 1st bag price</div>`);
    }
    statusHtml = `<div class="checked-bag-breakdown">${lines.join('')}</div>`;
  }

  // Overweight / oversized fee — always show line when checked bags selected
  let oversizedHtml = '';
  if (checkedCount > 0) {
    if (oversizedFee !== null && oversizedFee !== undefined) {
      oversizedHtml = `<div class="oversize-fee">Overweight / oversized: $${oversizedFee}</div>`;
    } else {
      oversizedHtml = `<div class="oversize-fee">Overweight / oversized bag fee: Not listed</div>`;
    }
    if (overweightFee !== null && overweightFee !== undefined) {
      overweightHtml = `<div class="overweight-fee">Overweight: $${overweightFee}</div>`;
    } else {
      overweightHtml = `<div class="overweight-fee">Overweight bag fee: Not listed</div>`;
    }
    oversizedHtml += overweightHtml;
  }

  return `<div class="${cls}" data-testid="bag-spec-checked-${airline.iata}">
    <div class="bag-spec-label">Checked</div>
    <div class="bag-spec-dims">${dimStr || '<span class="dim-na">No size limit listed</span>'}</div>
    <div class="bag-spec-weight">${weightStr || '<span class="dim-na">No weight limit</span>'}</div>
    ${statusHtml}
    ${oversizedHtml}</div>`;
}

// ── Render: Summary ──
function renderSummary() {
  const totalCost = getTotalCost();
  document.getElementById('summary-total-value').textContent = `$${totalCost}`;

  const noteEl = document.getElementById('summary-total-note');
  if (state.flights.length === 0) {
    noteEl.textContent = 'Select airlines to calculate';
  } else {
    const hasIssue = state.flights.some(f => {
      const airline = getAirline(f.iata);
      const tier = airline?.ticketTiers[f.tierIndex];
      if (!tier) return false;
      if (state.bags.personal && !tier.included.personal) return true;
      if (state.bags.carryOn && !tier.included.carryOn && tier.avgAddOnPriceUsd.carryOn === null) return true;
      if (state.bags.checked > 0 && tier.checkedBags) {
        const fb = tier.checkedBags[0] ? tier.checkedBags[0].avgAddOnPriceUsd : null;
        for (let i = 0; i < state.bags.checked; i++) {
          const e = tier.checkedBags[i];
          if (!e) { if (fb === null) return true; continue; }
          if (!e.included && e.avgAddOnPriceUsd === null && fb === null) return true;
        }
      }
      return false;
    });
    noteEl.textContent = hasIssue
      ? 'Some fees are route-dependent or unavailable'
      : `Across ${state.flights.length} airline${state.flights.length > 1 ? 's' : ''}`;
  }

  // Min dimensions
  const dimBody = document.getElementById('min-dims-body');
  const minDims = getMinDimensions();
  if (!minDims || state.flights.length === 0) {
    dimBody.innerHTML = '<tr><td colspan="3" class="dim-na" style="text-align:center; padding:1rem;">No airlines selected</td></tr>';
  } else {
    dimBody.innerHTML = [
      { key: 'personal', label: 'Personal Item' },
      { key: 'carryOn', label: 'Carry-On' },
      { key: 'checked', label: 'Checked' }
    ].map(bt => {
      const d = minDims[bt.key];
      return `<tr><td class="dim-bag-type">${bt.label}</td><td class="dim-value">${d.dims ? formatDim(d.dims) : '<span class="dim-na">N/A</span>'}</td><td class="dim-value">${d.weight !== null ? formatWeight(d.weight) : '<span class="dim-na">N/A</span>'}</td></tr>`;
    }).join('');
  }

  // Breakdown
  const breakdownEl = document.getElementById('airline-breakdown');
  if (state.flights.length === 0) {
    breakdownEl.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p style="font-size:0.8125rem">Cost breakdown will appear here</p></div>';
  } else {
    breakdownEl.innerHTML = state.flights.map(f => {
      const a = getAirline(f.iata);
      if (!a) return '';
      const tier = a.ticketTiers[f.tierIndex];
      return `<div class="breakdown-item" data-testid="breakdown-${f.iata}">
        <div class="breakdown-airline"><span class="breakdown-iata">${a.iata}</span>
          <div><div class="breakdown-name">${a.name}</div><div class="breakdown-tier">${tier ? tier.name : ''}</div></div></div>
        <span class="breakdown-cost" data-testid="breakdown-cost-${f.iata}">$${getFlightCost(f)}</span></div>`;
    }).join('');
  }

  // Warning
  const w = document.getElementById('min-dims-warning');
  if (state.flights.length >= 2) { w.innerHTML = 'Pack to the smallest dimensions across your flights to avoid issues at any gate.'; w.style.display = 'block'; }
  else { w.style.display = 'none'; }
}

// ── Close dropdown on outside click ──
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.airline-search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('airline-dropdown').style.display = 'none';
  }
});

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  const resp = await fetch('data/airlines.json');
  airlineData = await resp.json();

  applyTheme();
  document.querySelectorAll('.unit-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.unit === state.units));
  renderGlobalBags();
  renderSelectedTags();
  renderAirlineCards();
  renderSummary();
  lucide.createIcons();
});
