# Travel Baggage Planner - PRD

## Original Problem Statement
Build a travel planner app that takes a user's list of airlines and number of bags (personal item, carry-on, checked), lists total cost, minimum dimensions/weights across all flights, with metric/imperial toggle, and per-airline details. 10 airlines supported. Static frontend only for GitHub Pages. User picks ticket tier per airline. Minimal design with dark mode.

## Architecture
- **Type**: Static frontend (HTML/CSS/JS) — no backend, no framework
- **Hosting target**: GitHub Pages
- **Data**: Airline baggage specs stored in `data/airlines.json` (v2 schema with checkedBags array)
- **Styling**: Custom CSS with CSS variables for light/dark theme, Google Fonts (Outfit + IBM Plex Sans), Lucide icons via CDN
- **Location**: `/app/travelbaggage/` directory

## Core Requirements
1. Personal item toggle (on/off)
2. Carry-on toggle (on/off)
3. Checked bags counter (0-2 max)
4. Airline search dropdown with type-ahead, selected shown as removable tags
5. Ticket tier selection per airline
6. Per-bag checked pricing (Bag 1, Bag 2 shown separately; null prices fall back to 1st bag price)
7. Overweight/oversized fee display per airline (when available)
8. Grey out spec boxes when tier doesn't support a bag type user selected
9. Total baggage cost calculation
10. Minimum dimensions/weights across all selected flights
11. Metric/Imperial unit toggle
12. Dark/Light theme switcher

## What's Been Implemented (Jan 2026)
- Full static app with all 12 core features working
- v2 JSON schema with checkedBags array and oversizedCheckedBagCostUsd
- Null 2nd bag prices fall back to 1st bag price with footnote
- Overweight/oversized fee always shown when checked bags selected
- Searchable dropdown for airline selection with removable tags
- Toggle switches for personal/carry-on, 0-2 counter for checked

## File Structure
```
/app/travelbaggage/
├── index.html
├── css/styles.css
├── js/app.js
└── data/airlines.json
```

## Prioritized Backlog
- **P0**: None — MVP complete
- **P1**: Add more airlines beyond initial 10
- **P1**: Show all checked bag tier options (10kg vs 20kg etc.)
- **P2**: Populate actual overweight/oversized fees in airline data
- **P2**: Multi-currency support
- **P3**: Share/export trip summary
- **P3**: Save trip configurations locally
