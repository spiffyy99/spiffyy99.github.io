import { ALL_NOTES, SCALE_TYPES, buildChordDisplay } from './chordLogic';

// ===== CHORD TYPE DEFINITIONS =====
// intervals: semitones from root (mod 12 where appropriate for display)

export const CHORD_NOTE_TYPES = {
  major:    { intervals: [0, 4, 7],          label: 'Major',   suffix: '',      group: 'basic' },
  minor:    { intervals: [0, 3, 7],          label: 'Minor',   suffix: 'm',     group: 'basic' },
  dim:      { intervals: [0, 3, 6],          label: 'Dim',     suffix: 'dim',   group: 'basic' },
  aug:      { intervals: [0, 4, 8],          label: 'Aug',     suffix: 'aug',   group: 'aug'   },
  sus2:     { intervals: [0, 2, 7],          label: 'Sus2',    suffix: 'sus2',  group: 'sus'   },
  sus4:     { intervals: [0, 5, 7],          label: 'Sus4',    suffix: 'sus4',  group: 'sus'   },
  maj7:     { intervals: [0, 4, 7, 11],      label: 'Maj7',    suffix: 'maj7',  group: '7th'   },
  min7:     { intervals: [0, 3, 7, 10],      label: 'm7',      suffix: 'm7',    group: '7th'   },
  dom7:     { intervals: [0, 4, 7, 10],      label: '7',       suffix: '7',     group: '7th'   },
  halfdim7: { intervals: [0, 3, 6, 10],      label: '\u00f87', suffix: '\u00f87', group: '7th' },
  dim7:     { intervals: [0, 3, 6, 9],       label: '\u00b07', suffix: '\u00b07', group: '7th' },
  add9:     { intervals: [0, 2, 4, 7],       label: 'add9',    suffix: 'add9',  group: 'ext'   },
  madd9:    { intervals: [0, 2, 3, 7],       label: 'm(add9)', suffix: 'm(add9)', group: 'ext' },
  dom9:     { intervals: [0, 2, 4, 7, 10],   label: '9',       suffix: '9',     group: 'ext'   },
  maj9:     { intervals: [0, 2, 4, 7, 11],   label: 'Maj9',    suffix: 'maj9',  group: 'ext'   },
  min9:     { intervals: [0, 2, 3, 7, 10],   label: 'm9',      suffix: 'm9',    group: 'ext'   },
};

// Groups of quality types, used for setup toggles
export const CHORD_NOTE_GROUPS = {
  basic: ['major', 'minor', 'dim'],
  aug:   ['aug'],
  sus:   ['sus2', 'sus4'],
  '7th': ['maj7', 'min7', 'dom7', 'halfdim7', 'dim7'],
  ext:   ['add9', 'madd9', 'dom9', 'maj9', 'min9'],
};

// Build a chord display string for types not in chordLogic's QUALITY_SUFFIX
export const buildChordNoteDisplay = (note, quality) => {
  const def = CHORD_NOTE_TYPES[quality];
  if (!def) return buildChordDisplay(note, quality);
  if (note.includes('/')) {
    return note.split('/').map((p) => p + def.suffix).join('/');
  }
  return note + def.suffix;
};

// ===== HELPERS =====

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const getCombinations = (arr, size) => {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  return [
    ...getCombinations(rest, size - 1).map((c) => [first, ...c]),
    ...getCombinations(rest, size),
  ];
};

// ===== CHORD POOL BUILDER =====

/**
 * Build the pool of all candidate chords for a given key + enabled groups.
 * Only uses diatonic roots; all enabled quality types are applied to each.
 */
const buildChordPool = (rootNote, scaleType, enabledGroups, includeInversions) => {
  const scale = SCALE_TYPES[scaleType];
  if (!scale) return [];
  const rootIdx = ALL_NOTES.indexOf(rootNote);

  // Diatonic root note indices for this scale
  const diatonicRootIndices = scale.intervals.map((i) => (rootIdx + i) % 12);

  // Expand enabled groups to individual quality strings
  const enabledQualities = enabledGroups
    .flatMap((g) => CHORD_NOTE_GROUPS[g] || [])
    .filter((q) => CHORD_NOTE_TYPES[q]);

  const pool = [];

  for (const chordRootIdx of diatonicRootIndices) {
    for (const quality of enabledQualities) {
      const def = CHORD_NOTE_TYPES[quality];

      // For 'basic' group, only include the chord if ALL its notes are diatonic to the key.
      // For other groups, allow non-diatonic notes (the key is shown for context).
      if (def.group === 'basic') {
        const diatonicSet = new Set(diatonicRootIndices);
        const noteIndices = def.intervals.map((i) => (chordRootIdx + i) % 12);
        if (!noteIndices.every((n) => diatonicSet.has(n))) continue;
      }

      const chordRootNote = ALL_NOTES[chordRootIdx];
      const voicingNotes = def.intervals.map((i) => ALL_NOTES[(chordRootIdx + i) % 12]);

      pool.push({
        rootNote: chordRootNote,
        rootIndex: chordRootIdx,
        quality,
        notes: voicingNotes,
        inversion: 0,
        display: buildChordNoteDisplay(chordRootNote, quality),
      });

      if (includeInversions && def.intervals.length >= 3) {
        // 1st inversion: move root to top
        pool.push({
          rootNote: chordRootNote,
          rootIndex: chordRootIdx,
          quality,
          notes: [...voicingNotes.slice(1), voicingNotes[0]],
          inversion: 1,
          display: buildChordNoteDisplay(chordRootNote, quality),
        });
        // 2nd inversion: move root + 3rd to top
        if (def.intervals.length >= 3) {
          pool.push({
            rootNote: chordRootNote,
            rootIndex: chordRootIdx,
            quality,
            notes: [...voicingNotes.slice(2), ...voicingNotes.slice(0, 2)],
            inversion: 2,
            display: buildChordNoteDisplay(chordRootNote, quality),
          });
        }
      }
    }
  }

  return pool;
};

// ===== OMIT NOTES ALGORITHM =====

/**
 * Find the minimum subset of `chord.notes` that uniquely identifies
 * root+quality (ignoring inversion) among all chords in the pool.
 *
 * Returns notes in original voicing order.
 */
const findMinimumNotes = (chord, pool) => {
  // "other" means different root or different quality
  const otherSets = pool
    .filter((c) => !(c.rootNote === chord.rootNote && c.quality === chord.quality))
    .map((c) => new Set(c.notes));

  for (let size = 1; size <= chord.notes.length; size++) {
    const combos = shuffle(getCombinations(chord.notes, size));
    for (const combo of combos) {
      const comboSet = new Set(combo);
      const isUnique = !otherSets.some((os) => combo.every((n) => os.has(n)));
      if (isUnique) {
        // Preserve voicing order
        return chord.notes.filter((n) => comboSet.has(n));
      }
    }
  }

  return chord.notes; // fallback: show all
};

// ===== MAIN GENERATOR =====

/**
 * Generate a "chord from notes" question.
 *
 * @param {string} rootNote - Key root note (e.g. 'C')
 * @param {string} scaleType - Scale type key (e.g. 'major')
 * @param {string[]} enabledGroups - Which chord group toggles are on
 * @param {boolean} includeInversions - Whether to include inverted voicings
 * @param {boolean} omitNotes - Whether to show minimum identifying notes
 * @returns {object|null} question object or null if pool is empty
 */
export const generateChordFromNotesQuestion = (
  rootNote,
  scaleType,
  enabledGroups,
  includeInversions,
  omitNotes
) => {
  const pool = buildChordPool(rootNote, scaleType, enabledGroups, includeInversions);
  if (pool.length === 0) return null;

  const chord = pick(pool);

  let displayNotes = chord.notes;
  if (omitNotes && chord.notes.length > 1) {
    displayNotes = findMinimumNotes(chord, pool);
  }

  // Build the list of quality buttons to show based on enabled groups
  const enabledQualities = enabledGroups.flatMap((g) => CHORD_NOTE_GROUPS[g] || []);

  return {
    type: 'chord-from-notes',
    scale: { rootNote, scaleType },
    notes: displayNotes,
    allNotes: chord.notes,
    correctNoteIndex: chord.rootIndex,
    correctQuality: chord.quality,
    inversion: chord.inversion,
    omittedCount: chord.notes.length - displayNotes.length,
    enabledQualities,
    chordDisplay: chord.display,
  };
};
