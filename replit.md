# Repo overview

This repo contains several independent project directories. Each is its own app.

## Active project: `language/` — Korean Number Practice

Frontend-only browser app for rapid-fire practice of Korean number-related phrases.
The app shows an English number-related prompt (time, date, age, money, address,
measurements, counters, durations, etc.); the user types the Korean equivalent.

Files:
- `language/index.html` — UI shell.
- `language/style.css` — styling (dark theme).
- `language/app.js` — all logic: number renderers (sino/native/digit),
  question generator, template substitution, answer cross-product expansion,
  normalized answer checking.
- `language/number_rules_ko.json` — categories, subcategories, variables and
  templates that drive every question.
- `language/server.js` — tiny Node static file server on port 5000 (no deps).

Settings (persisted in localStorage):
- Per-subcategory checkboxes (defaults: all on).
- Allow decimals toggle (only affects variables with `decimal: true`).
- Max number slider, power-of-10 from 10 → 1B; capped per variable by its `max`.

Number systems:
- `native` — 하나/둘/셋… with attributive forms (한/두/세/네/스무).
- `sino` — 일/이/삼… with 만/억 magnitudes; decimals as `점` + per-digit reading.
- `digit` — read each digit individually using sino digits, with `공` for 0
  (used for phone numbers).

Variable inheritance: when a number variable has no `system`, it inherits the
`system` from a sibling `choice` value that defines one (e.g. `durations.unit`).
`derivedAdd` (e.g. `hotel_stays.days = nights + 1`) is resolved after primaries.

Answer comparison normalizes by stripping all whitespace and common punctuation,
so spacing variations like `오후다섯시삼십분` vs `오후 다섯 시 삼십 분` both pass.

JSON quirks left as-is (data, not code bugs):
- One trailing comma fixed inside `day_durations.variables` so the file parses.
- `day_duration_two/three/four` templates have question `"1 day"` instead of
  `"2 days"`/`"3 days"`/`"4 days"`.
- `temperature.sign` choice values look semantically swapped (`"-"` → 영상,
  `""` → 영하).
- `{age} 세` uses `system: "native"` though 세 is normally read with sino.

## Workflow

`Start application` runs `node language/server.js` on port 5000 (webview).

## Other directories

`travel/`, `music/`, etc. — older projects, untouched in this iteration.
