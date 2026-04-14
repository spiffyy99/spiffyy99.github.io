# Travel Baggage Planner - PRD

## Original Problem Statement
Build a travel planner app that takes a user's list of airlines and number of bags (personal item, carry-on, checked), lists total cost, minimum dimensions/weights across all flights, with metric/imperial toggle, and per-airline details. 10 airlines supported. Static frontend only for GitHub Pages. User picks ticket tier per airline. Assume lowest checked bag tier. Minimal design with dark mode.

## Architecture
- **Type**: Static frontend (HTML/CSS/JS) — no backend, no framework
- **Hosting target**: GitHub Pages
- **Data**: Airline baggage specs stored as JS constant (from airline_baggage_v1_apr2026.json)
- **Styling**: Custom CSS with CSS variables for light/dark theme, Google Fonts (Outfit + IBM Plex Sans), Lucide icons via CDN
- **Location**: `/app/travelbaggage/` directory

## Core Requirements
1. Airline multi-select (10 airlines: AA, DL, UA, FR, U2, LH, AF, EK, SQ, NH)
2. Ticket tier selection per airline (dropdown)
3. Bag count inputs with +/- steppers (personal, carry-on, checked; max 5)
4. Total baggage cost calculation
5. Minimum dimensions/weights across all selected flights
6. Metric/Imperial unit toggle
7. Per-airline cost breakdown
8. Dark/Light theme switcher

## What's Been Implemented (Jan 2026)
- Full static app with all 8 core features working
- 10 airlines with complete baggage data
- Accurate cost calculations including included bags, add-on pricing, null/route-dependent handling
- Minimum dimension cross-calculation (per-dimension minimums across selected airlines)
- Responsive design (desktop: 2/3 + 1/3 grid, mobile: stacked)
- Swiss/minimal design aesthetic with sharp borders, no shadows

## File Structure
```
/app/travelbaggage/
├── index.html         # Main page
├── css/styles.css     # All styling with CSS vars for theming
├── js/data.js         # Airline data constant
└── js/app.js          # Application logic
```

## Testing: 95% pass (19/20 scenarios)

## Prioritized Backlog
- **P0**: None — MVP complete
- **P1**: Add more airlines beyond initial 10
- **P1**: Multi-tier checked bag support (show all tier options not just lowest)
- **P2**: Secure data storage approach (user mentioned security concern)
- **P2**: Multi-currency support
- **P3**: Share/export trip summary
- **P3**: Save trip configurations locally
