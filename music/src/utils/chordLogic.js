// ===== CORE DATA =====

export const ALL_NOTES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

export const SCALE_TYPES = {
  major: {
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    qualities: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim']
  },
  naturalMinor: {
    name: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    qualities: ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major']
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    qualities: ['minor', 'dim', 'aug', 'minor', 'major', 'major', 'dim']
  },
  dorian: {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    qualities: ['minor', 'minor', 'major', 'major', 'minor', 'dim', 'major']
  },
  phrygian: {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    qualities: ['minor', 'major', 'major', 'minor', 'dim', 'major', 'minor']
  },
  lydian: {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    qualities: ['major', 'major', 'minor', 'dim', 'major', 'minor', 'minor']
  },
  mixolydian: {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    qualities: ['major', 'minor', 'dim', 'major', 'minor', 'minor', 'major']
  }
};

export const DEGREE_NUMBERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const QUALITY_SUFFIX = {
  major: '',
  minor: 'm',
  dim: 'dim',
  aug: 'aug',
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  halfdim7: 'ø7',
  dim7: '°7',
  aug7: 'aug7'
};

// 7th chord quality mappings based on scale degree and base triad quality
export const SEVENTH_CHORD_MAP = {
  // Major scale 7th chords
  major: {
    major: { 0: 'maj7', 3: 'maj7', 4: 'dom7' }, // I, IV = maj7; V = dom7
    minor: { 1: 'min7', 2: 'min7', 5: 'min7' }, // ii, iii, vi = min7
    dim: { 6: 'halfdim7' } // vii° = half-dim7
  },
  naturalMinor: {
    minor: { 0: 'min7', 3: 'min7', 4: 'min7' }, // i, iv, v = min7
    major: { 2: 'maj7', 5: 'maj7', 6: 'dom7' }, // III, VI = maj7; VII = dom7
    dim: { 1: 'halfdim7' } // ii° = half-dim7
  },
  harmonicMinor: {
    minor: { 0: 'min7', 3: 'min7' }, // i, iv = min7 (technically minMaj7 for i, but simplified)
    major: { 4: 'dom7', 5: 'maj7' }, // V = dom7, VI = maj7
    aug: { 2: 'aug7' }, // III+ = aug7
    dim: { 1: 'halfdim7', 6: 'dim7' } // ii° = half-dim7, vii° = dim7
  },
  dorian: {
    minor: { 0: 'min7', 1: 'min7', 4: 'min7' },
    major: { 2: 'maj7', 3: 'dom7', 6: 'maj7' },
    dim: { 5: 'halfdim7' }
  },
  phrygian: {
    minor: { 0: 'min7', 3: 'min7', 6: 'min7' },
    major: { 1: 'maj7', 2: 'dom7', 5: 'maj7' },
    dim: { 4: 'halfdim7' }
  },
  lydian: {
    major: { 0: 'maj7', 1: 'dom7', 4: 'maj7' },
    minor: { 2: 'min7', 5: 'min7', 6: 'min7' },
    dim: { 3: 'halfdim7' }
  },
  mixolydian: {
    major: { 0: 'dom7', 3: 'maj7', 6: 'maj7' },
    minor: { 1: 'min7', 4: 'min7', 5: 'min7' },
    dim: { 2: 'halfdim7' }
  }
};

// Get the 7th chord quality for a given scale, degree, and base quality
export const get7thChordQuality = (scaleType, degreeIndex, baseQuality) => {
  const scaleMap = SEVENTH_CHORD_MAP[scaleType];
  if (!scaleMap) return 'dom7'; // fallback
  const qualityMap = scaleMap[baseQuality];
  if (!qualityMap) return 'dom7'; // fallback
  return qualityMap[degreeIndex] || 'dom7'; // fallback to dom7
};

// Base quality to possible 7th qualities mapping for borrowed chords
export const BORROWED_7TH_MAP = {
  minor: 'min7',
  major: 'dom7' // borrowed major chords typically function as dominant
};

// Borrowed chord definitions (from parallel minor, for major scale context only)
export const BORROWED_CHORD_DEFS = [
  { degree: 0, chordQuality: 'minor', answerQuality: 'minor', flat: false },
  { degree: 2, chordQuality: 'major', answerQuality: 'flat', flat: true },
  { degree: 3, chordQuality: 'minor', answerQuality: 'minor', flat: false },
  { degree: 4, chordQuality: 'minor', answerQuality: 'minor', flat: false },
  { degree: 5, chordQuality: 'major', answerQuality: 'flat', flat: true },
  { degree: 6, chordQuality: 'major', answerQuality: 'flat', flat: true },
];

// ===== DISPLAY FUNCTIONS =====

export const formatRomanNumeral = (degreeIndex, quality, flat = false) => {
  const base = DEGREE_NUMBERS[degreeIndex];
  const prefix = flat ? '\u266D' : '';
  switch (quality) {
    case 'major': return prefix + base;
    case 'minor': return prefix + base.toLowerCase();
    case 'dim': return prefix + base.toLowerCase() + '\u00B0';
    case 'aug': return prefix + base + '+';
    default: return prefix + base;
  }
};

export const buildChordDisplay = (note, quality) => {
  const suffix = QUALITY_SUFFIX[quality];
  if (note.includes('/')) {
    const parts = note.split('/');
    return parts.map(p => p + suffix).join('/');
  }
  return note + suffix;
};

// ===== SCALE FUNCTIONS =====

export const getNoteAtDegree = (rootNote, scaleType, degreeIndex) => {
  const rootIndex = ALL_NOTES.indexOf(rootNote);
  if (rootIndex === -1) return null;
  const scale = SCALE_TYPES[scaleType];
  if (!scale || degreeIndex < 0 || degreeIndex >= 7) return null;
  return ALL_NOTES[(rootIndex + scale.intervals[degreeIndex]) % 12];
};

export const getChordAtDegree = (rootNote, scaleType, degreeIndex) => {
  const note = getNoteAtDegree(rootNote, scaleType, degreeIndex);
  if (!note) return null;
  const quality = SCALE_TYPES[scaleType].qualities[degreeIndex];
  return {
    note,
    noteIndex: ALL_NOTES.indexOf(note),
    quality,
    degreeIndex,
    romanNumeral: formatRomanNumeral(degreeIndex, quality, false)
  };
};

export const getScaleChords = (rootNote, scaleType) => {
  return Array.from({ length: 7 }, (_, i) => getChordAtDegree(rootNote, scaleType, i));
};

// ===== BORROWED CHORD FUNCTIONS =====

export const getBorrowedChord = (rootNote, borrowedDef) => {
  const rootIndex = ALL_NOTES.indexOf(rootNote);
  if (rootIndex === -1) return null;
  const majorScale = SCALE_TYPES.major;
  let noteIndex = (rootIndex + majorScale.intervals[borrowedDef.degree]) % 12;
  if (borrowedDef.flat) {
    noteIndex = (noteIndex - 1 + 12) % 12;
  }
  return {
    note: ALL_NOTES[noteIndex],
    noteIndex,
    quality: borrowedDef.chordQuality,
    degreeIndex: borrowedDef.degree,
    answerQuality: borrowedDef.answerQuality,
    flat: borrowedDef.flat,
    romanNumeral: formatRomanNumeral(borrowedDef.degree, borrowedDef.chordQuality, borrowedDef.flat)
  };
};

// ===== GAME LOGIC =====

export const getRandomScale = (enabledScaleTypes) => {
  const types = enabledScaleTypes && enabledScaleTypes.length > 0 ? enabledScaleTypes : ['major'];
  const scaleType = types[Math.floor(Math.random() * types.length)];
  const rootNote = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)];
  return { rootNote, scaleType };
};

export const getRandomDegree = () => Math.floor(Math.random() * 7);

const getRandomBorrowedDef = () => {
  return BORROWED_CHORD_DEFS[Math.floor(Math.random() * BORROWED_CHORD_DEFS.length)];
};

// Question generators

export const generateNumberToChordQuestion = (rootNote, scaleType, includeBorrowed = false) => {
  if (includeBorrowed && scaleType === 'major' && Math.random() < 0.25) {
    const def = getRandomBorrowedDef();
    const borrowed = getBorrowedChord(rootNote, def);
    return {
      type: 'number-to-chord',
      scale: { rootNote, scaleType },
      romanNumeral: borrowed.romanNumeral,
      correctNoteIndex: borrowed.noteIndex,
      correctQuality: borrowed.quality,
      isBorrowed: true
    };
  }
  const deg = getRandomDegree();
  const chord = getChordAtDegree(rootNote, scaleType, deg);
  return {
    type: 'number-to-chord',
    scale: { rootNote, scaleType },
    romanNumeral: chord.romanNumeral,
    correctNoteIndex: chord.noteIndex,
    correctQuality: chord.quality,
    isBorrowed: false
  };
};

export const generateChordToNumberQuestion = (rootNote, scaleType, includeBorrowed = false) => {
  if (includeBorrowed && scaleType === 'major' && Math.random() < 0.25) {
    const def = getRandomBorrowedDef();
    const borrowed = getBorrowedChord(rootNote, def);
    return {
      type: 'chord-to-number',
      scale: { rootNote, scaleType },
      chordDisplay: buildChordDisplay(borrowed.note, borrowed.quality),
      correctDegree: borrowed.degreeIndex,
      correctAnswerQuality: borrowed.answerQuality,
      isBorrowed: true
    };
  }
  const deg = getRandomDegree();
  const chord = getChordAtDegree(rootNote, scaleType, deg);
  return {
    type: 'chord-to-number',
    scale: { rootNote, scaleType },
    chordDisplay: buildChordDisplay(chord.note, chord.quality),
    correctDegree: deg,
    correctAnswerQuality: chord.quality,
    isBorrowed: false
  };
};

export const generateTranspositionQuestion = (sourceRoot, sourceScaleType, targetRoot, targetScaleType, includeBorrowed = false) => {
  if (includeBorrowed && sourceScaleType === 'major' && targetScaleType === 'major' && Math.random() < 0.25) {
    const def = getRandomBorrowedDef();
    const sourceBorrowed = getBorrowedChord(sourceRoot, def);
    const targetBorrowed = getBorrowedChord(targetRoot, def);
    return {
      type: 'transposition',
      sourceScale: { rootNote: sourceRoot, scaleType: sourceScaleType },
      targetScale: { rootNote: targetRoot, scaleType: targetScaleType },
      chordDisplay: buildChordDisplay(sourceBorrowed.note, sourceBorrowed.quality),
      correctNoteIndex: targetBorrowed.noteIndex,
      correctQuality: targetBorrowed.quality,
      isBorrowed: true
    };
  }
  const deg = getRandomDegree();
  const sourceChord = getChordAtDegree(sourceRoot, sourceScaleType, deg);
  const targetChord = getChordAtDegree(targetRoot, targetScaleType, deg);
  return {
    type: 'transposition',
    sourceScale: { rootNote: sourceRoot, scaleType: sourceScaleType },
    targetScale: { rootNote: targetRoot, scaleType: targetScaleType },
    chordDisplay: buildChordDisplay(sourceChord.note, sourceChord.quality),
    correctNoteIndex: targetChord.noteIndex,
    correctQuality: targetChord.quality,
    isBorrowed: false
  };
};

export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ===== INTERVAL LOGIC (unchanged) =====

export const INTERVALS = [
  { name: 'm2', fullName: 'Minor 2nd', semitones: 1 },
  { name: 'M2', fullName: 'Major 2nd', semitones: 2 },
  { name: 'm3', fullName: 'Minor 3rd', semitones: 3 },
  { name: 'M3', fullName: 'Major 3rd', semitones: 4 },
  { name: 'P4', fullName: 'Perfect 4th', semitones: 5 },
  { name: 'TT', fullName: 'Tritone', semitones: 6 },
  { name: 'P5', fullName: 'Perfect 5th', semitones: 7 },
  { name: 'm6', fullName: 'Minor 6th', semitones: 8 },
  { name: 'M6', fullName: 'Major 6th', semitones: 9 },
  { name: 'm7', fullName: 'Minor 7th', semitones: 10 },
  { name: 'M7', fullName: 'Major 7th', semitones: 11 },
  { name: 'P8', fullName: 'Octave', semitones: 12 },
  { name: 'm9', fullName: 'Minor 9th', semitones: 13 },
  { name: 'M9', fullName: 'Major 9th', semitones: 14 },
  { name: 'P11', fullName: 'Perfect 11th', semitones: 17 },
  { name: 'M13', fullName: 'Major 13th', semitones: 21 }
];

export const getInterval = (note1, note2) => {
  const index1 = ALL_NOTES.indexOf(note1);
  const index2 = ALL_NOTES.indexOf(note2);
  if (index1 === -1 || index2 === -1) return null;
  let semitones = index2 - index1;
  if (semitones < 0) semitones += 12;
  if (semitones === 0) semitones = 12;
  const interval = INTERVALS.find(i => i.semitones === semitones);
  return interval ? interval.name : null;
};

export const generateRandomNotePair = () => {
  const note1 = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)];
  let intervalIndex = Math.floor(Math.random() * INTERVALS.length);
  if (INTERVALS[intervalIndex].semitones > 12) {
    let baseSemitones = INTERVALS[intervalIndex].semitones % 12;
    intervalIndex = INTERVALS.findIndex(i => i.semitones === baseSemitones);
  }
  const interval = INTERVALS[intervalIndex];
  const note1Index = ALL_NOTES.indexOf(note1);
  const note2Index = (note1Index + interval.semitones) % 12;
  const note2 = ALL_NOTES[note2Index];
  return { note1, note2, correctInterval: interval.name };
};

export const transposeByInterval = (startNote, intervalName, direction) => {
  const startIndex = ALL_NOTES.indexOf(startNote);
  if (startIndex === -1) return null;
  const interval = INTERVALS.find(i => i.name === intervalName);
  if (!interval) return null;
  let destinationIndex;
  if (direction === 'up') {
    destinationIndex = (startIndex + interval.semitones) % 12;
  } else {
    destinationIndex = (startIndex - (interval.semitones % 12) + 12) % 12;
  }
  return ALL_NOTES[destinationIndex];
};

export const generateIntervalTransposition = () => {
  const startNote = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)];
  const interval = INTERVALS[Math.floor(Math.random() * INTERVALS.length)];
  const direction = Math.random() > 0.5 ? 'up' : 'down';
  const correctNote = transposeByInterval(startNote, interval.name, direction);
  return {
    startNote,
    interval: interval.name,
    intervalFullName: interval.fullName,
    direction,
    correctNote
  };
};
