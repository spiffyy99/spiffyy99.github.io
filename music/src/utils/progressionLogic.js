import {
  ALL_NOTES,
  SCALE_TYPES,
  buildChordDisplay,
  formatRomanNumeral,
  getSecondaryDominants,
} from './chordLogic';

// ===== HELPERS =====

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const getDiatonicChord = (rootNote, scaleType, degreeIndex) => {
  const scale = SCALE_TYPES[scaleType];
  const rootIdx = ALL_NOTES.indexOf(rootNote);
  const noteIdx = (rootIdx + scale.intervals[degreeIndex]) % 12;
  const note = ALL_NOTES[noteIdx];
  const quality = scale.qualities[degreeIndex];
  return {
    note,
    quality,
    display: buildChordDisplay(note, quality),
    romanNumeral: formatRomanNumeral(degreeIndex, quality, false),
    degreeIndex,
    isBorrowed: false,
    isSecondaryDominant: false,
  };
};

const getAllDiatonic = (rootNote, scaleType) =>
  Array.from({ length: 7 }, (_, i) => getDiatonicChord(rootNote, scaleType, i));

// ===== DIATONIC TRANSITION TABLES =====
// Each key is the "from" degree; value is array of accepted "next" degrees,
// roughly ordered most → least common.

const DIATONIC_TRANSITIONS = {
  major: {
    0: [3, 4, 1, 5, 2],  // I → IV, V, ii, vi, iii
    1: [4, 3, 6],         // ii → V, IV, vii°
    2: [5, 3, 0],         // iii → vi, IV, I
    3: [4, 0, 1],         // IV → V, I, ii
    4: [0, 5],            // V → I, vi (deceptive)
    5: [1, 3, 4, 2],      // vi → ii, IV, V, iii
    6: [0],               // vii° → I
  },
  naturalMinor: {
    0: [3, 4, 6, 5],      // i → iv, v, VII, VI
    1: [4, 5],            // ii° → v, VI
    2: [6, 5, 3],         // III → VII, VI, iv
    3: [4, 0, 6],         // iv → v, i, VII
    4: [0, 3, 6],         // v → i, iv, VII
    5: [2, 3, 4],         // VI → III, iv, v
    6: [0, 3, 5],         // VII → i, iv, VI
  },
  harmonicMinor: {
    0: [3, 4, 5],         // i → iv, V (raised), VI
    1: [4, 5],            // ii° → V, VI
    2: [5, 3],            // III+ → VI, iv
    3: [4, 0],            // iv → V, i
    4: [0, 3],            // V → i, iv (strong dominant in harmonic minor)
    5: [2, 4, 0],         // VI → III, V, i
    6: [0],               // vii° → i
  },
};

// Fallback for any other scale type — use major patterns
const getTransitions = (scaleType) =>
  DIATONIC_TRANSITIONS[scaleType] || DIATONIC_TRANSITIONS.major;

// ===== BORROWED CHORD DEFINITIONS =====
// Borrowed chords from parallel minor used in a major key context.
// semitones: half steps above the major-scale root to the borrowed chord root.

const BORROWED_DEFS = [
  {
    id: 'iv',
    label: 'iv',
    semitones: 5,     // same root as IV but minor quality
    quality: 'minor',
    nextDegrees: [0, 4],          // I, V
    nextBorrowedIds: [],
  },
  {
    id: 'bVII',
    label: '\u266DVII',
    semitones: 10,    // whole-step below tonic
    quality: 'major',
    nextDegrees: [0, 3],          // I, IV
    nextBorrowedIds: [],
  },
  {
    id: 'bVI',
    label: '\u266DVI',
    semitones: 8,     // minor sixth above tonic
    quality: 'major',
    nextDegrees: [4],             // V
    nextBorrowedIds: ['bVII'],    // ♭VII
  },
  {
    id: 'bIII',
    label: '\u266DIII',
    semitones: 3,     // minor third above tonic
    quality: 'major',
    nextDegrees: [3],             // IV
    nextBorrowedIds: ['bVII'],    // ♭VII
  },
];

const makeBorrowedChord = (rootNote, def) => {
  const rootIdx = ALL_NOTES.indexOf(rootNote);
  const noteIdx = (rootIdx + def.semitones) % 12;
  const note = ALL_NOTES[noteIdx];
  return {
    note,
    quality: def.quality,
    display: buildChordDisplay(note, def.quality),
    romanNumeral: def.label,
    isBorrowed: true,
    isSecondaryDominant: false,
    borrowedId: def.id,
  };
};

// ===== QUESTION GENERATORS =====

export const generateProgressionDiatonicQuestion = (rootNote, scaleType) => {
  const allChords = getAllDiatonic(rootNote, scaleType);
  const transitions = getTransitions(scaleType);
  const fromDeg = Math.floor(Math.random() * 7);
  const acceptedDegs = transitions[fromDeg] || [0];

  const currentChord = allChords[fromDeg];
  const correctChords = acceptedDegs.map((d) => allChords[d]);
  const correctSet = new Set(correctChords.map((c) => c.display));

  // distractors: diatonic chords not accepted and not current
  const distractors = shuffle(
    allChords.filter(
      (c) => c.degreeIndex !== fromDeg && !acceptedDegs.includes(c.degreeIndex)
    )
  );

  const numDistractors = Math.max(2, 6 - correctChords.length);
  const options = shuffle([
    ...correctChords.map((c) => ({ ...c, isCorrect: true })),
    ...distractors.slice(0, numDistractors).map((c) => ({ ...c, isCorrect: false })),
  ]);

  return {
    type: 'chord-progression',
    subtype: 'diatonic',
    scale: { rootNote, scaleType },
    currentChord,
    currentRomanNumeral: currentChord.romanNumeral,
    options,
    correctSet,
  };
};

export const generateProgressionSecDomQuestion = (rootNote, scaleType) => {
  const allChords = getAllDiatonic(rootNote, scaleType);
  const secDoms = getSecondaryDominants(rootNote, scaleType);
  if (!secDoms || secDoms.length === 0) {
    return generateProgressionDiatonicQuestion(rootNote, scaleType);
  }

  const sd = pick(secDoms);
  const currentChord = {
    note: ALL_NOTES[sd.noteIndex],
    quality: 'major',
    display: buildChordDisplay(ALL_NOTES[sd.noteIndex], 'major'),
    romanNumeral: sd.label,
    isBorrowed: false,
    isSecondaryDominant: true,
  };

  const targetChord = allChords[sd.targetDegreeIndex];
  const correctSet = new Set([targetChord.display]);

  const distractors = shuffle(
    allChords.filter(
      (c) => c.display !== targetChord.display && c.display !== currentChord.display
    )
  );

  const options = shuffle([
    { ...targetChord, isCorrect: true },
    ...distractors.slice(0, 5).map((c) => ({ ...c, isCorrect: false })),
  ]);

  return {
    type: 'chord-progression',
    subtype: 'sec-dom',
    scale: { rootNote, scaleType },
    currentChord,
    currentRomanNumeral: sd.label,
    options,
    correctSet,
  };
};

export const generateProgressionBorrowedQuestion = (rootNote) => {
  const scaleType = 'major';
  const allChords = getAllDiatonic(rootNote, scaleType);
  const def = pick(BORROWED_DEFS);
  const rootIdx = ALL_NOTES.indexOf(rootNote);
  const currentChord = makeBorrowedChord(rootNote, def);

  const correctChords = [];
  for (const deg of def.nextDegrees) {
    correctChords.push({ ...allChords[deg], isCorrect: true });
  }
  for (const borrowedId of def.nextBorrowedIds) {
    const bDef = BORROWED_DEFS.find((b) => b.id === borrowedId);
    if (bDef) {
      const bNoteIdx = (rootIdx + bDef.semitones) % 12;
      const bNote = ALL_NOTES[bNoteIdx];
      correctChords.push({
        note: bNote,
        quality: bDef.quality,
        display: buildChordDisplay(bNote, bDef.quality),
        romanNumeral: bDef.label,
        isBorrowed: true,
        isCorrect: true,
      });
    }
  }

  const correctSet = new Set(correctChords.map((c) => c.display));

  const distractors = shuffle(
    allChords.filter(
      (c) => !correctSet.has(c.display) && c.display !== currentChord.display
    )
  );

  const numDistractors = Math.max(2, 6 - correctChords.length);
  const options = shuffle([
    ...correctChords,
    ...distractors.slice(0, numDistractors).map((c) => ({ ...c, isCorrect: false })),
  ]);

  return {
    type: 'chord-progression',
    subtype: 'borrowed',
    scale: { rootNote, scaleType },
    currentChord,
    currentRomanNumeral: def.label,
    options,
    correctSet,
  };
};

/**
 * Main entry point. Picks question type based on enabled toggles.
 */
export const generateProgressionQuestion = (
  rootNote,
  scaleType,
  { includeRegular = true, includeSecondaryDominants = false, includeBorrowed = false } = {}
) => {
  const sources = [];
  if (includeRegular) sources.push('diatonic');
  if (
    includeSecondaryDominants &&
    ['major', 'naturalMinor', 'harmonicMinor'].includes(scaleType)
  ) {
    sources.push('secdom');
  }
  if (includeBorrowed && scaleType === 'major') {
    sources.push('borrowed');
  }
  if (sources.length === 0) sources.push('diatonic');

  const source = pick(sources);
  if (source === 'secdom') return generateProgressionSecDomQuestion(rootNote, scaleType);
  if (source === 'borrowed') return generateProgressionBorrowedQuestion(rootNote);
  return generateProgressionDiatonicQuestion(rootNote, scaleType);
};
