import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { MAJOR_KEYS } from '../utils/chordLogic';

const Setup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.state?.mode || 'number-to-chord';

  const [keySelection, setKeySelection] = useState('random');
  const [selectedKey, setSelectedKey] = useState('C');
  const [sourceKey, setSourceKey] = useState('C');
  const [targetKey, setTargetKey] = useState('D');
  const [targetKeySelection, setTargetKeySelection] = useState('preselected');
  const [timerMode, setTimerMode] = useState('untimed');
  const [timerDuration, setTimerDuration] = useState('60');
  const [includeBorrowed, setIncludeBorrowed] = useState(false);

  const allKeys = Object.keys(MAJOR_KEYS);

  const handleStartGame = () => {
    const gameConfig = {
      mode,
      keySelection,
      selectedKey: keySelection === 'random' ? null : selectedKey,
      sourceKey: mode === 'transposition' ? sourceKey : null,
      targetKey: mode === 'transposition' ? (targetKeySelection === 'random' ? null : targetKey) : null,
      targetKeySelection: mode === 'transposition' ? targetKeySelection : null,
      timerMode,
      timerDuration: timerMode === 'timed' ? parseInt(timerDuration) : null,
      includeBorrowed
    };
    navigate('/game', { state: gameConfig });
  };

  const getModeTitle = () => {
    if (mode === 'number-to-chord') return 'Number → Chord';
    if (mode === 'chord-to-number') return 'Chord → Number';
    if (mode === 'transposition') return 'Transposition';
    if (mode === 'intervals') return 'Interval Recognition';
    return 'Interval Transposition';
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
        {/* Back Button */}
        <button
          data-testid="back-button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[#9CA3AF] hover:text-[#002FA7] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>

        {/* Header */}
        <div className="mb-12">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1A1A1A] mb-2">
            Game Setup
          </h2>
          <p className="text-[#9CA3AF]">
            Mode: {getModeTitle()}
          </p>
        </div>

        {/* Settings Cards */}
        <div className="space-y-6 mb-12">
          {/* Interval Mode - Only Timer */}
          {mode === 'intervals' ? (
            /* Timer Mode for Intervals */
            <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
              <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">
                Timer Mode
              </h3>
              <div className="space-y-3">
                <button
                  data-testid="timer-untimed"
                  onClick={() => setTimerMode('untimed')}
                  className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                    timerMode === 'untimed'
                      ? 'border-[#002FA7] bg-[#002FA7]/5'
                      : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                  }`}
                >
                  <div className="font-bold text-[#1A1A1A]">Untimed</div>
                  <div className="text-sm text-[#9CA3AF]">Practice at your own pace</div>
                </button>
                <button
                  data-testid="timer-timed"
                  onClick={() => setTimerMode('timed')}
                  className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                    timerMode === 'timed'
                      ? 'border-[#002FA7] bg-[#002FA7]/5'
                      : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                  }`}
                >
                  <div className="font-bold text-[#1A1A1A]">Timed</div>
                  <div className="text-sm text-[#9CA3AF]">Race against the clock</div>
                </button>
              </div>

              {timerMode === 'timed' && (
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">
                    Duration
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['15', '30', '60'].map((duration) => (
                      <button
                        key={duration}
                        data-testid={`timer-${duration}`}
                        onClick={() => setTimerDuration(duration)}
                        className={`p-3 border-2 rounded-sm font-bold transition-all ${
                          timerDuration === duration
                            ? 'border-[#002FA7] bg-[#002FA7] text-white'
                            : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                        }`}
                      >
                        {duration}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : mode === 'transposition' ? (
            <>
              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">
                  Source Key
                </h3>
                <select
                  data-testid="source-key-selector"
                  value={sourceKey}
                  onChange={(e) => setSourceKey(e.target.value)}
                  className="w-full p-3 border-2 border-[#E5E7EB] rounded-sm focus:border-[#002FA7] focus:outline-none text-lg"
                >
                  {allKeys.map((key) => (
                    <option key={key} value={key}>
                      {key} Major
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
                <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">
                  Target Key
                </h3>
                <div className="space-y-3 mb-4">
                  <button
                    data-testid="target-key-random"
                    onClick={() => setTargetKeySelection('random')}
                    className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                      targetKeySelection === 'random'
                        ? 'border-[#002FA7] bg-[#002FA7]/5'
                        : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="font-bold text-[#1A1A1A]">Random Target Key</div>
                    <div className="text-sm text-[#9CA3AF]">A new random target for each question</div>
                  </button>
                  <button
                    data-testid="target-key-preselected"
                    onClick={() => setTargetKeySelection('preselected')}
                    className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                      targetKeySelection === 'preselected'
                        ? 'border-[#002FA7] bg-[#002FA7]/5'
                        : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                    }`}
                  >
                    <div className="font-bold text-[#1A1A1A]">Fixed Target Key</div>
                    <div className="text-sm text-[#9CA3AF]">Keep the same target key</div>
                  </button>
                </div>

                {targetKeySelection === 'preselected' && (
                  <select
                    data-testid="target-key-selector"
                    value={targetKey}
                    onChange={(e) => setTargetKey(e.target.value)}
                    className="w-full p-3 border-2 border-[#E5E7EB] rounded-sm focus:border-[#002FA7] focus:outline-none text-lg"
                  >
                    {allKeys.map((key) => (
                      <option key={key} value={key}>
                        {key} Major
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          ) : (
            /* Regular Mode Key Selection */
            <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
              <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">
                Key Selection
              </h3>
              <div className="space-y-3">
                <button
                  data-testid="key-random"
                  onClick={() => setKeySelection('random')}
                  className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                    keySelection === 'random'
                      ? 'border-[#002FA7] bg-[#002FA7]/5'
                      : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                  }`}
                >
                  <div className="font-bold text-[#1A1A1A]">Random Key</div>
                  <div className="text-sm text-[#9CA3AF]">A new random key for each question</div>
                </button>
                <button
                  data-testid="key-preselected"
                  onClick={() => setKeySelection('preselected')}
                  className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                    keySelection === 'preselected'
                      ? 'border-[#002FA7] bg-[#002FA7]/5'
                      : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                  }`}
                >
                  <div className="font-bold text-[#1A1A1A]">Preselected Key</div>
                  <div className="text-sm text-[#9CA3AF]">Practice one specific key</div>
                </button>
              </div>

              {keySelection === 'preselected' && (
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">
                    Select Key
                  </label>
                  <select
                    data-testid="key-selector"
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    className="w-full p-3 border-2 border-[#E5E7EB] rounded-sm focus:border-[#002FA7] focus:outline-none text-lg"
                  >
                    {allKeys.map((key) => (
                      <option key={key} value={key}>
                        {key} Major
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Parallel Minor Chords Option - Not for Intervals mode */}
          {mode !== 'intervals' && (
            <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
              <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">
                Parallel Minor Chords
              </h3>
              <button
                data-testid="parallel-minor-toggle"
                onClick={() => setIncludeBorrowed(!includeBorrowed)}
                className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                  includeBorrowed
                    ? 'border-[#002FA7] bg-[#002FA7]/5'
                    : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#1A1A1A]">
                      {includeBorrowed ? 'Enabled' : 'Disabled'}
                    </div>
                    <div className="text-sm text-[#9CA3AF]">
                      {includeBorrowed 
                        ? 'Includes chords from parallel minor (i-♭VII)'
                      : 'Only diatonic major scale chords (I-vi)'}
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors ${
                  includeBorrowed ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${
                    includeBorrowed ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </div>
              </div>
            </button>
          </div>
          )}

          {/* Timer Mode - Not shown for Intervals (already shown above) */}
          {mode !== 'intervals' && (
            <div className="bg-white border border-[#E5E7EB] rounded-sm p-6">
              <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-4">
                Timer Mode
              </h3>
            <div className="space-y-3">
              <button
                data-testid="timer-untimed"
                onClick={() => setTimerMode('untimed')}
                className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                  timerMode === 'untimed'
                    ? 'border-[#002FA7] bg-[#002FA7]/5'
                    : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                }`}
              >
                <div className="font-bold text-[#1A1A1A]">Untimed</div>
                <div className="text-sm text-[#9CA3AF]">Practice at your own pace</div>
              </button>
              <button
                data-testid="timer-timed"
                onClick={() => setTimerMode('timed')}
                className={`w-full text-left p-4 border-2 rounded-sm transition-all ${
                  timerMode === 'timed'
                    ? 'border-[#002FA7] bg-[#002FA7]/5'
                    : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                }`}
              >
                <div className="font-bold text-[#1A1A1A]">Timed</div>
                <div className="text-sm text-[#9CA3AF]">Race against the clock</div>
              </button>
            </div>

            {timerMode === 'timed' && (
              <div className="mt-4">
                <label className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">
                  Duration
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['15', '30', '60'].map((duration) => (
                    <button
                      key={duration}
                      data-testid={`timer-${duration}`}
                      onClick={() => setTimerDuration(duration)}
                      className={`p-3 border-2 rounded-sm font-bold transition-all ${
                        timerDuration === duration
                          ? 'border-[#002FA7] bg-[#002FA7] text-white'
                          : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                      }`}
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Start Button */}
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
