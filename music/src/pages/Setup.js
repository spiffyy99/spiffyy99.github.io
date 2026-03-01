import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { ALL_NOTES, SCALE_TYPES } from '../utils/chordLogic';
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
  const [otherModesEnabled, setOtherModesEnabled] = useState(false);

  // Scale selection
  const [scaleSelection, setScaleSelection] = useState('random');
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedScaleType, setSelectedScaleType] = useState('major');

  // Transposition
  const [sourceRoot, setSourceRoot] = useState('C');
  const [sourceScaleType, setSourceScaleType] = useState('major');
  const [targetScaleSelection, setTargetScaleSelection] = useState('preselected');
  const [targetRoot, setTargetRoot] = useState('D');
  const [targetScaleType, setTargetScaleType] = useState('major');

  // Options
  const [includeBorrowed, setIncludeBorrowed] = useState(false);
  const [include7ths, setInclude7ths] = useState(false);
  const [timerMode, setTimerMode] = useState('untimed');
  const [timerDuration, setTimerDuration] = useState('60');

  const getEnabledScaleTypes = () => {
    const types = [];
    if (majorEnabled) types.push('major');
    if (naturalMinorEnabled) types.push('naturalMinor');
    if (harmonicMinorEnabled) types.push('harmonicMinor');
    if (otherModesEnabled) types.push(...OTHER_MODES);
    return types.length > 0 ? types : ['major'];
  };

  const availableScaleTypes = getEnabledScaleTypes();

  const ensureValidScaleType = (current) =>
    availableScaleTypes.includes(current) ? current : availableScaleTypes[0];

  const handleStartGame = () => {
    const enabledScaleTypes = getEnabledScaleTypes();
    const gameConfig = {
      mode,
      enabledScaleTypes,
      includeBorrowed,
      include7ths,
      timerMode,
      timerDuration: timerMode === 'timed' ? parseInt(timerDuration) : null,
    };

    if (mode === 'transposition') {
      gameConfig.sourceRoot = sourceRoot;
      gameConfig.sourceScaleType = ensureValidScaleType(sourceScaleType);
      gameConfig.targetScaleSelection = targetScaleSelection;
      gameConfig.targetRoot = targetRoot;
      gameConfig.targetScaleType = ensureValidScaleType(targetScaleType);
    } else if (mode !== 'intervals' && mode !== 'interval-transpose') {
      gameConfig.scaleSelection = scaleSelection;
      gameConfig.selectedRoot = scaleSelection === 'random' ? null : selectedRoot;
      gameConfig.selectedScaleType = scaleSelection === 'random' ? null : ensureValidScaleType(selectedScaleType);
    }

    navigate('/game', { state: gameConfig });
  };

  const getModeTitle = () => {
    if (mode === 'number-to-chord') return 'Number \u2192 Chord';
    if (mode === 'chord-to-number') return 'Chord \u2192 Number';
    if (mode === 'transposition') return 'Transposition';
    if (mode === 'intervals') return 'Interval Recognition';
    return 'Interval Transposition';
  };

  const isNonIntervalMode = mode !== 'intervals' && mode !== 'interval-transpose';

  const ScaleCheckbox = ({ label, checked, onChange, testId, subtitle }) => (
    <button
      data-testid={testId}
      onClick={onChange}
      className={`flex items-center gap-3 p-3 border-2 rounded-sm transition-all w-full text-left ${
        checked ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
      }`}
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

  const ScaleTypeSelect = ({ value, onChange, testId }) => (
    <select
      data-testid={testId}
      value={ensureValidScaleType(value)}
      onChange={onChange}
      className="w-full p-3 border-2 border-[#E5E7EB] rounded-sm focus:border-[#002FA7] focus:outline-none text-lg"
    >
      {availableScaleTypes.map(id => (
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
            <TimerSection />
          ) : (
            <>
              {/* Scale Types */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Scale Types</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ScaleCheckbox label="Major" checked={majorEnabled} onChange={() => setMajorEnabled(!majorEnabled)} testId="scale-type-major" />
                  <ScaleCheckbox label="Natural Minor" checked={naturalMinorEnabled} onChange={() => setNaturalMinorEnabled(!naturalMinorEnabled)} testId="scale-type-natural-minor" />
                  <ScaleCheckbox label="Harmonic Minor" checked={harmonicMinorEnabled} onChange={() => setHarmonicMinorEnabled(!harmonicMinorEnabled)} testId="scale-type-harmonic-minor" />
                  <ScaleCheckbox
                    label="Other Modes"
                    subtitle="Dorian, Phrygian, Lydian, Mixolydian"
                    checked={otherModesEnabled}
                    onChange={() => setOtherModesEnabled(!otherModesEnabled)}
                    testId="scale-type-other-modes"
                  />
                </div>
              </div>

              {/* Scale Selection */}
              {mode === 'transposition' ? (
                <>
                  {/* Single Scale Type for both source and target */}
                  <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                    <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Scale Type</h3>
                    <p className="text-sm text-[#9CA3AF] mb-4">Applies to both source and target scales</p>
                    <ScaleTypeSelect value={sourceScaleType} onChange={(e) => setSourceScaleType(e.target.value)} testId="source-scale-type-selector" />
                  </div>

                  {/* Source Root Note */}
                  <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                    <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Source Root Note</h3>
                    <RootSelect value={sourceRoot} onChange={(e) => setSourceRoot(e.target.value)} testId="source-root-selector" />
                  </div>

                  {/* Target Root Note */}
                  <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                    <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Target Root Note</h3>
                    <div className="space-y-3 mb-4">
                      <button
                        data-testid="target-scale-random"
                        onClick={() => setTargetScaleSelection('random')}
                        className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                          targetScaleSelection === 'random' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                        }`}
                      >
                        <div className="font-bold text-[#1A1A1A]">Random Target Root</div>
                        <div className="text-sm text-[#9CA3AF]">A new random target root for each question</div>
                      </button>
                      <button
                        data-testid="target-scale-preselected"
                        onClick={() => setTargetScaleSelection('preselected')}
                        className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                          targetScaleSelection === 'preselected' ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                        }`}
                      >
                        <div className="font-bold text-[#1A1A1A]">Fixed Target Root</div>
                        <div className="text-sm text-[#9CA3AF]">Keep the same target root note</div>
                      </button>
                    </div>
                    {targetScaleSelection === 'preselected' && (
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Root Note</label>
                        <RootSelect value={targetRoot} onChange={(e) => setTargetRoot(e.target.value)} testId="target-root-selector" />
                      </div>
                    )}
                  </div>
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
                  {scaleSelection === 'preselected' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Root Note</label>
                        <RootSelect value={selectedRoot} onChange={(e) => setSelectedRoot(e.target.value)} testId="root-selector" />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Scale Type</label>
                        <ScaleTypeSelect value={selectedScaleType} onChange={(e) => setSelectedScaleType(e.target.value)} testId="scale-type-selector" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Borrowed Chords */}
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">Borrowed Chords</h3>
                <button
                  data-testid="borrowed-chords-toggle"
                  onClick={() => setIncludeBorrowed(!includeBorrowed)}
                  className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                    includeBorrowed ? 'border-[#002FA7] bg-[#002FA7]/5' : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#1A1A1A]">{includeBorrowed ? 'Enabled' : 'Disabled'}</div>
                      <div className="text-sm text-[#9CA3AF]">
                        {includeBorrowed
                          ? 'Includes chords from parallel minor (i, \u266DIII, iv, v, \u266DVI, \u266DVII)'
                          : 'Only diatonic scale chords'}
                      </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors ${includeBorrowed ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${includeBorrowed ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                </button>
                <p className="text-xs text-[#9CA3AF] mt-2">Only applies when playing in a major scale</p>
              </div>

              {/* Timer */}
              <TimerSection />
            </>
          )}
        </div>

        <button
          data-testid="start-game-button"
          onClick={handleStartGame}
          className="w-full flex items-center justify-center gap-3 rounded-none bg-[#002FA7] text-white hover:bg-[#002FA7]/90 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-bold uppercase tracking-wider text-sm px-6 py-4"
        >
          <Play className="w-5 h-5" />
          Start Game
        </button>
      </div>
    </div>
  );
};

export default Setup;
