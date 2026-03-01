# Music Theory Learning App - PRD

## Original Problem Statement
Enhance the music theory learning app to support advanced learners by:
1. Separating chord selection into root note + chord type (quality) instead of individual chord buttons
2. Adding multiple scale types: Major, Natural Minor, Harmonic Minor, and modes (Dorian, Phrygian, Lydian, Mixolydian)
3. Renaming "keys" to "scales" throughout the app
4. Supporting in-game scale type toggling via settings modal

## Architecture
- **Frontend**: React (CRA + Craco) with Tailwind CSS, HashRouter
- **Backend**: FastAPI (minimal - session saving)
- **Database**: MongoDB (session storage)
- **Location**: `/app/frontend/`

## Core Requirements
- 12 root note buttons (C through B with sharps/flats combined like C#/Db) for modes 1 & 3
- 7 degree buttons (I-VII) for mode 2
- Quality switch: Major/Minor/Dim/Aug for modes 1 & 3; adds Flat for mode 2
- 4 scale type checkboxes: Major (default), Natural Minor, Harmonic Minor, Other Modes
- Borrowed chords toggle (parallel minor, only in major scale context)
- In-game settings modal with scale type checkboxes (changes apply on next question)
- Interval modes (4 & 5) unchanged

## What's Been Implemented (Feb 28, 2026)
- [x] Complete rewrite of `chordLogic.js` with 7 scale types and all chord qualities
- [x] Setup page with scale type checkboxes, scale selection (random/preselected), borrowed chords toggle
- [x] Game page with quality switch + root/degree buttons for all 3 non-interval modes
- [x] Settings modal with in-game scale type toggling and borrowed chords toggle
- [x] Transposition mode with single scale type for both source/target
- [x] Updated Home page descriptions (keys → scales)
- [x] Updated Results page to show scale info
- [x] All 5 game modes tested and working (100% test pass rate)
- [x] Correct answer display when user guesses wrong
- [x] Wider question display box for long chord names
- [x] Dark theme toggle with localStorage persistence
- [x] Fixed mid-game scale change bug (regenerates valid question)
- [x] Cleaned up Setup page for Transposition mode (single scale type selector)

## User Personas
- **Beginner**: Uses Major scale only (default), untimed mode
- **Intermediate**: Adds Natural Minor and Harmonic Minor
- **Advanced**: Enables all modes (Dorian, Phrygian, Lydian, Mixolydian), borrowed chords, timed mode

## Prioritized Backlog
- P1: Add 7th chords (maj7, min7, dom7, dim7) as additional chord qualities
- P2: Add sus2/sus4 chord types
- P2: Add ear training with audio playback
- P3: Add progress tracking dashboard with historical stats
- P3: Add custom scale builder

## Next Tasks
- Add more chord types (7th chords, suspended chords)
- Historical performance tracking per scale type
- Audio playback for ear training
