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

// Get a random number (1-6 or 1-13 with borrowed)
export const getRandomNumber = (includeBorrowed = false) => {
  const max = includeBorrowed ? 13 : 6;
  return Math.floor(Math.random() * max) + 1;
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
  
  // Check borrowed chords
  const sourceBorrowed = BORROWED_CHORDS[sourceKey];
  const targetBorrowed = BORROWED_CHORDS[targetKey];
  if (sourceBorrowed && targetBorrowed) {
    for (let i = 0; i < sourceBorrowed.length; i++) {
      if (chordsAreEqual(sourceBorrowed[i], normalizedChord)) {
        return targetBorrowed[i];
      }
    }
  }
  
  return null;
};

// Get a random chord from a key (including borrowed if enabled)
export const getRandomChordFromKey = (key, includeBorrowed = false) => {
  const number = getRandomNumber(includeBorrowed);
  return getChordForNumber(key, number, includeBorrowed);
};

// Generate unique session ID
export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
