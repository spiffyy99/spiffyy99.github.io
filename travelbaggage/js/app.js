// ── State ──
let airlineData = null;

const state = {
  theme: localStorage.getItem('tb-theme') || 'light',
  units: localStorage.getItem('tb-units') || 'metric',
  bags: { personal: 0, carryOn: 0, checked: 0 },
  flights: []
  // each: { iata, tierIndex }
};

// ── Conversion helpers ──
const CM_TO_IN = 0.393701;
const KG_TO_LB = 2.20462;

function cmToIn(cm) { return +(cm * CM_TO_IN).toFixed(1); }
function kgToLb(kg) { return +(kg * KG_TO_LB).toFixed(1); }

function formatDim(cmArr) {
  if (!cmArr) return null;
  if (state.units === 'metric') {
    return cmArr.length === 1
      ? `${cmArr[0]} cm (linear)`
      : `${cmArr[0]} x ${cmArr[1]} x ${cmArr[2]} cm`;
  }
  const inArr = cmArr.map(cmToIn);
  return inArr.length === 1
    ? `${inArr[0]} in (linear)`
    : `${inArr[0]} x ${inArr[1]} x ${inArr[2]} in`;
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

// ── Global bag counts ──
function setGlobalBag(bagType, delta) {
  const newVal = state.bags[bagType] + delta;
  if (newVal < 0 || newVal > 5) return;
  state.bags[bagType] = newVal;
  renderGlobalBags();
  renderAirlineCards();
  renderSummary();
}

function renderGlobalBags() {
  ['personal', 'carryOn', 'checked'].forEach(bt => {
    const el = document.getElementById(`count-${bt}`);
    if (el) el.textContent = state.bags[bt];
    // disable buttons
    const dec = document.querySelector(`[data-testid="decrement-${bt}"]`);
    const inc = document.querySelector(`[data-testid="increment-${bt}"]`);
    if (dec) dec.disabled = state.bags[bt] <= 0;
    if (inc) inc.disabled = state.bags[bt] >= 5;
  });
}

// ── Airline search dropdown ──
let dropdownOpen = false;

function openDropdown() {
  const dd = document.getElementById('airline-dropdown');
  dd.style.display = 'block';
  dropdownOpen = true;
  filterDropdown();
}

function closeDropdown() {
  setTimeout(() => {
    const dd = document.getElementById('airline-dropdown');
    dd.style.display = 'none';
    dropdownOpen = false;
  }, 150);
}

function filterDropdown() {
  const input = document.getElementById('airline-search');
  const query = input.value.toLowerCase().trim();
  const dd = document.getElementById('airline-dropdown');
  const selectedIatas = state.flights.map(f => f.iata);

  const matches = airlineData.airlines.filter(a => {
    if (selectedIatas.includes(a.iata)) return false;
    if (!query) return true;
    return a.name.toLowerCase().includes(query) || a.iata.toLowerCase().includes(query);
  });

  if (matches.length === 0) {
    dd.innerHTML = `<div class="dropdown-empty">No airlines found</div>`;
  } else {
    dd.innerHTML = matches.map(a => `
      <button class="dropdown-item" data-testid="dropdown-item-${a.iata}" onmousedown="addAirline('${a.iata}')">
        <span class="dropdown-iata">${a.iata}</span>
        <span>${a.name}</span>
      </button>
    `).join('');
  }
}

function addAirline(iata) {
  if (state.flights.find(f => f.iata === iata)) return;
  state.flights.push({ iata, tierIndex: 0 });
  const input = document.getElementById('airline-search');
  input.value = '';
  closeDropdown();
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
    flight.tierIndex = tierIndex;
    renderAirlineCards();
    renderSummary();
  }
}

// ── Selected airline tags ──
function renderSelectedTags() {
  const container = document.getElementById('selected-airlines');
  const countLabel = document.getElementById('airline-count-label');
  countLabel.textContent = `${state.flights.length} selected`;

  if (state.flights.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = state.flights.map(f => {
    const airline = getAirline(f.iata);
    if (!airline) return '';
    return `
      <span class="airline-tag" data-testid="airline-tag-${f.iata}">
        <span class="airline-tag-iata">${airline.iata}</span>
        <span class="airline-tag-name">${airline.name}</span>
        <button class="airline-tag-remove" data-testid="remove-airline-${f.iata}" onclick="removeAirline('${f.iata}')" aria-label="Remove ${airline.name}">
          <i data-lucide="x" style="width:14px;height:14px"></i>
        </button>
      </span>
    `;
  }).join('');

  lucide.createIcons();
}

// ── Cost calculation ──
function getBagStatus(airline, tier, bagType, count) {
  // Returns: { status: 'included'|'paid'|'unavailable'|'none', cost, message }
  if (count === 0) return { status: 'none', cost: 0, message: '' };

  if (bagType === 'personal') {
    if (tier.included.personal) {
      return { status: 'included', cost: 0, message: 'Included' };
    } else {
      return { status: 'unavailable', cost: 0, message: 'Not included in this tier' };
    }
  }

  if (bagType === 'carryOn') {
    if (tier.included.carryOn) {
      return { status: 'included', cost: 0, message: 'Included' };
    }
    const price = tier.avgAddOnPriceUsd.carryOn;
    if (price === null) {
      return { status: 'unavailable', cost: 0, message: 'Not available on this tier' };
    }
    if (price === 0) {
      return { status: 'included', cost: 0, message: 'Free add-on' };
    }
    const total = price * count;
    return { status: 'paid', cost: total, message: `$${price}/ea x ${count} = $${total}` };
  }

  if (bagType === 'checked') {
    const included = tier.included.checked || 0;
    if (count <= included) {
      return { status: 'included', cost: 0, message: `${included} included` };
    }
    const paidCount = count - included;
    const price = tier.avgAddOnPriceUsd.checked;
    if (price === null) {
      return { status: 'unavailable', cost: 0, message: included > 0
        ? `${included} included, extra bags vary by route`
        : 'Pricing varies by route' };
    }
    if (price === 0) {
      return { status: 'included', cost: 0, message: 'Included' };
    }
    const total = price * paidCount;
    const msg = included > 0
      ? `${included} incl. + $${price} x ${paidCount} = $${total}`
      : `$${price}/ea x ${paidCount} = $${total}`;
    return { status: 'paid', cost: total, message: msg };
  }

  return { status: 'none', cost: 0, message: '' };
}

function getFlightCost(flight) {
  const airline = getAirline(flight.iata);
  if (!airline) return 0;
  const tier = airline.ticketTiers[flight.tierIndex];
  if (!tier) return 0;

  let cost = 0;
  cost += getBagStatus(airline, tier, 'personal', state.bags.personal).cost;
  cost += getBagStatus(airline, tier, 'carryOn', state.bags.carryOn).cost;
  cost += getBagStatus(airline, tier, 'checked', state.bags.checked).cost;
  return cost;
}

function getTotalCost() {
  return state.flights.reduce((sum, f) => sum + getFlightCost(f), 0);
}

// ── Minimum dimensions ──
function getMinDimensions() {
  if (state.flights.length === 0) return null;

  const result = { personal: { dims: null, weight: null }, carryOn: { dims: null, weight: null }, checked: { dims: null, weight: null } };
  const bagTypes = ['personal', 'carryOn', 'checked'];

  for (const bt of bagTypes) {
    let minDims = null;
    let minWeight = null;
    let hasDimData = false;
    let hasWeightData = false;

    for (const flight of state.flights) {
      const airline = getAirline(flight.iata);
      if (!airline) continue;
      const bag = airline.baggage[bt];
      if (!bag) continue;

      if (bag.dimensionsCm) {
        hasDimData = true;
        if (bag.dimensionsCm.length === 1) {
          if (minDims === null) minDims = [...bag.dimensionsCm];
          else if (minDims.length === 1) minDims[0] = Math.min(minDims[0], bag.dimensionsCm[0]);
        } else if (bag.dimensionsCm.length === 3) {
          if (minDims === null) minDims = [...bag.dimensionsCm];
          else if (minDims.length === 3) {
            minDims[0] = Math.min(minDims[0], bag.dimensionsCm[0]);
            minDims[1] = Math.min(minDims[1], bag.dimensionsCm[1]);
            minDims[2] = Math.min(minDims[2], bag.dimensionsCm[2]);
          }
        }
      }

      if (bag.weightKg !== null && bag.weightKg !== undefined) {
        hasWeightData = true;
        minWeight = minWeight === null ? bag.weightKg : Math.min(minWeight, bag.weightKg);
      }
    }

    result[bt] = { dims: hasDimData ? minDims : null, weight: hasWeightData ? minWeight : null };
  }

  return result;
}

// ── Render: Airline Cards ──
function renderAirlineCards() {
  const container = document.getElementById('airline-cards');

  if (state.flights.length === 0) {
    container.innerHTML = `
      <div class="section">
        <div class="empty-state" data-testid="empty-state">
          <i data-lucide="plane" style="width:48px;height:48px"></i>
          <p>Search and add airlines above to get started</p>
          <p class="hint">Choose the airlines you'll be flying with</p>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.flights.map(flight => {
    const airline = getAirline(flight.iata);
    if (!airline) return '';
    const tier = airline.ticketTiers[flight.tierIndex];

    const personalStatus = getBagStatus(airline, tier, 'personal', state.bags.personal);
    const carryOnStatus = getBagStatus(airline, tier, 'carryOn', state.bags.carryOn);
    const checkedStatus = getBagStatus(airline, tier, 'checked', state.bags.checked);

    const totalCost = getFlightCost(flight);

    return `
      <div class="section flight-card" data-testid="flight-card-${flight.iata}">
        <div class="flight-card-header">
          <div class="flight-card-airline">
            <span class="flight-card-iata">${airline.iata}</span>
            <span class="flight-card-name">${airline.name}</span>
          </div>
          <div class="flight-card-right">
            <span class="flight-card-total" data-testid="flight-total-${flight.iata}">$${totalCost}</span>
          </div>
        </div>
        <div class="flight-card-body">
          <div class="tier-row">
            <span class="tier-label">Ticket Tier</span>
            <select class="tier-select" data-testid="tier-select-${flight.iata}" onchange="setTier('${flight.iata}', parseInt(this.value))">
              ${airline.ticketTiers.map((t, i) => `
                <option value="${i}" ${i === flight.tierIndex ? 'selected' : ''}>${t.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="bag-spec-grid">
            ${renderBagSpec(airline, 'personal', 'Personal Item', personalStatus)}
            ${renderBagSpec(airline, 'carryOn', 'Carry-On', carryOnStatus)}
            ${renderBagSpec(airline, 'checked', 'Checked', checkedStatus)}
          </div>
          <div class="airline-note">${airline.notes}</div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function renderBagSpec(airline, bagType, label, bagStatus) {
  const bag = airline.baggage[bagType];
  const dimStr = bag ? formatDim(bag.dimensionsCm) : null;
  const weightStr = bag ? formatWeight(bag.weightKg) : null;

  const isUnavailable = bagStatus.status === 'unavailable';
  const isNone = bagStatus.status === 'none';
  const wrapClass = isUnavailable ? 'bag-spec unavailable' : 'bag-spec';

  let statusHtml = '';
  if (bagStatus.status === 'included') {
    statusHtml = `<span class="bag-spec-status included">${bagStatus.message}</span>`;
  } else if (bagStatus.status === 'paid') {
    statusHtml = `<span class="bag-spec-status paid">${bagStatus.message}</span>`;
  } else if (bagStatus.status === 'unavailable') {
    statusHtml = `<span class="bag-spec-status unavailable-msg">${bagStatus.message}</span>`;
  }

  return `
    <div class="${wrapClass}" data-testid="bag-spec-${bagType}-${airline.iata}">
      <div class="bag-spec-label">${label}</div>
      <div class="bag-spec-dims">${dimStr || '<span class="dim-na">No size limit listed</span>'}</div>
      <div class="bag-spec-weight">${weightStr || '<span class="dim-na">No weight limit</span>'}</div>
      ${statusHtml}
    </div>
  `;
}

// ── Render: Summary Panel ──
function renderSummary() {
  const totalCost = getTotalCost();
  const minDims = getMinDimensions();

  const totalEl = document.getElementById('summary-total-value');
  totalEl.textContent = `$${totalCost}`;

  const noteEl = document.getElementById('summary-total-note');
  if (state.flights.length === 0) {
    noteEl.textContent = 'Select airlines to calculate';
  } else {
    const hasUnavailable = state.flights.some(f => {
      const airline = getAirline(f.iata);
      const tier = airline?.ticketTiers[f.tierIndex];
      if (!tier) return false;
      return (state.bags.personal > 0 && !tier.included.personal) ||
        (state.bags.carryOn > 0 && !tier.included.carryOn && tier.avgAddOnPriceUsd.carryOn === null) ||
        (state.bags.checked > 0 && tier.avgAddOnPriceUsd.checked === null && (tier.included.checked || 0) < state.bags.checked);
    });
    noteEl.textContent = hasUnavailable
      ? 'Some fees are route-dependent or unavailable'
      : `Across ${state.flights.length} airline${state.flights.length > 1 ? 's' : ''}`;
  }

  // Min dimensions
  const dimBody = document.getElementById('min-dims-body');
  if (!minDims || state.flights.length === 0) {
    dimBody.innerHTML = `<tr><td colspan="3" class="dim-na" style="text-align:center; padding:1rem;">No airlines selected</td></tr>`;
  } else {
    const bagTypes = [
      { key: 'personal', label: 'Personal Item' },
      { key: 'carryOn', label: 'Carry-On' },
      { key: 'checked', label: 'Checked' }
    ];
    dimBody.innerHTML = bagTypes.map(bt => {
      const data = minDims[bt.key];
      const dimStr = data.dims ? formatDim(data.dims) : '<span class="dim-na">N/A</span>';
      const weightStr = data.weight !== null ? formatWeight(data.weight) : '<span class="dim-na">N/A</span>';
      return `<tr><td class="dim-bag-type">${bt.label}</td><td class="dim-value">${dimStr}</td><td class="dim-value">${weightStr}</td></tr>`;
    }).join('');
  }

  // Airline breakdown
  const breakdownEl = document.getElementById('airline-breakdown');
  if (state.flights.length === 0) {
    breakdownEl.innerHTML = `<div class="empty-state" style="padding:1.5rem"><p style="font-size:0.8125rem">Cost breakdown will appear here</p></div>`;
  } else {
    breakdownEl.innerHTML = state.flights.map(flight => {
      const airline = getAirline(flight.iata);
      if (!airline) return '';
      const tier = airline.ticketTiers[flight.tierIndex];
      const cost = getFlightCost(flight);
      return `
        <div class="breakdown-item" data-testid="breakdown-${flight.iata}">
          <div class="breakdown-airline">
            <span class="breakdown-iata">${airline.iata}</span>
            <div>
              <div class="breakdown-name">${airline.name}</div>
              <div class="breakdown-tier">${tier ? tier.name : ''}</div>
            </div>
          </div>
          <span class="breakdown-cost" data-testid="breakdown-cost-${flight.iata}">$${cost}</span>
        </div>
      `;
    }).join('');
  }

  // Min dims warning
  const warningEl = document.getElementById('min-dims-warning');
  if (state.flights.length >= 2) {
    warningEl.innerHTML = `Pack to the smallest dimensions across your flights to avoid issues at any gate.`;
    warningEl.style.display = 'block';
  } else {
    warningEl.style.display = 'none';
  }
}

// ── Close dropdown on outside click ──
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.airline-search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('airline-dropdown');
    if (dd) dd.style.display = 'none';
    dropdownOpen = false;
  }
});

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  // Load airline data from JSON
  const resp = await fetch('data/airlines.json');
  airlineData = await resp.json();

  applyTheme();
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === state.units);
  });

  renderGlobalBags();
  renderSelectedTags();
  renderAirlineCards();
  renderSummary();
  lucide.createIcons();
});
