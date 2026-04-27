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

Derived variable types (resolved after primary values):
- `derivedAdd { source, amount }` — source + constant.
- `derived { op, sources: [a, b], system }` — `op` is `add`, `sub`, `mul`, or
  `div` over two other variables. Used by the math category.
- `topicMarker { source }` — produces a choice value whose Korean is the
  correct subject/topic particle (`은` if the source's last syllable ends in a
  consonant, `는` if vowel). Only the correct particle is accepted, so users
  learn the 은/는 distinction.

Number variables (`int` / `number`) support an optional `"pad": N` field that
zero-pads the raw question-side rendering (used so `3:04 pm` doesn't show as
`3:4 pm`).

Template placeholder syntax:
- `{var}` — question side: raw English/digit; answer side: Korean.
- `{var.field}` — choice fields (`en`, `ko`, `examples`, `koTemplate`).
- `{var|ko}` — force Korean rendering on the question side.
- `{var|sino}` / `{var|native}` / `{var|digit}` — render a number variable in
  a different system at this reference, regardless of its declared `system`
  (used so `{age|sino} 세` reads `이십오 세` while `{age} 살` still reads
  `스물다섯 살`).

Months use a `choice` variable with full Korean month names so the irregular
forms `유월` (6) and `시월` (10) come out correctly.

Answer comparison normalizes by stripping all whitespace and common punctuation,
so spacing variations like `오후다섯시삼십분` vs `오후 다섯 시 삼십 분` both pass.

## Workflow

`Start application` runs `node language/server.js` on port 5000 (webview).

## Other directories

`travel/`, `music/`, etc. — older projects, untouched in this iteration.
