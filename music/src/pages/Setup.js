import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Info } from 'lucide-react';
import { ALL_NOTES, SCALE_TYPES, ALL_SCALE_TYPE_IDS, getApplicableScaleTypes } from '../utils/chordLogic';
import ThemeToggle from '../components/ThemeToggle';

const OTHER_MODES = ['dorian', 'phrygian', 'lydian', 'mixolydian'];

const Setup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.state?.mode || 'number-to-chord';

  // Scale type checkboxes
  const [majorEnabled, setMajorEnabled] = useState(true);
  const [naturalMinorEnabled, setNaturalMinorEnabled] = useState(false);
  const [harmonicMinorEnabled, setHarmonicMinorEnabled] = useState(false);
  const [melodicMinorEnabled, setMelodicMinorEnabled] = useState(false);
  const [otherModesEnabled, setOtherModesEnabled] = useState(false);

  // Scale selection
  const [scaleSelection, setScaleSelection] = useState('preselected');
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedScaleType, setSelectedScaleType] = useState('major');

  // Transposition
  const [targetScaleSelection, setTargetScaleSelection] = useState('random');
  const [sourceRoot, setSourceRoot] = useState('C');
  const [targetRoot, setTargetRoot] = useState('D');

  // Guess-scale sub-mode: 'chords' (default) or 'notes'
  const [guessScaleSubmode, setGuessScaleSubmode] = useState('chords');

  // Options
  const [includeRegular, setIncludeRegular] = useState(true);
  const [includeBorrowed, setIncludeBorrowed] = useState(false);
  const [includeSecondaryDominants, setIncludeSecondaryDominants] = useState(false);
  const [include7ths, setInclude7ths] = useState(false);
  const [timerMode, setTimerMode] = useState('untimed');
  const [timerDuration, setTimerDuration] = useState('60');

  // chord-from-notes options
  const [enabledChordGroups, setEnabledChordGroups] = useState(['basic']);
  const [includeInversions, setIncludeInversions] = useState(false);
  const [omitNotes, setOmitNotes] = useState(false);

  // Interval recognition sub-mode
  // - absolute: two actual notes, identify the interval between them
  // - relative: scale type + two scale degrees (1-7), identify the interval between degrees
  const [intervalRecognitionSubmode, setIntervalRecognitionSubmode] = useState('absolute');

  const getEnabledScaleTypes = () => {
    const types = [];
    if (majorEnabled) types.push('major');
    if (naturalMinorEnabled) types.push('naturalMinor');
    if (harmonicMinorEnabled) types.push('harmonicMinor');
    if (melodicMinorEnabled) types.push('melodicMinor');
    if (otherModesEnabled) types.push(...OTHER_MODES);
    return types.length > 0 ? types : ['major'];
  };

  const availableScaleTypes = getEnabledScaleTypes();

  const ensureValidScaleType = (current) =>
    availableScaleTypes.includes(current) ? current : availableScaleTypes[0];

  const ensureValidPreselectedScaleType = (current) =>
    ALL_SCALE_TYPE_IDS.includes(current) ? current : ALL_SCALE_TYPE_IDS[0];

  const handleStartGame = () => {
    if (chordSourceError) return;
    const useFullScalePool =
      (mode === 'number-to-chord' || mode === 'chord-to-number') && scaleSelection === 'preselected';
    const transpositionFullPool = mode === 'transposition' && targetScaleSelection === 'preselected';
    const enabledScaleTypes =
      useFullScalePool || transpositionFullPool ? ALL_SCALE_TYPE_IDS : getEnabledScaleTypes();
    const gameConfig = {
      mode,
      enabledScaleTypes,
      includeRegular,
      includeBorrowed,
      includeSecondaryDominants,
      include7ths,
      timerMode,
      timerDuration: timerMode === 'timed' ? parseInt(timerDuration) : null,
    };

    if (mode === 'transposition') {
      gameConfig.targetScaleSelection = targetScaleSelection;
      if (targetScaleSelection === 'preselected') {
        gameConfig.sourceRoot = sourceRoot;
        gameConfig.targetRoot = targetRoot;
      }
    } else if (mode === 'guess-scale') {
      // Guess scale mode: always random, just needs enabled scale types and 7ths setting
      gameConfig.scaleSelection = 'random';
      gameConfig.guessScaleSubmode = guessScaleSubmode;
    } else if (mode === 'chord-progression') {
      const progTypes = [];
      if (majorEnabled) progTypes.push('major');
      if (naturalMinorEnabled) progTypes.push('naturalMinor');
      if (harmonicMinorEnabled) progTypes.push('harmonicMinor');
      const validProgTypes = progTypes.length > 0 ? progTypes : ['major'];
      gameConfig.enabledScaleTypes = validProgTypes;
      gameConfig.scaleSelection = scaleSelection;
      gameConfig.selectedRoot = scaleSelection === 'random' ? null : selectedRoot;
      gameConfig.selectedScaleType = scaleSelection === 'random'
        ? null
        : (validProgTypes.includes(selectedScaleType) ? selectedScaleType : validProgTypes[0]);
    } else if (mode === 'chord-from-notes') {
      gameConfig.scaleSelection = scaleSelection;
      gameConfig.selectedRoot = scaleSelection === 'random' ? null : selectedRoot;
      gameConfig.selectedScaleType = scaleSelection === 'random'
        ? null
        : ensureValidScaleType(selectedScaleType);
      gameConfig.enabledScaleTypes = getEnabledScaleTypes();
      gameConfig.enabledChordGroups = enabledChordGroups;
      gameConfig.includeInversions = includeInversions;
      gameConfig.omitNotes = omitNotes;
    } else if (mode !== 'intervals' && mode !== 'interval-transpose') {
      gameConfig.scaleSelection = scaleSelection;
      gameConfig.selectedRoot = scaleSelection === 'random' ? null : selectedRoot;
      gameConfig.selectedScaleType =
        scaleSelection === 'random' ? null
          : ((mode === 'number-to-chord' || mode === 'chord-to-number') && scaleSelection === 'preselected')
            ? ensureValidPreselectedScaleType(selectedScaleType)
            : ensureValidScaleType(selectedScaleType);
    }

    if (mode === 'intervals') {
      gameConfig.intervalRecognitionSubmode = intervalRecognitionSubmode;
    }

    navigate('/game', { state: gameConfig });
  };

  const getModeTitle = () => {
    if (mode === 'number-to-chord') return 'Number \u2192 Chord';
    if (mode === 'chord-to-number') return 'Chord \u2192 Number';
    if (mode === 'transposition') return 'Transposition';
    if (mode === 'intervals') return 'Interval Recognition';
    if (mode === 'interval-transpose') return 'Interval Transposition';
    if (mode === 'guess-scale') return 'Guess the Scale';
    if (mode === 'chord-progression') return 'Chord Progression';
    if (mode === 'chord-from-notes') return 'Chord from Notes';
    return 'Unknown Mode';
  };

  const isNonIntervalMode = mode !== 'intervals' && mode !== 'interval-transpose';
  const isGuessScaleMode = mode === 'guess-scale';
  const isChordProgressionMode = mode === 'chord-progression';
  const isChordFromNotesMode = mode === 'chord-from-notes';

  // Modes that expose the unified "Chord Types" panel
  const isChordSourceMode =
    mode === 'number-to-chord' || mode === 'chord-to-number' || mode === 'transposition';

  // Count of functional-harmony scale types enabled (for chord-progression)
  const progEnabledCount = [majorEnabled, naturalMinorEnabled, harmonicMinorEnabled].filter(Boolean).length;

  // The set of scale types the chosen chord sources will actually be tested against.
  const getChordSourcePool = () => {
    if (mode === 'transposition') {
      // Random roots → user picks the pool; Fixed roots → scale type is random across all.
      return targetScaleSelection === 'random' ? getEnabledScaleTypes() : ALL_SCALE_TYPE_IDS;
    }
    // number-to-chord / chord-to-number
    if (scaleSelection === 'preselected') {
      return [ensureValidPreselectedScaleType(selectedScaleType)];
    }
    return getEnabledScaleTypes();
  };

  const chordSourceFlags = { includeRegular, includeBorrowed, includeSecondaryDominants };
  const applicableSourcePool = getApplicableScaleTypes(getChordSourcePool(), chordSourceFlags);
  // At least one selected chord type must apply to the chosen scale pool.
  const chordSourceError = isChordSourceMode && applicableSourcePool.length === 0;
  const chordSourcePoolSize = getChordSourcePool().length;

  // Count enabled scale types to prevent deselecting the last one
  const enabledCount = [majorEnabled, naturalMinorEnabled, harmonicMinorEnabled, melodicMinorEnabled, otherModesEnabled].filter(Boolean).length;

  // Toggle functions that prevent deselecting the last option
  const toggleMajor = () => {
    if (majorEnabled && enabledCount === 1) return; // Can't deselect last
    setMajorEnabled(!majorEnabled);
  };
  const toggleNaturalMinor = () => {
    if (naturalMinorEnabled && enabledCount === 1) return;
    setNaturalMinorEnabled(!naturalMinorEnabled);
  };
  const toggleHarmonicMinor = () => {
    if (harmonicMinorEnabled && enabledCount === 1) return;
    setHarmonicMinorEnabled(!harmonicMinorEnabled);
  };
  const toggleMelodicMinor = () => {
    if (melodicMinorEnabled && enabledCount === 1) return;
    setMelodicMinorEnabled(!melodicMinorEnabled);
  };
  const toggleOtherModes = () => {
    if (otherModesEnabled && enabledCount === 1) return;
    setOtherModesEnabled(!otherModesEnabled);
  };

  const toggleChordGroup = (group) => {
    setEnabledChordGroups(prev => {
      if (prev.includes(group)) {
        if (prev.length === 1) return prev;
        return prev.filter(g => g !== group);
      }
      return [...prev, group];
    });
  };

  // Compact switch row: title + info tooltip on the left, toggle on the right.
  const SwitchRow = ({ label, description, checked, onChange, testId }) => (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-bold text-[#1A1A1A] truncate">{label}</span>
        <span className="relative group shrink-0 flex items-center">
          <Info className="w-4 h-4 text-[#9CA3AF] cursor-help" aria-hidden="true" />
          <span className="sr-only">{description}</span>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-sm bg-[#1A1A1A] text-white text-xs leading-relaxed p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 text-left shadow-lg"
          >
            {description}
          </span>
        </span>
      </div>
      <button
        type="button"
        data-testid={testId}
        onClick={onChange}
        aria-pressed={checked}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  const ScaleCheckbox = ({ label, checked, onChange, testId, subtitle, disabled }) => (
    <button
      data-testid={testId}
      onClick={onChange}
      disabled={disabled}
      className={`flex items-center gap-3 p-3 border-2 rounded-sm transition-all w-full text-left ${
        checked ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center shrink-0 transition-colors ${
        checked ? 'border-[#002FA7] bg-[#002FA7]' : 'border-[#9CA3AF]'
      }`}>
        {checked && <span className="text-white text-xs font-bold">{'\u2713'}</span>}
      </div>
      <div>
        <span className="font-bold text-[#1A1A1A]">{label}</span>
        {subtitle && <p className="text-xs text-[#9CA3AF] mt-0.5">{subtitle}</p>}
      </div>
    </button>
  );

  const ScaleTypeSelect = ({ value, onChange, testId, useAllScaleTypes }) => (
    <select
      data-testid={testId}
      value={useAllScaleTypes ? ensureValidPreselectedScaleType(value) : ensureValidScaleType(value)}
      onChange={onChange}
      className="w-full p-3 border-2 border-[#E5E7EB] rounded-sm focus:border-[#002FA7] focus:outline-none text-lg"
    >
      {(useAllScaleTypes ? ALL_SCALE_TYPE_IDS : availableScaleTypes).map(id => (
        <option key={id} value={id}>{SCALE_TYPES[id].name}</option>
      ))}
    </select>
  );

  const RootSelect = ({ value, onChange, testId }) => (
    <select
      data-testid={testId}
      value={value}
      onChange={onChange}
      className="w-full p-3 border-2 border-[#E5E7EB] rounded-sm focus:border-[#002FA7] focus:outline-none text-lg"
    >
      {ALL_NOTES.map(note => (
        <option key={note} value={note}>{note}</option>
      ))}
    </select>
  );

  const TimerSection = () => (
    <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
      <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Timer Mode</h3>
      <div className="space-y-3">
        <button
          data-testid="timer-untimed"
          onClick={() => setTimerMode('untimed')}
          className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
            timerMode === 'untimed' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
          }`}
        >
          <div className="font-bold text-[#1A1A1A]">Untimed</div>
          <div className="text-sm text-[#9CA3AF]">Practice at your own pace</div>
        </button>
        <button
          data-testid="timer-timed"
          onClick={() => setTimerMode('timed')}
          className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
            timerMode === 'timed' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
          }`}
        >
          <div className="font-bold text-[#1A1A1A]">Timed</div>
          <div className="text-sm text-[#9CA3AF]">Race against the clock</div>
        </button>
      </div>
      {timerMode === 'timed' && (
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Duration</label>
          <div className="grid grid-cols-3 gap-3">
            {['15', '30', '60'].map((d) => (
              <button
                key={d}
                data-testid={`timer-${d}`}
                onClick={() => setTimerDuration(d)}
                className={`p-3 border-2 rounded-sm font-bold transition-all ${
                  timerDuration === d ? 'border-[#002FA7] bg-[#002FA7] text-white' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <button
            data-testid="back-button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#9CA3AF] hover:text-[#002FA7] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Back</span>
          </button>
          <ThemeToggle />
        </div>

        <div className="mb-12">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1A1A1A] mb-2">Game Setup</h2>
          <p className="text-[#9CA3AF]">Mode: {getModeTitle()}</p>
        </div>

        <div className="space-y-6 mb-12">
          {!isNonIntervalMode ? (
            <>
              {mode === 'intervals' && (
                <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                  <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Interval Sub-Mode</h3>
                  <p className="text-xs text-[#9CA3AF] mb-3">Choose what the interval is based on</p>

                  <div className="space-y-3">
                    <button
                      data-testid="interval-absolute-submode"
                      type="button"
                      onClick={() => setIntervalRecognitionSubmode('absolute')}
                      className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                        intervalRecognitionSubmode === 'absolute'
                          ? 'border-[#002FA7] bg-[#002FA7]/5'
                          : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                      }`}
                    >
                      <div className="font-bold text-[#1A1A1A]">Absolute Notes</div>
                      <div className="text-sm text-[#9CA3AF]">Two notes, identify the interval</div>
                    </button>

                    <button
                      data-testid="interval-relative-submode"
                      type="button"
                      onClick={() => setIntervalRecognitionSubmode('relative')}
                      className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                        intervalRecognitionSubmode === 'relative'
                          ? 'border-[#002FA7] bg-[#002FA7]/5'
                          : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                      }`}
                    >
                      <div className="font-bold text-[#1A1A1A]">Relative Degrees</div>
                      <div className="text-sm text-[#9CA3AF]">Scale type + 1-7 degrees (e.g. 3 → 7)</div>
                    </button>
                  </div>

                  {intervalRecognitionSubmode === 'relative' && (
                    <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
                      <h4 className="text-lg font-medium tracking-tight text-[#1A1A1A] mb-1">Scale types in pool</h4>
                      <p className="text-xs text-[#9CA3AF] mb-3">At least one must be selected</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ScaleCheckbox
                          label="Major"
                          checked={majorEnabled}
                          onChange={toggleMajor}
                          testId="scale-type-major"
                          disabled={majorEnabled && enabledCount === 1}
                        />
                        <ScaleCheckbox
                          label="Natural Minor"
                          checked={naturalMinorEnabled}
                          onChange={toggleNaturalMinor}
                          testId="scale-type-natural-minor"
                          disabled={naturalMinorEnabled && enabledCount === 1}
                        />
                        <ScaleCheckbox
                          label="Harmonic Minor"
                          checked={harmonicMinorEnabled}
                          onChange={toggleHarmonicMinor}
                          testId="scale-type-harmonic-minor"
                          disabled={harmonicMinorEnabled && enabledCount === 1}
                        />
                        <ScaleCheckbox
                          label="Melodic Minor"
                          checked={melodicMinorEnabled}
                          onChange={toggleMelodicMinor}
                          testId="scale-type-melodic-minor"
                          disabled={melodicMinorEnabled && enabledCount === 1}
                        />
                        <ScaleCheckbox
                          label="Other Modes"
                          subtitle="Dorian, Phrygian, Lydian, Mixolydian"
                          checked={otherModesEnabled}
                          onChange={toggleOtherModes}
                          testId="scale-type-other-modes"
                          disabled={otherModesEnabled && enabledCount === 1}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <TimerSection />
            </>
          ) : isGuessScaleMode ? (
            <>
              {/* Clue Type — chords or notes */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-1">Clue Type</h3>
                <p className="text-xs text-[#9CA3AF] mb-4">What you'll see as the clue each round</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    data-testid="guess-scale-clue-chords"
                    onClick={() => setGuessScaleSubmode('chords')}
                    className={`p-4 border-2 rounded-sm text-left transition-all ${
                      guessScaleSubmode !== 'notes'
                        ? 'border-[#002FA7] bg-[#002FA7]/5'
                        : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="font-bold text-[#1A1A1A]">Chords</div>
                    <div className="text-sm text-[#9CA3AF]">Diatonic chord names</div>
                  </button>
                  <button
                    data-testid="guess-scale-clue-notes"
                    onClick={() => setGuessScaleSubmode('notes')}
                    className={`p-4 border-2 rounded-sm text-left transition-all ${
                      guessScaleSubmode === 'notes'
                        ? 'border-[#002FA7] bg-[#002FA7]/5'
                        : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="font-bold text-[#1A1A1A]">Notes</div>
                    <div className="text-sm text-[#9CA3AF]">Individual scale notes</div>
                  </button>
                </div>
              </div>

              {/* Guess the Scale — always random; pool defines which scale types appear */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Scale Selection</h3>
                <p className="text-xs text-[#9CA3AF] mb-3">Each question uses a random scale from your selection — at least one scale type must be selected</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ScaleCheckbox label="Major" checked={majorEnabled} onChange={toggleMajor} testId="scale-type-major" disabled={majorEnabled && enabledCount === 1} />
                  <ScaleCheckbox label="Natural Minor" checked={naturalMinorEnabled} onChange={toggleNaturalMinor} testId="scale-type-natural-minor" disabled={naturalMinorEnabled && enabledCount === 1} />
                  <ScaleCheckbox label="Harmonic Minor" checked={harmonicMinorEnabled} onChange={toggleHarmonicMinor} testId="scale-type-harmonic-minor" disabled={harmonicMinorEnabled && enabledCount === 1} />
                  <ScaleCheckbox label="Melodic Minor" checked={melodicMinorEnabled} onChange={toggleMelodicMinor} testId="scale-type-melodic-minor" disabled={melodicMinorEnabled && enabledCount === 1} />
                  <ScaleCheckbox
                    label="Other Modes"
                    subtitle="Dorian, Phrygian, Lydian, Mixolydian"
                    checked={otherModesEnabled}
                    onChange={toggleOtherModes}
                    testId="scale-type-other-modes"
                    disabled={otherModesEnabled && enabledCount === 1}
                  />
                </div>
              </div>

              {/* 7th Chords — only relevant in chords sub-mode */}
              {guessScaleSubmode !== 'notes' && (
                <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                  <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">7th Chords</h3>
                  <button
                    data-testid="7th-chords-toggle"
                    onClick={() => setInclude7ths(!include7ths)}
                    className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                      include7ths ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#1A1A1A]">{include7ths ? 'Enabled' : 'Disabled'}</div>
                        <div className="text-sm text-[#9CA3AF]">
                          {include7ths
                            ? 'Chords displayed with 7ths (Maj7, m7, dom7, etc.)'
                            : 'Chords displayed as triads only'}
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full transition-colors ${include7ths ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${include7ths ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Timer */}
              <TimerSection />
            </>
          ) : isChordProgressionMode ? (
            <>
              {/* Scale Selection */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Scale Selection</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setScaleSelection('random')}
                    className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                      scaleSelection === 'random' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="font-bold text-[#1A1A1A]">Random Key</div>
                    <div className="text-sm text-[#9CA3AF]">New random key for each question</div>
                  </button>
                  <button
                    onClick={() => setScaleSelection('preselected')}
                    className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                      scaleSelection === 'preselected' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="font-bold text-[#1A1A1A]">Fixed Key</div>
                    <div className="text-sm text-[#9CA3AF]">Practice one specific key</div>
                  </button>
                </div>
                {scaleSelection === 'random' && (
                  <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
                    <h4 className="text-lg font-medium tracking-tight text-[#1A1A1A] mb-1">Scale types in pool</h4>
                    <p className="text-xs text-[#9CA3AF] mb-3">Functional harmony works in these scales — at least one must be selected</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ScaleCheckbox label="Major" checked={majorEnabled} onChange={toggleMajor} testId="scale-type-major" disabled={majorEnabled && progEnabledCount === 1} />
                      <ScaleCheckbox label="Natural Minor" checked={naturalMinorEnabled} onChange={toggleNaturalMinor} testId="scale-type-natural-minor" disabled={naturalMinorEnabled && progEnabledCount === 1} />
                      <ScaleCheckbox label="Harmonic Minor" checked={harmonicMinorEnabled} onChange={toggleHarmonicMinor} testId="scale-type-harmonic-minor" disabled={harmonicMinorEnabled && progEnabledCount === 1} />
                    </div>
                  </div>
                )}
                {scaleSelection === 'preselected' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Root Note</label>
                      <RootSelect value={selectedRoot} onChange={(e) => setSelectedRoot(e.target.value)} testId="root-selector" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Scale Type</label>
                      <select
                        value={selectedScaleType}
                        onChange={(e) => setSelectedScaleType(e.target.value)}
                        className="w-full p-3 border-2 border-[#E5E7EB] rounded-sm focus:border-[#002FA7] focus:outline-none text-lg"
                      >
                        <option value="major">{SCALE_TYPES.major.name}</option>
                        <option value="naturalMinor">{SCALE_TYPES.naturalMinor.name}</option>
                        <option value="harmonicMinor">{SCALE_TYPES.harmonicMinor.name}</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Chord Sources */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-1">Chord Sources</h3>
                <p className="text-xs text-[#9CA3AF] mb-2">Which progression types to practice</p>
                <div className="divide-y divide-[#E5E7EB]">
                  <SwitchRow
                    label="Diatonic Chords"
                    description="Standard progressions within the scale (e.g. IV\u2192V\u2192I)."
                    checked={includeRegular}
                    onChange={() => setIncludeRegular(!includeRegular)}
                    testId="regular-chords-toggle"
                  />
                  <SwitchRow
                    label="Secondary Dominants"
                    description="V/ii, V/iii, V/V, V/vi etc. — each resolves to its target only (e.g. A major \u2192 G in C major)."
                    checked={includeSecondaryDominants}
                    onChange={() => setIncludeSecondaryDominants(!includeSecondaryDominants)}
                    testId="secondary-dominants-toggle"
                  />
                  <SwitchRow
                    label="Parallel Minor (Borrowed)"
                    description="\u266Div, \u266DVII, \u266DVI, \u266DIII borrowed from the parallel minor. Major keys only."
                    checked={includeBorrowed}
                    onChange={() => setIncludeBorrowed(!includeBorrowed)}
                    testId="borrowed-chords-toggle"
                  />
                </div>
              </div>

              <TimerSection />
            </>
          ) : isChordFromNotesMode ? (
            <>
              {/* Scale Selection */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Scale Selection</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setScaleSelection('random')}
                    className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                      scaleSelection === 'random' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="font-bold text-[#1A1A1A]">Random Key</div>
                    <div className="text-sm text-[#9CA3AF]">New random key for each question</div>
                  </button>
                  <button
                    onClick={() => setScaleSelection('preselected')}
                    className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                      scaleSelection === 'preselected' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="font-bold text-[#1A1A1A]">Fixed Key</div>
                    <div className="text-sm text-[#9CA3AF]">Practice one specific key</div>
                  </button>
                </div>
                {scaleSelection === 'random' && (
                  <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
                    <h4 className="text-lg font-medium tracking-tight text-[#1A1A1A] mb-1">Scale types in pool</h4>
                    <p className="text-xs text-[#9CA3AF] mb-3">At least one must be selected</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ScaleCheckbox label="Major" checked={majorEnabled} onChange={toggleMajor} testId="scale-type-major" disabled={majorEnabled && enabledCount === 1} />
                      <ScaleCheckbox label="Natural Minor" checked={naturalMinorEnabled} onChange={toggleNaturalMinor} testId="scale-type-natural-minor" disabled={naturalMinorEnabled && enabledCount === 1} />
                      <ScaleCheckbox label="Harmonic Minor" checked={harmonicMinorEnabled} onChange={toggleHarmonicMinor} testId="scale-type-harmonic-minor" disabled={harmonicMinorEnabled && enabledCount === 1} />
                      <ScaleCheckbox label="Melodic Minor" checked={melodicMinorEnabled} onChange={toggleMelodicMinor} testId="scale-type-melodic-minor" disabled={melodicMinorEnabled && enabledCount === 1} />
                      <ScaleCheckbox
                        label="Other Modes"
                        subtitle="Dorian, Phrygian, Lydian, Mixolydian"
                        checked={otherModesEnabled}
                        onChange={toggleOtherModes}
                        testId="scale-type-other-modes"
                        disabled={otherModesEnabled && enabledCount === 1}
                      />
                    </div>
                  </div>
                )}
                {scaleSelection === 'preselected' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Root Note</label>
                      <RootSelect value={selectedRoot} onChange={(e) => setSelectedRoot(e.target.value)} testId="root-selector" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Scale Type</label>
                      <ScaleTypeSelect value={selectedScaleType} onChange={(e) => setSelectedScaleType(e.target.value)} testId="scale-type-selector" useAllScaleTypes />
                    </div>
                  </div>
                )}
              </div>

              {/* Chord Types */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-1">Chord Types</h3>
                <p className="text-xs text-[#9CA3AF] mb-3">Choose which chord categories to include — at least one must be selected</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ScaleCheckbox
                    label="Major & Minor"
                    subtitle="major, minor"
                    checked={enabledChordGroups.includes('basic')}
                    onChange={() => toggleChordGroup('basic')}
                    disabled={enabledChordGroups.includes('basic') && enabledChordGroups.length === 1}
                  />
                  <ScaleCheckbox
                    label="Diminished"
                    subtitle={"dim, \u00f87, \u00b07"}
                    checked={enabledChordGroups.includes('dim')}
                    onChange={() => toggleChordGroup('dim')}
                  />
                  <ScaleCheckbox
                    label="Augmented"
                    subtitle="aug"
                    checked={enabledChordGroups.includes('aug')}
                    onChange={() => toggleChordGroup('aug')}
                  />
                  <ScaleCheckbox
                    label="Suspended"
                    subtitle="sus2, sus4"
                    checked={enabledChordGroups.includes('sus')}
                    onChange={() => toggleChordGroup('sus')}
                  />
                  <ScaleCheckbox
                    label="7th Chords"
                    subtitle="Maj7, m7, dom7"
                    checked={enabledChordGroups.includes('7th')}
                    onChange={() => toggleChordGroup('7th')}
                  />
                  <ScaleCheckbox
                    label="Add / Extended (9th)"
                    subtitle="add9, m(add9), 9, Maj9, m9"
                    checked={enabledChordGroups.includes('ext')}
                    onChange={() => toggleChordGroup('ext')}
                  />
                  <ScaleCheckbox
                    label="11th Chords"
                    subtitle="m11, 11, Maj11"
                    checked={enabledChordGroups.includes('11th')}
                    onChange={() => toggleChordGroup('11th')}
                  />
                  <ScaleCheckbox
                    label="13th Chords"
                    subtitle="m13, 13, Maj13"
                    checked={enabledChordGroups.includes('13th')}
                    onChange={() => toggleChordGroup('13th')}
                  />
                </div>
              </div>

              {/* Display Options */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-1">Display Options</h3>
                <p className="text-xs text-[#9CA3AF] mb-2">How the chord notes are presented each question</p>
                <div className="divide-y divide-[#E5E7EB]">
                  <SwitchRow
                    label="Inversions"
                    description="Include 1st and 2nd inversions. The bass note changes but the answer is always root + quality."
                    checked={includeInversions}
                    onChange={() => setIncludeInversions(!includeInversions)}
                    testId="inversions-toggle"
                  />
                  <SwitchRow
                    label="Omit Notes"
                    description="Show only the minimum notes needed to identify the chord within the key. Some chords can't be reduced."
                    checked={omitNotes}
                    onChange={() => setOmitNotes(!omitNotes)}
                    testId="omit-notes-toggle"
                  />
                </div>
              </div>

              <TimerSection />
            </>
          ) : (
            <>
              {/* Scale Selection */}
              {mode === 'transposition' ? (
                <>
                  {/* Target Root Selection Mode */}
                  <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                    <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Root Selection Mode</h3>
                    <div className="space-y-3">
                      <button
                        data-testid="target-scale-random"
                        onClick={() => setTargetScaleSelection('random')}
                        className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                          targetScaleSelection === 'random' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                        }`}
                      >
                        <div className="font-bold text-[#1A1A1A]">Random Roots</div>
                        <div className="text-sm text-[#9CA3AF]">New random source and target roots for each question</div>
                      </button>
                      <button
                        data-testid="target-scale-preselected"
                        onClick={() => setTargetScaleSelection('preselected')}
                        className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                          targetScaleSelection === 'preselected' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                        }`}
                      >
                        <div className="font-bold text-[#1A1A1A]">Fixed Roots</div>
                        <div className="text-sm text-[#9CA3AF]">Select specific source and target root notes (cannot be the same)</div>
                      </button>
                    </div>
                    {targetScaleSelection === 'random' && (
                      <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
                        <h4 className="text-lg font-medium tracking-tight text-[#1A1A1A] mb-1">Scale types in pool</h4>
                        <p className="text-xs text-[#9CA3AF] mb-3">Random scale type each question — at least one must be selected</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <ScaleCheckbox label="Major" checked={majorEnabled} onChange={toggleMajor} testId="scale-type-major" disabled={majorEnabled && enabledCount === 1} />
                          <ScaleCheckbox label="Natural Minor" checked={naturalMinorEnabled} onChange={toggleNaturalMinor} testId="scale-type-natural-minor" disabled={naturalMinorEnabled && enabledCount === 1} />
                          <ScaleCheckbox label="Harmonic Minor" checked={harmonicMinorEnabled} onChange={toggleHarmonicMinor} testId="scale-type-harmonic-minor" disabled={harmonicMinorEnabled && enabledCount === 1} />
                          <ScaleCheckbox label="Melodic Minor" checked={melodicMinorEnabled} onChange={toggleMelodicMinor} testId="scale-type-melodic-minor" disabled={melodicMinorEnabled && enabledCount === 1} />
                          <ScaleCheckbox
                            label="Other Modes"
                            subtitle="Dorian, Phrygian, Lydian, Mixolydian"
                            checked={otherModesEnabled}
                            onChange={toggleOtherModes}
                            testId="scale-type-other-modes"
                            disabled={otherModesEnabled && enabledCount === 1}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Source and Target Root Selectors - only for preselected mode */}
                  {targetScaleSelection === 'preselected' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                          <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Source Root Note</h3>
                          <RootSelect value={sourceRoot} onChange={(e) => setSourceRoot(e.target.value)} testId="source-root-selector" />
                        </div>
                        <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                          <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Target Root Note</h3>
                          <RootSelect value={targetRoot} onChange={(e) => {
                            if (e.target.value !== sourceRoot) {
                              setTargetRoot(e.target.value);
                            }
                          }} testId="target-root-selector" />
                          {targetRoot === sourceRoot && <p className="text-xs text-red-500 mt-2">Target must be different from source</p>}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                  <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Scale Selection</h3>
                  <div className="space-y-3">
                    <button
                      data-testid="scale-random"
                      onClick={() => setScaleSelection('random')}
                      className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                        scaleSelection === 'random' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                      }`}
                    >
                      <div className="font-bold text-[#1A1A1A]">Random Scale</div>
                      <div className="text-sm text-[#9CA3AF]">A new random scale for each question</div>
                    </button>
                    <button
                      data-testid="scale-preselected"
                      onClick={() => setScaleSelection('preselected')}
                      className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                        scaleSelection === 'preselected' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                      }`}
                    >
                      <div className="font-bold text-[#1A1A1A]">Preselected Scale</div>
                      <div className="text-sm text-[#9CA3AF]">Practice one specific scale</div>
                    </button>
                  </div>
                  {scaleSelection === 'random' && (
                    <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
                      <h4 className="text-lg font-medium tracking-tight text-[#1A1A1A] mb-1">Scale types in pool</h4>
                      <p className="text-xs text-[#9CA3AF] mb-3">At least one must be selected</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ScaleCheckbox label="Major" checked={majorEnabled} onChange={toggleMajor} testId="scale-type-major" disabled={majorEnabled && enabledCount === 1} />
                        <ScaleCheckbox label="Natural Minor" checked={naturalMinorEnabled} onChange={toggleNaturalMinor} testId="scale-type-natural-minor" disabled={naturalMinorEnabled && enabledCount === 1} />
                        <ScaleCheckbox label="Harmonic Minor" checked={harmonicMinorEnabled} onChange={toggleHarmonicMinor} testId="scale-type-harmonic-minor" disabled={harmonicMinorEnabled && enabledCount === 1} />
                        <ScaleCheckbox label="Melodic Minor" checked={melodicMinorEnabled} onChange={toggleMelodicMinor} testId="scale-type-melodic-minor" disabled={melodicMinorEnabled && enabledCount === 1} />
                        <ScaleCheckbox
                          label="Other Modes"
                          subtitle="Dorian, Phrygian, Lydian, Mixolydian"
                          checked={otherModesEnabled}
                          onChange={toggleOtherModes}
                          testId="scale-type-other-modes"
                          disabled={otherModesEnabled && enabledCount === 1}
                        />
                      </div>
                    </div>
                  )}
                  {scaleSelection === 'preselected' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Root Note</label>
                        <RootSelect value={selectedRoot} onChange={(e) => setSelectedRoot(e.target.value)} testId="root-selector" />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Scale Type</label>
                        <ScaleTypeSelect
                          value={selectedScaleType}
                          onChange={(e) => setSelectedScaleType(e.target.value)}
                          testId="scale-type-selector"
                          useAllScaleTypes
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chord Types — unified compact panel */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-1">Chord Types</h3>
                <p className="text-xs text-[#9CA3AF] mb-2">Toggle which chord sources appear. Hover the info icon for details.</p>
                <div className="divide-y divide-[#E5E7EB]">
                  <SwitchRow
                    label="Regular Chords"
                    description="Standard diatonic chords from the scale. Turn this off to focus exclusively on the special chord types below."
                    checked={includeRegular}
                    onChange={() => setIncludeRegular(!includeRegular)}
                    testId="regular-chords-toggle"
                  />
                  <SwitchRow
                    label="Parallel Minor"
                    description={'Borrowed chords from the parallel minor (i, \u266DIII, iv, v, \u266DVI, \u266DVII). Only applies in a major scale.'}
                    checked={includeBorrowed}
                    onChange={() => setIncludeBorrowed(!includeBorrowed)}
                    testId="borrowed-chords-toggle"
                  />
                  <SwitchRow
                    label="Secondary Dominants"
                    description="Secondary dominant chords (V/ii, V/iii, V/V, etc.). Only applies for Major, Natural Minor, and Harmonic Minor scales."
                    checked={includeSecondaryDominants}
                    onChange={() => setIncludeSecondaryDominants(!includeSecondaryDominants)}
                    testId="secondary-dominants-toggle"
                  />
                  {isChordSourceMode && (
                    <SwitchRow
                      label="7ths"
                      description="Randomly turns the chords above into 7th chords (Maj7, m7, dom7, ø7, °7, aug7). Questions show (7). This is a modifier, not a standalone chord type."
                      checked={include7ths}
                      onChange={() => setInclude7ths(!include7ths)}
                      testId="7th-chords-toggle"
                    />
                  )}
                </div>
                {chordSourceError && (
                  <p data-testid="chord-source-error" className="text-xs text-[#FF3B30] font-bold mt-3">
                    None of the selected chord types apply to your chosen scale{chordSourcePoolSize > 1 ? ' pool' : ''}. Enable Regular Chords, or pick a chord type and scale that match.
                  </p>
                )}
              </div>

              {/* Timer */}
              <TimerSection />
            </>
          )}
        </div>

        <button
          data-testid="start-game-button"
          onClick={handleStartGame}
          disabled={chordSourceError}
          className={`w-full flex items-center justify-center gap-3 rounded-none bg-[#002FA7] text-white transition-all font-bold uppercase tracking-wider text-sm px-6 py-4 ${
            chordSourceError
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-[#002FA7]/90 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
          }`}
        >
          <Play className="w-5 h-5" />
          Start Game
        </button>
      </div>
    </div>
  );
};

export default Setup;
