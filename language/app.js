(() => {
  'use strict';

  // ---------- Korean number rendering ----------

  const SINO_DIGITS = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const SINO_PLACES = ['', '십', '백', '천'];
  const SINO_MAGS = ['', '만', '억', '조', '경'];
  const DIGIT_READ = ['공', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

  const NATIVE_CARDINAL = {
    1: '하나', 2: '둘', 3: '셋', 4: '넷', 5: '다섯',
    6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉',
    10: '열', 20: '스물', 30: '서른', 40: '마흔',
    50: '쉰', 60: '예순', 70: '일흔', 80: '여든', 90: '아흔',
  };
  const NATIVE_ATTR = {
    1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯',
    6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉',
    10: '열', 20: '스무', 30: '서른', 40: '마흔',
    50: '쉰', 60: '예순', 70: '일흔', 80: '여든', 90: '아흔',
  };
  const POWERS_OF_TEN = {
    '10': '십',
    '100': '백',
    '1K': '천',
    '10K': '만',
    '100K': '십만',
    '1M': '백만',
    '10M': '천만',
    '100M': '억',
    '1B': '십억',
    '10B': '백억',
    '100B': '천억',
  }

  function sinoChunk(n) {
    if (n === 0) return '';
    const out = [];
    let place = 0;
    while (n > 0) {
      const d = n % 10;
      n = Math.floor(n / 10);
      if (d !== 0) {
        if (d === 1 && place > 0) {
          out.unshift(SINO_PLACES[place]);
        } else {
          out.unshift(SINO_DIGITS[d] + SINO_PLACES[place]);
        }
      }
      place++;
    }
    return out.join('');
  }

  function sinoInt(n) {
    if (n === 0) return '영';
    if (n < 0) return '마이너스 ' + sinoInt(-n);
    const parts = [];
    let mag = 0;
    let remaining = n;
    while (remaining > 0) {
      const chunk = remaining % 10000;
      remaining = Math.floor(remaining / 10000);
      if (chunk !== 0) {
        let chunkStr = sinoChunk(chunk);
        // For 만 (mag 1) when chunk is exactly 1, drop the 일 prefix → just 만
        if (mag === 1 && chunk === 1) chunkStr = '';
        parts.unshift(chunkStr + SINO_MAGS[mag]);
      }
      mag++;
    }
    return parts.join(' ');
  }

  function sinoDecimal(n) {
    if (Number.isInteger(n)) return sinoInt(n);
    const negative = n < 0;
    const abs = Math.abs(n);
    const intPart = Math.floor(abs);
    // Take decimal digits as a string from the original toString
    const dotStr = abs.toString();
    const dotIdx = dotStr.indexOf('.');
    const decPart = dotIdx === -1 ? '' : dotStr.slice(dotIdx + 1);
    const intStr = intPart === 0 ? '영' : sinoInt(intPart);
    let decStr = '';
    for (const ch of decPart) {
      const d = parseInt(ch, 10);
      decStr += SINO_DIGITS[d];
    }
    const out = `${intStr} 점 ${decStr}`;
    return negative ? '마이너스 ' + out : out;
  }

  function nativeNumber(n, attributive = true) {
    if (n < 1) return sinoInt(n);
    if (n > 99) return sinoInt(n); // native only goes to 99
    const dict = attributive ? NATIVE_ATTR : NATIVE_CARDINAL;
    if (n <= 10) return dict[n];
    if (n < 20) return NATIVE_CARDINAL[10] + dict[n - 10];
    const tens = Math.floor(n / 10) * 10;
    const ones = n % 10;
    if (ones === 0) {
      // standalone 20 → 스무 (attributive), but in compounds it's still 스물
      return dict[tens];
    }
    // For compounds, 20 always uses 스물 even in attributive context
    const tensPart = tens === 20 ? NATIVE_CARDINAL[20] : NATIVE_CARDINAL[tens];
    return tensPart + dict[ones];
  }

  function digitsRead(s) {
    return String(s)
      .split('')
      .map((ch) => {
        const d = parseInt(ch, 10);
        return Number.isNaN(d) ? '' : DIGIT_READ[d];
      })
      .join('');
  }

  function ordinalSuffix(n) {
    const num = Math.abs(parseInt(n, 10));
    if (Number.isNaN(num)) return 'th';
    const mod100 = num % 100;
    const mod10 = num % 10;
    if (mod100 >= 11 && mod100 <= 13) return 'th';
    if (mod10 === 1) return 'st';
    if (mod10 === 2) return 'nd';
    if (mod10 === 3) return 'rd';
    return 'th';
  }

  function renderNumber(value, system) {
    if (system === 'native') return nativeNumber(Math.floor(Number(value)), true);
    if (system === 'sino') return sinoDecimal(Number(value));
    if (system === 'digit') return digitsRead(value);
    // default fallback: sino
    return sinoDecimal(Number(value));
  }

  // ---------- Random helpers ----------

  function randInt(min, max, step = 1) {
    const lo = Math.ceil(min / step) * step;
    const hi = Math.floor(max / step) * step;
    if (hi < lo) return lo;
    const slots = Math.floor((hi - lo) / step) + 1;
    return lo + Math.floor(Math.random() * slots) * step;
  }

  function randomNumberValue(min, max, allowDecimal) {
    if (allowDecimal) {
      const places = Math.random() < 0.5 ? 1 : 2;
      const factor = Math.pow(10, places);
      const lo = Math.ceil(min * factor);
      const hi = Math.floor(max * factor);
      const v = lo + Math.floor(Math.random() * (hi - lo + 1));
      return Math.round(v) / factor;
    }
    return randInt(Math.ceil(min), Math.floor(max), 1);
  }

  function randomDigits(length) {
    let s = '';
    for (let i = 0; i < length; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Config flattening ----------

  function flattenConfig(config) {
    const items = [];
    for (const cat of config.categories) {
      if (Array.isArray(cat.subcategories)) {
        for (const sub of cat.subcategories) {
          items.push({
            id: `${cat.id}::${sub.id}`,
            categoryId: cat.id,
            categoryLabel: cat.label,
            subcatId: sub.id,
            subcatLabel: sub.label,
            variables: sub.variables || {},
            templates: sub.templates || [],
          });
        }
      } else {
        items.push({
          id: cat.id,
          categoryId: cat.id,
          categoryLabel: cat.label,
          subcatId: cat.id,
          subcatLabel: cat.label,
          variables: cat.variables || {},
          templates: cat.templates || [],
        });
      }
    }
    return items;
  }

  function itemSupportsDecimals(item) {
    return Object.values(item.variables).some((v) => v && v.decimal === true);
  }

  // ---------- Variable value generation ----------

  function generateValue(def, settings) {
    if (def.type === 'int') {
      const min = def.min ?? 0;
      const sliderMax = Math.pow(10, settings.maxPower);
      const defMax = def.max !== undefined ? def.max : Infinity;
      let max;
      if (min > sliderMax) {
        max = defMax 
      } else {
        max = effectiveMax(def, settings);
      } 
      const step = def.step ?? 1;
      const raw = randInt(min, max, step);
      return { kind: 'number', raw, system: def.system, pad: def.pad };
    }
    if (def.type === 'number') {
      const min = def.min ?? 0;
      const sliderMax = Math.pow(10, settings.maxPower);
      const defMax = def.max !== undefined ? def.max : Infinity;
      let max;
      if (min > sliderMax) {
        max = defMax 
      } else {
        max = effectiveMax(def, settings);
      } 
      const allowDec = def.decimal && settings.allowDecimals;
      const raw = randomNumberValue(min, max, allowDec);
      return { kind: 'number', raw, system: def.system, pad: def.pad };
    }
    if (def.type === 'digits') {
      const raw = randomDigits(def.length);
      return { kind: 'number', raw, system: 'digit' };
    }
    if (def.type === 'fixed') {
      return { kind: 'number', raw: def.value, system: def.system || 'digit' };
    }
    if (def.type === 'choice') {
      const choice = pick(def.values);
      const koList = Array.isArray(choice.ko)
        ? choice.ko.slice()
        : choice.ko !== undefined
          ? [choice.ko]
          : [];
      return {
        kind: 'choice',
        en: choice.en,
        koAlternatives: koList,
        examples: choice.examples,
        koTemplate: choice.koTemplate,
        choiceSystem: choice.system,
      };
    }
    if (def.type === 'derivedAdd') {
      // handled in 2nd pass
      return { kind: 'pending', def };
    }
    return { kind: 'unknown', raw: '' };
  }

  function effectiveMax(def, settings) {
    const sliderMax = Math.pow(10, settings.maxPower);
    const defMax = def.max !== undefined ? def.max : Infinity;
    return Math.min(sliderMax, defMax);
  }

  function generateValuesFor(item, settings) {
    const values = {};
    const entries = Object.entries(item.variables);
    const derivedTypes = new Set(['derivedAdd', 'derived', 'topicMarker']);

    // 1) Generate non-derived
    for (const [name, def] of entries) {
      if (derivedTypes.has(def.type)) continue;
      values[name] = generateValue(def, settings);
    }

    // 2) Inherit system from any choice that defines one (e.g. durations.unit)
    let inheritedSystem = null;
    for (const v of Object.values(values)) {
      if (v.kind === 'choice' && v.choiceSystem) inheritedSystem = v.choiceSystem;
    }
    if (inheritedSystem) {
      for (const [name, def] of entries) {
        if ((def.type === 'int' || def.type === 'number') && !def.system) {
          if (values[name] && values[name].kind === 'number') {
            values[name].system = inheritedSystem;
          }
        }
      }
    }

    // 3a) Resolve numeric derived values (derivedAdd + derived/op)
    for (const [name, def] of entries) {
      if (def.type === 'derivedAdd') {
        const source = values[def.source];
        const sourceRaw = source ? Number(source.raw) : 0;
        const newRaw = sourceRaw + (def.amount || 0);
        values[name] = {
          kind: 'number',
          raw: newRaw,
          system: def.system || (source && source.system) || 'sino',
        };
      } else if (def.type === 'derived') {
        const sources = def.sources || [];
        const a = Number((values[sources[0]] || {}).raw || 0);
        const b = Number((values[sources[1]] || {}).raw || 0);
        let raw = 0;
        switch (def.op) {
          case 'add': raw = a + b; break;
          case 'sub': raw = a - b; break;
          case 'mul': raw = a * b; break;
          case 'div': raw = b !== 0 ? a / b : 0; break;
          default: raw = 0;
        }
        values[name] = {
          kind: 'number',
          raw,
          system: def.system || 'sino',
        };
      }
    }

    // 3b) Resolve topic markers (run after all numeric values exist)
    for (const [name, def] of entries) {
      if (def.type !== 'topicMarker') continue;
      const source = values[def.source];
      let koStr = '';
      if (source) {
        if (source.kind === 'choice') koStr = source.koAlternatives[0] || '';
        else if (source.kind === 'number') koStr = renderNumber(source.raw, source.system);
      }
      const lastChar = koStr[koStr.length - 1] || '';
      const code = lastChar.charCodeAt(0) - 0xAC00;
      const hasFinal = code >= 0 && code < 11172 && code % 28 !== 0;
      const correct = hasFinal ? '은' : '는';
      values[name] = {
        kind: 'choice',
        en: correct,
        koAlternatives: [correct],
      };
    }

    return values;
  }

  // ---------- Template rendering ----------

  function renderRawValue(v) {
    if (v.kind === 'choice') return v.en !== undefined ? v.en : '';
    if (v.kind === 'number') {
      let s = String(v.raw);
      if (v.pad && s.length < v.pad) s = s.padStart(v.pad, '0');
      return s;
    }
    return '';
  }

  function renderKoForValue(v) {
    if (v.kind === 'choice') return v.koAlternatives[0] || '';
    if (v.kind === 'number') return renderNumber(v.raw, v.system);
    return '';
  }

  function renderKoTemplateString(tpl, values) {
    return tpl.replace(/\{([a-zA-Z_]\w*)\}/g, (_, name) => {
      const v = values[name];
      return v ? renderKoForValue(v) : '';
    });
  }

  function parseExpr(expr) {
    // Handles: var, var.field, var|ko, var|sino, var|native, var|digit
    let mode = null;
    let s = expr;
    const pipeIdx = s.indexOf('|');
    if (pipeIdx >= 0) {
      mode = s.slice(pipeIdx + 1);
      s = s.slice(0, pipeIdx);
    }
    if (s.includes('.')) {
      const [varName, field] = s.split('.');
      return { varName, field, mode };
    }
    return { varName: s, field: undefined, mode };
  }

  function isSystemMode(mode) {
    return mode === 'sino' || mode === 'native' || mode === 'digit';
  }

  // For question side: render English/raw forms.
  function renderQuestionTemplate(tpl, values) {
    return tpl.replace(/\{([^}]+)\}/g, (_, expr) => {
      const { varName, field, mode } = parseExpr(expr);
      const v = values[varName];
      if (!v) return '';
      if (mode === 'ord' && v.kind === 'number') {
        return String(v.raw) + ordinalSuffix(v.raw);
      }
      if (mode === 'ko') return renderKoForValue(v);
      if (isSystemMode(mode) && v.kind === 'number') return renderNumber(v.raw, mode);
      if (!field) return renderRawValue(v);
      if (v.kind === 'choice') {
        if (field === 'en') return v.en !== undefined ? v.en : '';
        if (field === 'ko') return v.koAlternatives[0] || '';
        if (field === 'examples') {
          return Array.isArray(v.examples) && v.examples.length > 0 ? pick(v.examples) : '';
        }
        if (field === 'koTemplate') return v.koTemplate || '';
      }
      return renderRawValue(v);
    });
  }

  // For answer side: produce one rendered string given a koOverride map for choice vars.
  // Choice variables default to the picked first alternative; koOverride can replace.
  function renderAnswerTemplate(tpl, values, koOverride = {}) {
    return tpl.replace(/\{([^}]+)\}/g, (_, expr) => {
      const { varName, field, mode } = parseExpr(expr);
      const v = values[varName];
      if (!v) return '';
      // Per-reference system override (e.g. {age|sino})
      if (isSystemMode(mode) && v.kind === 'number') {
        return renderNumber(v.raw, mode);
      }
      if (mode === 'ko' || !field) {
        if (v.kind === 'choice') {
          return koOverride[varName] !== undefined
            ? koOverride[varName]
            : v.koAlternatives[0] || '';
        }
        return renderKoForValue(v);
      }
      if (v.kind === 'choice') {
        if (field === 'ko') {
          return koOverride[varName] !== undefined
            ? koOverride[varName]
            : v.koAlternatives[0] || '';
        }
        if (field === 'en') return v.en !== undefined ? v.en : '';
        if (field === 'koTemplate') return renderKoTemplateString(v.koTemplate || '', values);
        if (field === 'examples') {
          return Array.isArray(v.examples) && v.examples.length > 0 ? pick(v.examples) : '';
        }
      }
      return renderKoForValue(v);
    });
  }

  // Cross-product expansion: template alternatives × per-variable ko alternatives.
  function expandAcceptedAnswers(template, values) {
    const tplList = Array.isArray(template.answer) ? template.answer : [template.answer];

    // Collect choice variables with multiple ko alternatives.
    const multi = [];
    for (const [name, v] of Object.entries(values)) {
      if (v.kind === 'choice' && v.koAlternatives.length > 1) {
        multi.push({ name, alts: v.koAlternatives });
      }
    }

    // Build override combos
    let combos = [{}];
    for (const m of multi) {
      const next = [];
      for (const c of combos) {
        for (const alt of m.alts) {
          next.push({ ...c, [m.name]: alt });
        }
      }
      combos = next;
    }

    const out = new Set();
    for (const tpl of tplList) {
      for (const combo of combos) {
        const rendered = renderAnswerTemplate(tpl, values, combo);
        out.add(cleanWhitespace(rendered));
      }
    }
    return Array.from(out);
  }

  function cleanWhitespace(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  // ---------- Game logic ----------

  function generateQuestion(item, settings) {
    const template = pick(item.templates);
    const values = generateValuesFor(item, settings);
    const question = renderQuestionTemplate(template.question, values);
    const accepted = expandAcceptedAnswers(template, values);
    const systemsUsed = collectSystems(values);
    return {
      itemId: item.id,
      categoryLabel: item.categoryLabel,
      subcatLabel: item.subcatLabel,
      templateId: template.id,
      question,
      accepted,
      systems: systemsUsed,
    };
  }

  function collectSystems(values) {
    const set = new Set();
    for (const v of Object.values(values)) {
      if (v.kind === 'number' && v.system) set.add(v.system);
    }
    return Array.from(set);
  }

  function normalizeForCompare(s) {
    if (typeof s !== 'string') return '';
    // Strip whitespace and common punctuation; keep Hangul + digits.
    return s
      .replace(/\s+/g, '')
      .replace(/[.,!?;:'"`~()[\]{}\-_/\\·•]/g, '')
      .toLowerCase();
  }

  function checkAnswer(input, accepted) {
    const norm = normalizeForCompare(input);
    if (!norm) return false;
    return accepted.some((a) => normalizeForCompare(a) === norm);
  }

  // ---------- UI ----------

  const state = {
    config: null,
    items: [],            // flattened items
    itemSystems: new Map(), // item.id -> Set of systems used (sino/native/digit)
    enabledIds: new Set(), // item.id
    settings: {
      allowDecimals: true,
      allowSound: true,
      showNumberType: false,
      maxPower: 4,
      systemFilter: 'both',  // 'both' | 'sino' | 'native'
      historyMode: 'limited', // 'limited' | 'all'
      historyLimit: 100,
    },
    pool: [],             // active items
    current: null,
    history: [],          // array of entry objects (see makeHistoryEntry)
    answered: false,      // current question already graded
  };

  // ---- History entry shape ----
  // {
  //   ts: number,                                 // timestamp
  //   itemId: string,                             // category::sub
  //   categoryLabel: string, subcatLabel: string,
  //   question: string,                           // rendered prompt
  //   accepted: string[],                         // accepted Korean answers
  //   systems: string[],                          // sino/native/digit tags
  //   userInput: string,                          // what the user typed (or '')
  //   result: 'correct' | 'wrong' | 'skipped' | 'revealed',
  // }

  const RESULT_KINDS = ['correct', 'wrong', 'skipped', 'revealed'];
  const RESULT_LABEL = {
    correct: '✓ Correct',
    wrong: '✗ Wrong',
    skipped: '↷ Skipped',
    revealed: '⚐ Shown',
  };

  function makeHistoryEntry(result, userInput) {
    const q = state.current || {};
    return {
      ts: Date.now(),
      itemId: typeof q.itemId === 'string' ? q.itemId : '',
      categoryLabel: typeof q.categoryLabel === 'string' ? q.categoryLabel : '',
      subcatLabel: typeof q.subcatLabel === 'string' ? q.subcatLabel : '',
      question: typeof q.question === 'string' ? q.question : '',
      accepted: Array.isArray(q.accepted) ? q.accepted.slice() : [],
      systems: Array.isArray(q.systems) ? q.systems.slice() : [],
      userInput: typeof userInput === 'string' ? userInput : '',
      result: RESULT_KINDS.includes(result) ? result : 'wrong',
    };
  }

  function normalizeHistoryItem(item) {
    if (typeof item === 'boolean') {
      return {
        ts: 0,
        itemId: '',
        categoryLabel: '',
        subcatLabel: '',
        question: '',
        accepted: [],
        systems: [],
        userInput: '',
        result: item ? 'correct' : 'wrong',
      };
    }
    if (!item || typeof item !== 'object') return null;
    return {
      ts: typeof item.ts === 'number' ? item.ts : 0,
      itemId: typeof item.itemId === 'string' ? item.itemId : '',
      categoryLabel: typeof item.categoryLabel === 'string' ? item.categoryLabel : '',
      subcatLabel: typeof item.subcatLabel === 'string' ? item.subcatLabel : '',
      question: typeof item.question === 'string' ? item.question : '',
      accepted: Array.isArray(item.accepted) ? item.accepted.filter((s) => typeof s === 'string') : [],
      systems: Array.isArray(item.systems) ? item.systems.filter((s) => typeof s === 'string') : [],
      userInput: typeof item.userInput === 'string' ? item.userInput : '',
      result: RESULT_KINDS.includes(item.result) ? item.result : 'wrong',
    };
  }

  const $ = (id) => document.getElementById(id);

  function computeItemSystems(items) {
    const map = new Map();
    for (const item of items) {
      const sys = new Set();
      for (const def of Object.values(item.variables)) {
        if (def && typeof def.system === 'string') sys.add(def.system);
      }
      for (const tpl of item.templates) {
        const strs = [tpl.question];
        const ans = tpl.answer;
        if (Array.isArray(ans)) strs.push(...ans);
        else if (typeof ans === 'string') strs.push(ans);
        for (const s of strs) {
          if (typeof s !== 'string') continue;
          const re = /\|(sino|native|digit)\b/g;
          let m;
          while ((m = re.exec(s)) !== null) sys.add(m[1]);
        }
      }
      map.set(item.id, sys);
    }
    return map;
  }

  function init() {
    fetch('./number_rules_ko.json?v=20260429a')
      .then((r) => r.json())
      .then((cfg) => {
        state.config = cfg;
        state.items = flattenConfig(cfg);
        state.itemSystems = computeItemSystems(state.items);
        state.enabledIds = new Set(state.items.map((i) => i.id));
        loadSettings();
        renderCategoryList();
        bindEvents();
        rebuildPool();
        updateScoreUI();
        renderHistoryList();
        $('loadingState').hidden = true;
        nextQuestion();
      })
      .catch((e) => {
        $('loadingState').textContent = 'Failed to load rules: ' + e.message;
      });
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem('koNumPractice');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.allowDecimals === 'boolean') state.settings.allowDecimals = saved.allowDecimals;
      if (typeof saved.allowSound === 'boolean') state.settings.allowSound = saved.allowSound;
      if (typeof saved.showNumberType === 'boolean') state.settings.showNumberType = saved.showNumberType;
      if (typeof saved.maxPower === 'number') state.settings.maxPower = saved.maxPower;
      if (saved.systemFilter === 'both' || saved.systemFilter === 'sino' || saved.systemFilter === 'native') {
        state.settings.systemFilter = saved.systemFilter;
      }
      if (saved.historyMode === 'all' || saved.historyMode === 'limited') {
        state.settings.historyMode = saved.historyMode;
      }
      if (typeof saved.historyLimit === 'number' && saved.historyLimit >= 1) {
        state.settings.historyLimit = Math.min(10000, Math.floor(saved.historyLimit));
      }
      if (Array.isArray(saved.history)) {
        state.history = saved.history
          .map(normalizeHistoryItem)
          .filter((e) => e !== null);
        applyHistoryLimit();
      }
      if (Array.isArray(saved.enabledIds)) {
        state.enabledIds = new Set(saved.enabledIds.filter((id) => state.items.some((i) => i.id === id)));
        if (state.enabledIds.size === 0) {
          state.enabledIds = new Set(state.items.map((i) => i.id));
        }
      }
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        'koNumPractice',
        JSON.stringify({
          allowDecimals: state.settings.allowDecimals,
          allowSound: state.settings.allowSound,
          showNumberType: state.settings.showNumberType,
          maxPower: state.settings.maxPower,
          systemFilter: state.settings.systemFilter,
          historyMode: state.settings.historyMode,
          historyLimit: state.settings.historyLimit,
          enabledIds: Array.from(state.enabledIds),
          history: state.history,
        })
      );
    } catch (_) {}
  }

  function applyHistoryLimit() {
    if (state.settings.historyMode === 'limited') {
      const n = Math.max(1, parseInt(state.settings.historyLimit, 10) || 1);
      if (state.history.length > n) {
        state.history.splice(0, state.history.length - n);
      }
    }
  }

  function recordResult(result, userInput) {
    state.history.push(makeHistoryEntry(result, userInput || ''));
    applyHistoryLimit();
    saveSettings();
    updateScoreUI();
    renderHistoryList();
  }

  function clearProgress() {
    state.history = [];
    saveSettings();
    updateScoreUI();
    renderHistoryList();
  }

  function renderCategoryList() {
    const root = $('categoryList');
    root.innerHTML = '';

    // Group by parent category
    const groups = new Map();
    for (const item of state.items) {
      if (!groups.has(item.categoryId)) {
        groups.set(item.categoryId, { label: item.categoryLabel, items: [] });
      }
      groups.get(item.categoryId).items.push(item);
    }

    for (const [, group] of groups) {
      const wrap = document.createElement('div');
      wrap.className = 'category-group';

      const hasMultipleSubs = group.items.length > 1;
      let parentCb = null;

      const title = document.createElement('div');
      title.className = 'category-group-title';

      if (hasMultipleSubs) {
        const titleLabel = document.createElement('label');
        titleLabel.className = 'category-group-label';
        parentCb = document.createElement('input');
        parentCb.type = 'checkbox';
        parentCb.className = 'category-parent-cb';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = group.label;
        titleLabel.appendChild(parentCb);
        titleLabel.appendChild(titleSpan);
        title.appendChild(titleLabel);
      } else {
        title.textContent = group.label;
      }
      wrap.appendChild(title);

      const sublist = document.createElement('div');
      sublist.className = 'subcategory-list';
      const childCbs = [];
      for (const item of group.items) {
        const row = document.createElement('label');
        row.className = 'cat-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = item.id;
        cb.checked = state.enabledIds.has(item.id);
        cb.addEventListener('change', () => {
          if (cb.checked) state.enabledIds.add(item.id);
          else state.enabledIds.delete(item.id);
          if (parentCb) updateParentCb(parentCb, childCbs);
        });
        childCbs.push(cb);
        const span = document.createElement('span');
        const label = item.subcatLabel === item.categoryLabel ? item.categoryLabel : item.subcatLabel;
        span.textContent = label;
        row.appendChild(cb);
        row.appendChild(span);
        sublist.appendChild(row);
      }
      wrap.appendChild(sublist);
      root.appendChild(wrap);

      if (parentCb) {
        updateParentCb(parentCb, childCbs);
        parentCb.addEventListener('change', () => {
          const checked = parentCb.checked;
          parentCb.indeterminate = false;
          for (const cb of childCbs) {
            cb.checked = checked;
            if (checked) state.enabledIds.add(cb.value);
            else state.enabledIds.delete(cb.value);
          }
        });
      }
    }
  }

  function updateParentCb(parentCb, childCbs) {
    const total = childCbs.length;
    const checkedCount = childCbs.filter((c) => c.checked).length;
    if (checkedCount === 0) {
      parentCb.checked = false;
      parentCb.indeterminate = false;
    } else if (checkedCount === total) {
      parentCb.checked = true;
      parentCb.indeterminate = false;
    } else {
      parentCb.checked = false;
      parentCb.indeterminate = true;
    }
  }

  function syncCategoryCheckboxes() {
    const root = $('categoryList');
    const cbs = root.querySelectorAll('input[type="checkbox"]:not(.category-parent-cb)');
    cbs.forEach((cb) => { cb.checked = state.enabledIds.has(cb.value); });
    // Update each parent checkbox to reflect children state
    const groups = root.querySelectorAll('.category-group');
    groups.forEach((g) => {
      const parentCb = g.querySelector('.category-parent-cb');
      if (!parentCb) return;
      const childCbs = Array.from(g.querySelectorAll('.subcategory-list input[type="checkbox"]'));
      updateParentCb(parentCb, childCbs);
    });
  }

  function formatMaxLabel(power) {
    const n = Math.pow(10, power);
    if (n >= 1_000_000_000) return '1B';
    if (n >= 1_000_000) return (n / 1_000_000) + 'M';
    if (n >= 1_000) return (n / 1_000) + 'K';
    return String(n);
  }

  function updateMaxDisplay() {
    let maxLabelNum = formatMaxLabel(state.settings.maxPower);
    let krPow = POWERS_OF_TEN[maxLabelNum] ?? null;
    if (krPow !== null) {
      maxLabelNum += '/'+ krPow;
    }
    $('maxDisplay').textContent = maxLabelNum;
  }

  function rebuildPool() {
    const filter = state.settings.systemFilter;
    state.pool = state.items.filter((i) => {
      if (!state.enabledIds.has(i.id)) return false;
      if (filter === 'both') return true;
      const sys = state.itemSystems.get(i.id) || new Set();
      return sys.has(filter);
    });
  }

  function nextQuestion() {
    speechSynthesis.cancel();
    rebuildPool();
    if (state.pool.length === 0) {
      $('gameArea').hidden = true;
      $('emptyState').hidden = false;
      return;
    }
    $('emptyState').hidden = true;
    $('gameArea').hidden = false;

    const item = pick(state.pool);
    state.current = generateQuestion(item, state.settings);
    state.answered = false;
    renderQuestion();
    $('answerInput').value = '';
    $('answerInput').focus();
    $('feedback').hidden = true;
    $('feedback').className = 'feedback';
    $('submitBtn').textContent = 'Check';
  }

  function renderQuestion() {
    const q = state.current;
    $('questionDisplay').textContent = q.question;

    const subLabel = q.subcatLabel === q.categoryLabel
      ? q.categoryLabel
      : `${q.categoryLabel} · ${q.subcatLabel}`;
    $('categoryBadge').textContent = subLabel;

    const sb = $('systemBadges');
    sb.innerHTML = '';
    if (state.settings.showNumberType) {
      for (const sys of q.systems) {
        const tag = document.createElement('span');
        tag.className = `sys-badge sys-${sys}`;
        tag.textContent = sys;
        sb.appendChild(tag);
      }    
    }
  }

  function showFeedback(kind, userInput) {
    const fb = $('feedback');
    fb.hidden = false;
    fb.className = 'feedback ' + kind;

    const accepted = state.current.accepted;
    let titleText = '';
    if (kind === 'correct') titleText = '✓ Correct!';
    else if (kind === 'incorrect') titleText = '✗ Not quite';
    else if (kind === 'revealed') titleText = 'Answer';

    const list = accepted.map((a) => `<li>${escapeHtml(a)}</li>`).join('');
    let userBlock = '';
    if (kind === 'incorrect' && userInput) {
      userBlock = `<div class="user-answer">You typed: <code>${escapeHtml(userInput)}</code></div>`;
    }
    fb.innerHTML = `
      <div class="feedback-title ${kind}">${titleText}</div>
      <ul class="answer-list">${list}</ul>
      ${userBlock}
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function updateScoreUI() {
    const total = state.history.length;
    const correct = state.history.reduce(
      (acc, e) => acc + (e && e.result === 'correct' ? 1 : 0),
      0
    );
    $('scoreCorrect').textContent = correct;
    $('scoreTotal').textContent = total;
    if (total === 0) {
      $('scoreAcc').textContent = '—';
    } else {
      const pct = Math.round((correct / total) * 100);
      $('scoreAcc').textContent = pct + '%';
    }
  }

  function renderHistoryList() {
    const list = $('historyList');
    const empty = $('historyEmpty');
    if (!list || !empty) return;
    list.innerHTML = '';
    if (state.history.length === 0) {
      empty.hidden = false;
      list.hidden = true;
      return;
    }
    empty.hidden = true;
    list.hidden = false;
    // Newest first
    for (let i = state.history.length - 1; i >= 0; i--) {
      const entry = state.history[i];
      list.appendChild(renderHistoryEntry(entry));
    }
  }

  function renderHistoryEntry(entry) {
    const li = document.createElement('li');
    li.className = 'history-item ' + entry.result;

    const header = document.createElement('div');
    header.className = 'history-header';
    const tag = document.createElement('span');
    tag.className = 'history-result-tag ' + entry.result;
    tag.textContent = RESULT_LABEL[entry.result] || entry.result;
    header.appendChild(tag);
    if (entry.subcatLabel || entry.categoryLabel) {
      const cat = document.createElement('span');
      cat.className = 'history-cat';
      cat.textContent =
        entry.subcatLabel && entry.subcatLabel !== entry.categoryLabel
          ? `${entry.categoryLabel} · ${entry.subcatLabel}`
          : entry.categoryLabel;
      header.appendChild(cat);
    }
    li.appendChild(header);

    if (entry.question) {
      const q = document.createElement('div');
      q.className = 'history-question';
      q.textContent = entry.question;
      li.appendChild(q);
    }

    if (entry.userInput && entry.result === 'wrong') {
      const u = document.createElement('div');
      u.className = 'history-meta';
      u.innerHTML = `You typed: <code>${escapeHtml(entry.userInput)}</code>`;
      li.appendChild(u);
    }

    if (entry.accepted && entry.accepted.length) {
      const a = document.createElement('div');
      a.className = 'history-meta';
      a.innerHTML = `Answer: <code>${entry.accepted.map(escapeHtml).join(' / ')}</code>`;
      li.appendChild(a);
    }

    if (entry.question && entry.accepted && entry.accepted.length) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost-btn history-try-btn';
      btn.textContent = 'Try again';
      btn.addEventListener('click', () => tryAgainFromHistory(entry));
      li.appendChild(btn);
    }

    return li;
  }

  function tryAgainFromHistory(entry) {
    speechSynthesis.cancel();
    state.current = {
      itemId: entry.itemId,
      categoryLabel: entry.categoryLabel,
      subcatLabel: entry.subcatLabel,
      question: entry.question,
      accepted: entry.accepted.slice(),
      systems: entry.systems.slice(),
      fromHistory: true,
    };
    state.answered = false;
    $('emptyState').hidden = true;
    $('gameArea').hidden = false;
    renderQuestion();
    $('answerInput').value = '';
    $('feedback').hidden = true;
    $('feedback').className = 'feedback';
    $('submitBtn').textContent = 'Check';
    $('historyPanel').hidden = true;
    $('answerInput').focus();
  }

  function playAnswer(ans) {
    if (state.settings.allowSound) {
      const speak = new SpeechSynthesisUtterance(ans);
      speak.lang = "ko-KR";
      speak.rate = 0.8;
      speechSynthesis.speak(speak);
    }
  }

  function submitAnswer() {
    if (!state.current) return;
    if (state.answered) {
      // Already graded → next question
      nextQuestion();
      return;
    }
    const input = $('answerInput').value;
    if (!input.trim()) return;
    const ok = checkAnswer(input, state.current.accepted);
    recordResult(ok ? 'correct' : 'wrong', input);
    state.answered = true;
    showFeedback(ok ? 'correct' : 'incorrect', input);
    if (ok) {
      playAnswer(input);
    } else {
      playAnswer(state.current.accepted[0]);
    }
    $('submitBtn').textContent = 'Next →';
  }

  function bindEvents() {
    $('settingsToggle').addEventListener('click', () => {
      const p = $('settingsPanel');
      const willOpen = p.hidden;
      p.hidden = !p.hidden;
      if (willOpen) $('historyPanel').hidden = true;
    });

    $('settingsCloseBtn').addEventListener('click', () => {
      $('settingsPanel').hidden = true;
    });

    $('historyToggle').addEventListener('click', () => {
      const p = $('historyPanel');
      const willOpen = p.hidden;
      if (willOpen) {
        renderHistoryList();
        p.hidden = false;
        $('settingsPanel').hidden = true;
      } else {
        p.hidden = true;
      }
    });

    $('historyCloseBtn').addEventListener('click', () => {
      $('historyPanel').hidden = true;
    });

    $('selectAllBtn').addEventListener('click', () => {
      state.enabledIds = new Set(state.items.map((i) => i.id));
      syncCategoryCheckboxes();
    });
    $('clearAllBtn').addEventListener('click', () => {
      state.enabledIds = new Set();
      syncCategoryCheckboxes();
    });

    // Number-system filter (sino / native / both)
    document.querySelectorAll('input[name="systemFilter"]').forEach((r) => {
      r.checked = (r.value === state.settings.systemFilter);
      r.addEventListener('change', (e) => {
        if (e.target.checked) state.settings.systemFilter = e.target.value;
      });
    });

    // Progress-history mode + limit
    document.querySelectorAll('input[name="historyMode"]').forEach((r) => {
      r.checked = (r.value === state.settings.historyMode);
      r.addEventListener('change', (e) => {
        if (e.target.checked) state.settings.historyMode = e.target.value;
      });
    });

    $('historyLimit').value = String(state.settings.historyLimit);
    $('historyLimit').addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v >= 1) {
        state.settings.historyLimit = Math.min(10000, v);
      }
    });

    $('clearProgressBtn').addEventListener('click', () => {
      if (window.confirm('Clear all saved progress? This cannot be undone.')) {
        clearProgress();
      }
    });

    $('allowDecimals').checked = state.settings.allowDecimals;
    $('allowDecimals').addEventListener('change', (e) => {
      state.settings.allowDecimals = e.target.checked;
    });

    $('allowSound').checked = state.settings.allowSound;
    $('allowSound').addEventListener('change', (e) => {
      state.settings.allowSound = e.target.checked;
    });

    $('showNumberType').checked = state.settings.showNumberType;
    $('showNumberType').addEventListener('change', (e) => {
      state.settings.showNumberType = e.target.checked;
    });

    $('maxPower').value = String(state.settings.maxPower);
    updateMaxDisplay();
    $('maxPower').addEventListener('input', (e) => {
      state.settings.maxPower = parseInt(e.target.value, 10);
      updateMaxDisplay();
    });

    $('applyBtn').addEventListener('click', () => {
      applyHistoryLimit();
      updateScoreUI();
      saveSettings();
      $('settingsPanel').hidden = true;
      nextQuestion();
    });

    $('answerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      submitAnswer();
    });

    $('answerInput').addEventListener('keydown', (e) => {
      // Enter handled by form; nothing else needed
      if (e.key === 'Escape') {
        $('answerInput').value = '';
      }
    });

    $('skipBtn').addEventListener('click', () => {
      if (!state.answered && state.current) {
        // count skip as wrong (total++, correct unchanged)
        recordResult('skipped', '');
      }
      nextQuestion();
    });

    $('showAnswerBtn').addEventListener('click', () => {
      if (!state.current) return;
      if (!state.answered) {
        recordResult('revealed', '');
        state.answered = true;
        playAnswer(state.current.accepted[0]);
      }
      showFeedback('revealed', '');
      $('submitBtn').textContent = 'Next →';
    });
  }

  // Expose tiny test hook (not needed in prod, useful for console verification)
  window.__koPractice = {
    sinoInt, sinoDecimal, nativeNumber, digitsRead, renderNumber,
    generateQuestion, normalizeForCompare,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
