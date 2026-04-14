// ── State ──
const state = {
  theme: localStorage.getItem('tb-theme') || 'light',
  units: localStorage.getItem('tb-units') || 'metric',
  selectedAirlines: [],
  // { iata, tierIndex, personal, carryOn, checked }
  flights: []
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

function dimLabel() { return state.units === 'metric' ? 'cm' : 'in'; }
function weightLabel() { return state.units === 'metric' ? 'kg' : 'lbs'; }

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
  renderFlights();
  renderSummary();
}

// ── Airline helpers ──
function getAirline(iata) {
  return AIRLINE_DATA.airlines.find(a => a.iata === iata);
}

function toggleAirline(iata) {
  const idx = state.flights.findIndex(f => f.iata === iata);
  if (idx !== -1) {
    state.flights.splice(idx, 1);
  } else {
    state.flights.push({ iata, tierIndex: 0, personal: 0, carryOn: 0, checked: 0 });
  }
  renderAirlineGrid();
  renderFlights();
  renderSummary();
}

function removeAirline(iata) {
  state.flights = state.flights.filter(f => f.iata !== iata);
  renderAirlineGrid();
  renderFlights();
  renderSummary();
}

function setTier(iata, tierIndex) {
  const flight = state.flights.find(f => f.iata === iata);
  if (flight) {
    flight.tierIndex = tierIndex;
    renderFlights();
    renderSummary();
  }
}

function setBagCount(iata, bagType, delta) {
  const flight = state.flights.find(f => f.iata === iata);
  if (!flight) return;
  const newVal = flight[bagType] + delta;
  if (newVal < 0) return;
  if (newVal > 5) return;
  flight[bagType] = newVal;
  renderFlights();
  renderSummary();
}

// ── Cost calculation ──
function getFlightCost(flight) {
  const airline = getAirline(flight.iata);
  if (!airline) return 0;
  const tier = airline.ticketTiers[flight.tierIndex];
  if (!tier) return 0;

  let cost = 0;

  // Personal item
  if (flight.personal > 0 && !tier.included.personal) {
    // no published add-on price for personal items usually
    // but if personal not included, it basically can't be brought
  }

  // Carry-on
  if (flight.carryOn > 0) {
    if (!tier.included.carryOn) {
      const price = tier.avgAddOnPriceUsd.carryOn;
      if (price !== null) {
        cost += price * flight.carryOn;
      }
    }
  }

  // Checked
  if (flight.checked > 0) {
    const includedChecked = tier.included.checked || 0;
    const paidChecked = Math.max(0, flight.checked - includedChecked);
    if (paidChecked > 0) {
      const price = tier.avgAddOnPriceUsd.checked;
      if (price !== null) {
        cost += price * paidChecked;
      }
    }
  }

  return cost;
}

function getTotalCost() {
  return state.flights.reduce((sum, f) => sum + getFlightCost(f), 0);
}

// ── Minimum dimensions calculation ──
function getMinDimensions() {
  if (state.flights.length === 0) return null;

  const result = {
    personal: { dims: null, weight: null },
    carryOn: { dims: null, weight: null },
    checked: { dims: null, weight: null }
  };

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
          // Linear measurement
          if (minDims === null) {
            minDims = [...bag.dimensionsCm];
          } else if (minDims.length === 1) {
            minDims[0] = Math.min(minDims[0], bag.dimensionsCm[0]);
          }
          // If mixing linear and LxWxH, skip comparison (different systems)
        } else if (bag.dimensionsCm.length === 3) {
          if (minDims === null) {
            minDims = [...bag.dimensionsCm];
          } else if (minDims.length === 3) {
            // Take minimum of each dimension
            minDims[0] = Math.min(minDims[0], bag.dimensionsCm[0]);
            minDims[1] = Math.min(minDims[1], bag.dimensionsCm[1]);
            minDims[2] = Math.min(minDims[2], bag.dimensionsCm[2]);
          }
        }
      }

      if (bag.weightKg !== null && bag.weightKg !== undefined) {
        hasWeightData = true;
        if (minWeight === null) {
          minWeight = bag.weightKg;
        } else {
          minWeight = Math.min(minWeight, bag.weightKg);
        }
      }
    }

    result[bt] = {
      dims: hasDimData ? minDims : null,
      weight: hasWeightData ? minWeight : null
    };
  }

  return result;
}

// ── Render: Airline Grid ──
function renderAirlineGrid() {
  const container = document.getElementById('airline-grid');
  const selectedIatas = state.flights.map(f => f.iata);

  // Update count label
  const countLabel = document.getElementById('airline-count-label');
  countLabel.textContent = `${selectedIatas.length} selected`;

  container.innerHTML = AIRLINE_DATA.airlines.map(airline => {
    const selected = selectedIatas.includes(airline.iata);
    return `
      <button
        class="airline-chip ${selected ? 'selected' : ''}"
        data-testid="airline-chip-${airline.iata}"
        onclick="toggleAirline('${airline.iata}')"
        aria-pressed="${selected}"
      >
        <span class="iata">${airline.iata}</span>
        <span>${airline.name}</span>
        <span class="checkmark">
          <i data-lucide="check" style="width:14px;height:14px"></i>
        </span>
      </button>
    `;
  }).join('');

  lucide.createIcons();
}

// ── Render: Flight Cards ──
function renderFlights() {
  const container = document.getElementById('flight-cards');

  if (state.flights.length === 0) {
    container.innerHTML = `
      <div class="empty-state" data-testid="empty-state">
        <i data-lucide="plane" style="width:48px;height:48px"></i>
        <p>Select airlines above to get started</p>
        <p class="hint">Choose the airlines you'll be flying with</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.flights.map(flight => {
    const airline = getAirline(flight.iata);
    if (!airline) return '';
    const tier = airline.ticketTiers[flight.tierIndex];

    return `
      <div class="flight-card" data-testid="flight-card-${flight.iata}">
        <div class="flight-card-header">
          <div class="flight-card-airline">
            <span class="flight-card-iata">${airline.iata}</span>
            <span class="flight-card-name">${airline.name}</span>
          </div>
          <button class="flight-card-remove" data-testid="remove-airline-${flight.iata}" onclick="removeAirline('${flight.iata}')" aria-label="Remove ${airline.name}">
            <i data-lucide="x" style="width:16px;height:16px"></i>
          </button>
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
          <div class="bag-counters">
            ${renderBagCounter(flight, airline, tier, 'personal', 'Personal Item')}
            ${renderBagCounter(flight, airline, tier, 'carryOn', 'Carry-On')}
            ${renderBagCounter(flight, airline, tier, 'checked', 'Checked Bag')}
          </div>
          <div class="airline-specs">
            ${renderSpecBox(airline, 'personal', 'Personal')}
            ${renderSpecBox(airline, 'carryOn', 'Carry-On')}
            ${renderSpecBox(airline, 'checked', 'Checked')}
          </div>
          <div class="airline-note">${airline.notes}</div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function renderBagCounter(flight, airline, tier, bagType, label) {
  const count = flight[bagType];
  let costInfo = '';
  let statusLine = '';

  if (bagType === 'personal') {
    if (tier.included.personal) {
      statusLine = `<span class="bag-counter-included">included</span>`;
    } else {
      statusLine = `<span class="bag-counter-unavailable">not included</span>`;
    }
  } else if (bagType === 'carryOn') {
    if (tier.included.carryOn) {
      statusLine = `<span class="bag-counter-included">included</span>`;
    } else {
      const price = tier.avgAddOnPriceUsd.carryOn;
      if (price === null) {
        statusLine = `<span class="bag-counter-unavailable">varies by route</span>`;
      } else if (price > 0) {
        const totalBagCost = price * count;
        statusLine = count > 0
          ? `<span class="bag-counter-cost has-cost">$${price}/ea = $${totalBagCost}</span>`
          : `<span class="bag-counter-cost">$${price} each</span>`;
      } else {
        statusLine = `<span class="bag-counter-cost">free add-on</span>`;
      }
    }
  } else if (bagType === 'checked') {
    const includedCount = tier.included.checked || 0;
    const price = tier.avgAddOnPriceUsd.checked;
    if (includedCount > 0 && count <= includedCount) {
      statusLine = `<span class="bag-counter-included">${includedCount} included</span>`;
    } else if (includedCount > 0 && count > includedCount) {
      const paidBags = count - includedCount;
      if (price === null) {
        statusLine = `<span class="bag-counter-cost">${includedCount} incl. + ${paidBags} varies</span>`;
      } else {
        const totalBagCost = price * paidBags;
        statusLine = `<span class="bag-counter-cost has-cost">${includedCount} incl. + $${totalBagCost}</span>`;
      }
    } else {
      if (price === null) {
        statusLine = `<span class="bag-counter-unavailable">varies by route</span>`;
      } else if (price > 0) {
        const totalBagCost = price * count;
        statusLine = count > 0
          ? `<span class="bag-counter-cost has-cost">$${price}/ea = $${totalBagCost}</span>`
          : `<span class="bag-counter-cost">$${price} each</span>`;
      } else {
        statusLine = `<span class="bag-counter-cost">$0 add-on</span>`;
      }
    }
  }

  return `
    <div class="bag-counter" data-testid="bag-counter-${bagType}-${flight.iata}">
      <span class="bag-counter-label">${label}</span>
      <div class="bag-counter-controls">
        <button class="counter-btn" data-testid="decrement-${bagType}-${flight.iata}" onclick="setBagCount('${flight.iata}', '${bagType}', -1)" ${count <= 0 ? 'disabled' : ''} aria-label="Decrease ${label}">-</button>
        <span class="counter-value" data-testid="count-${bagType}-${flight.iata}">${count}</span>
        <button class="counter-btn" data-testid="increment-${bagType}-${flight.iata}" onclick="setBagCount('${flight.iata}', '${bagType}', 1)" ${count >= 5 ? 'disabled' : ''} aria-label="Increase ${label}">+</button>
      </div>
      ${statusLine}
    </div>
  `;
}

function renderSpecBox(airline, bagType, label) {
  const bag = airline.baggage[bagType];
  if (!bag) return `
    <div class="spec-box">
      <div class="spec-box-label">${label}</div>
      <div class="spec-box-dim dim-na">No data</div>
    </div>
  `;

  const dimStr = formatDim(bag.dimensionsCm);
  const weightStr = formatWeight(bag.weightKg);

  return `
    <div class="spec-box">
      <div class="spec-box-label">${label}</div>
      <div class="spec-box-dim">${dimStr || '<span class="dim-na">No size limit listed</span>'}</div>
      ${weightStr ? `<div class="spec-box-weight">${weightStr}</div>` : '<div class="spec-box-weight dim-na">No weight limit</div>'}
    </div>
  `;
}

// ── Render: Summary Panel ──
function renderSummary() {
  const totalCost = getTotalCost();
  const minDims = getMinDimensions();

  // Total cost
  const totalEl = document.getElementById('summary-total-value');
  totalEl.textContent = `$${totalCost}`;

  const noteEl = document.getElementById('summary-total-note');
  if (state.flights.length === 0) {
    noteEl.textContent = 'Select airlines to calculate';
  } else {
    const routeDependent = state.flights.some(f => {
      const airline = getAirline(f.iata);
      const tier = airline?.ticketTiers[f.tierIndex];
      if (!tier) return false;
      return tier.avgAddOnPriceUsd.checked === null || tier.avgAddOnPriceUsd.carryOn === null;
    });
    noteEl.textContent = routeDependent
      ? 'Some fees are route-dependent and not included'
      : `Across ${state.flights.length} airline${state.flights.length > 1 ? 's' : ''}`;
  }

  // Min dimensions
  const dimBody = document.getElementById('min-dims-body');
  if (!minDims || state.flights.length === 0) {
    dimBody.innerHTML = `
      <tr><td colspan="3" class="dim-na" style="text-align:center; padding:1rem;">No airlines selected</td></tr>
    `;
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
      return `
        <tr>
          <td class="dim-bag-type">${bt.label}</td>
          <td class="dim-value">${dimStr}</td>
          <td class="dim-value">${weightStr}</td>
        </tr>
      `;
    }).join('');
  }

  // Airline breakdown
  const breakdownEl = document.getElementById('airline-breakdown');
  if (state.flights.length === 0) {
    breakdownEl.innerHTML = `
      <div class="empty-state" style="padding:1.5rem">
        <p style="font-size:0.8125rem">Cost breakdown will appear here</p>
      </div>
    `;
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

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();

  // Set unit toggle
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === state.units);
  });

  renderAirlineGrid();
  renderFlights();
  renderSummary();
});
