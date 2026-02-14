// All 12 major keys and their chords (I-vi pattern)
export const MAJOR_KEYS = {
  'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am'],
  'C#': ['C#', 'D#m', 'E#m', 'F#', 'G#', 'A#m'],
  'Db': ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm'],
  'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm'],
  'Eb': ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm'],
  'E': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m'],
  'F': ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm'],
  'F#': ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m'],
  'Gb': ['Gb', 'Abm', 'Bbm', 'Cb', 'Db', 'Ebm'],
  'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em'],
  'Ab': ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm'],
  'A': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m'],
  'Bb': ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm'],
  'B': ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m']
};

// All 24 chords (12 major + 12 minor)
export const ALL_CHORDS = [
  'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm'
];

export const MAJOR_CHORDS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MINOR_CHORDS = ['Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm', 'E#m'];

// Get the chord for a given key and number (1-6)
export const getChordForNumber = (key, number) => {
  const chords = MAJOR_KEYS[key];
  return chords ? chords[number - 1] : null;
};

// Get the number for a given chord in a key
export const getNumberForChord = (key, chord) => {
  const chords = MAJOR_KEYS[key];
  if (!chords) return null;
  const index = chords.indexOf(chord);
  return index >= 0 ? index + 1 : null;
};

// Get a random key
export const getRandomKey = () => {
  const keys = Object.keys(MAJOR_KEYS);
  return keys[Math.floor(Math.random() * keys.length)];
};

// Get a random number (1-6)
export const getRandomNumber = () => {
  return Math.floor(Math.random() * 6) + 1;
};

// Generate unique session ID
export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
