// Consolidated major keys with dual names where applicable
export const MAJOR_KEYS = {
  'C': {
    name: 'C',
    chords: ['C', 'Dm', 'Em', 'F', 'G', 'Am']
  },
  'C#/Db': {
    name: 'C#/Db',
    chords: ['C#/Db', 'D#m/Ebm', 'E#m/Fm', 'F#/Gb', 'G#/Ab', 'A#m/Bbm']
  },
  'D': {
    name: 'D',
    chords: ['D', 'Em', 'F#m', 'G', 'A', 'Bm']
  },
  'D#/Eb': {
    name: 'D#/Eb',
    chords: ['D#/Eb', 'Fm', 'Gm', 'G#/Ab', 'A#/Bb', 'Cm']
  },
  'E': {
    name: 'E',
    chords: ['E', 'F#m', 'G#m', 'A', 'B', 'C#m']
  },
  'F': {
    name: 'F',
    chords: ['F', 'Gm', 'Am', 'A#/Bb', 'C', 'Dm']
  },
  'F#/Gb': {
    name: 'F#/Gb',
    chords: ['F#/Gb', 'G#m/Abm', 'A#m/Bbm', 'B', 'C#/Db', 'D#m/Ebm']
  },
  'G': {
    name: 'G',
    chords: ['G', 'Am', 'Bm', 'C', 'D', 'Em']
  },
  'G#/Ab': {
    name: 'G#/Ab',
    chords: ['G#/Ab', 'A#m/Bbm', 'Cm', 'C#/Db', 'D#/Eb', 'Fm']
  },
  'A': {
    name: 'A',
    chords: ['A', 'Bm', 'C#m', 'D', 'E', 'F#m']
  },
  'A#/Bb': {
    name: 'A#/Bb',
    chords: ['A#/Bb', 'Cm', 'Dm', 'D#/Eb', 'F', 'Gm']
  },
  'B': {
    name: 'B',
    chords: ['B', 'C#m', 'D#m', 'E', 'F#/Gb', 'G#m']
  }
};

// Borrowed chords from parallel minor (for each major key) - only major/minor, no diminished
export const PARALLEL_MINOR_CHORDS = {
  'C': ['Cm', 'D#/Eb', 'Fm', 'Gm', 'G#/Ab', 'A#/Bb'],
  'C#/Db': ['C#m/Dbm', 'E', 'F#m/Gbm', 'G#m/Abm', 'A', 'B'],
  'D': ['Dm', 'F', 'Gm', 'Am', 'A#/Bb', 'C'],
  'D#/Eb': ['D#m/Ebm', 'F#/Gb', 'G#m/Abm', 'A#m/Bbm', 'B', 'C#/Db'],
  'E': ['Em', 'G', 'Am', 'Bm', 'C', 'D'],
  'F': ['Fm', 'G#/Ab', 'A#m/Bbm', 'Cm', 'C#/Db', 'D#/Eb'],
  'F#/Gb': ['F#m/Gbm', 'A', 'Bm', 'C#m/Dbm', 'D', 'E'],
  'G': ['Gm', 'A#/Bb', 'Cm', 'Dm', 'D#/Eb', 'F'],
  'G#/Ab': ['G#m/Abm', 'B', 'C#m/Dbm', 'D#m/Ebm', 'E', 'F#/Gb'],
  'A': ['Am', 'C', 'Dm', 'Em', 'F', 'G'],
  'A#/Bb': ['A#m/Bbm', 'C#/Db', 'D#m/Ebm', 'Fm', 'F#/Gb', 'G#/Ab'],
  'B': ['Bm', 'D', 'Em', 'F#m', 'G', 'A']
};

// Roman numeral labels for diatonic and parallel minor chords
export const DIATONIC_LABELS = ['I', 'ii', 'iii', 'IV', 'V', 'vi'];
export const PARALLEL_MINOR_LABELS = ['i', '♭III', 'iv', 'v', '♭VI', '♭VII'];

// All 24 chords with dual names
export const ALL_CHORDS_DISPLAY = [
  'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B',
  'Cm', 'C#m/Dbm', 'Dm', 'D#m/Ebm', 'Em', 'Fm', 'F#m/Gbm', 'Gm', 'G#m/Abm', 'Am', 'A#m/Bbm', 'Bm'
];

// Get the chord for a given key and roman numeral
export const getChordForNumber = (key, romanNumeral, includeParallelMinor = false) => {
  const keyData = MAJOR_KEYS[key];
  if (!keyData) return null;
  
  // Find index in appropriate label array
  const diatonicIndex = DIATONIC_LABELS.indexOf(romanNumeral);
  if (diatonicIndex >= 0) {
    return keyData.chords[diatonicIndex] || null;
  }
  
  if (includeParallelMinor) {
    const parallelIndex = PARALLEL_MINOR_LABELS.indexOf(romanNumeral);
    if (parallelIndex >= 0) {
      const parallelChords = PARALLEL_MINOR_CHORDS[key];
      return parallelChords ? parallelChords[parallelIndex] : null;
    }
  }
  
  return null;
};

// Enharmonic equivalents mapping
const ENHARMONIC_MAP = {
  'C#': 'C#/Db',
  'Db': 'C#/Db',
  'D#': 'D#/Eb',
  'Eb': 'D#/Eb',
  'F#': 'F#/Gb',
  'Gb': 'F#/Gb',
  'G#': 'G#/Ab',
  'Ab': 'G#/Ab',
  'A#': 'A#/Bb',
  'Bb': 'A#/Bb',
  'C#m': 'C#m/Dbm',
  'Dbm': 'C#m/Dbm',
  'D#m': 'D#m/Ebm',
  'Ebm': 'D#m/Ebm',
  'F#m': 'F#m/Gbm',
  'Gbm': 'F#m/Gbm',
  'G#m': 'G#m/Abm',
  'Abm': 'G#m/Abm',
  'A#m': 'A#m/Bbm',
  'Bbm': 'A#m/Bbm',
  'E#m': 'Fm'
};

// Normalize chord to handle enharmonic equivalents
export const normalizeChord = (chord) => {
  if (!chord) return chord;
  return ENHARMONIC_MAP[chord] || chord;
};

// Compare two chords considering enharmonic equivalents
export const chordsAreEqual = (chord1, chord2) => {
  return normalizeChord(chord1) === normalizeChord(chord2);
};

// Get the roman numeral for a given chord in a key (with enharmonic support)
export const getNumberForChord = (key, chord, includeParallelMinor = false) => {
  const keyData = MAJOR_KEYS[key];
  if (!keyData) return null;
  
  const normalizedChord = normalizeChord(chord);
  
  // Check diatonic chords
  for (let i = 0; i < keyData.chords.length; i++) {
    if (chordsAreEqual(keyData.chords[i], normalizedChord)) {
      return DIATONIC_LABELS[i];
    }
  }
  
  // Check parallel minor chords if enabled
  if (includeParallelMinor) {
    const parallelChords = PARALLEL_MINOR_CHORDS[key];
    if (parallelChords) {
      for (let i = 0; i < parallelChords.length; i++) {
        if (chordsAreEqual(parallelChords[i], normalizedChord)) {
          return PARALLEL_MINOR_LABELS[i];
        }
      }
    }
  }
  
  return null;
};

// Get a random key
export const getRandomKey = () => {
  const keys = Object.keys(MAJOR_KEYS);
  return keys[Math.floor(Math.random() * keys.length)];
};

// Get a random roman numeral (I-vi or with parallel minor)
export const getRandomNumber = (includeParallelMinor = false) => {
  const allLabels = includeParallelMinor 
    ? [...DIATONIC_LABELS, ...PARALLEL_MINOR_LABELS]
    : DIATONIC_LABELS;
  return allLabels[Math.floor(Math.random() * allLabels.length)];
};

// Get all available roman numerals
export const getAllRomanNumerals = (includeParallelMinor = false) => {
  return includeParallelMinor 
    ? [...DIATONIC_LABELS, ...PARALLEL_MINOR_LABELS]
    : DIATONIC_LABELS;
};

// Transpose a chord from source key to target key
export const transposeChord = (chord, sourceKey, targetKey) => {
  // Find the position of the chord in source key
  const sourceKeyData = MAJOR_KEYS[sourceKey];
  const targetKeyData = MAJOR_KEYS[targetKey];
  
  if (!sourceKeyData || !targetKeyData) return null;
  
  // Check diatonic chords
  const normalizedChord = normalizeChord(chord);
  for (let i = 0; i < sourceKeyData.chords.length; i++) {
    if (chordsAreEqual(sourceKeyData.chords[i], normalizedChord)) {
      return targetKeyData.chords[i];
    }
  }
  
  // Check parallel minor chords
  const sourceparallel = PARALLEL_MINOR_CHORDS[sourceKey];
  const targetparallel = PARALLEL_MINOR_CHORDS[targetKey];
  if (sourceparallel && targetparallel) {
    for (let i = 0; i < sourceparallel.length; i++) {
      if (chordsAreEqual(sourceparallel[i], normalizedChord)) {
        return targetparallel[i];
      }
    }
  }
  
  return null;
};

// Get a random chord from a key (including parallel minor if enabled)
export const getRandomChordFromKey = (key, includeParallelMinor = false) => {
  const romanNumeral = getRandomNumber(includeParallelMinor);
  return getChordForNumber(key, romanNumeral, includeParallelMinor);
};

// Generate unique session ID
export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Interval logic for the fourth mode
export const ALL_NOTES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

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
  { name: 'P8', fullName: 'Octave', semitones: 12 }
];

// Get interval between two notes
export const getInterval = (note1, note2) => {
  const index1 = ALL_NOTES.indexOf(note1);
  const index2 = ALL_NOTES.indexOf(note2);
  
  if (index1 === -1 || index2 === -1) return null;
  
  // Calculate semitones (can go up to 12 for octave)
  let semitones = index2 - index1;
  if (semitones < 0) semitones += 12;
  if (semitones === 0) semitones = 12; // Same note = octave
  
  const interval = INTERVALS.find(i => i.semitones === semitones);
  return interval ? interval.name : null;
};

// Calculate destination note given start note, interval, and direction
export const transposeByInterval = (startNote, intervalName, direction) => {
  const startIndex = ALL_NOTES.indexOf(startNote);
  if (startIndex === -1) return null;
  
  const interval = INTERVALS.find(i => i.name === intervalName);
  if (!interval) return null;
  
  let destinationIndex;
  if (direction === 'up') {
    destinationIndex = (startIndex + interval.semitones) % 12;
  } else {
    destinationIndex = (startIndex - interval.semitones + 12) % 12;
  }
  
  return ALL_NOTES[destinationIndex];
};

// Generate random interval transposition question
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
