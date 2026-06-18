import React, { useState } from 'react';
import { X, Info } from 'lucide-react';
import { SCALE_TYPES } from '../utils/chordLogic';

const OTHER_MODES = ['dorian', 'phrygian', 'lydian', 'mixolydian'];
const CHORD_SOURCE_MODES = ['number-to-chord', 'chord-to-number', 'transposition'];

const SwitchRow = ({ label, description, checked, onChange, testId }) => {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-1.5 min-w-0 mr-3">
        <span className="text-sm font-semibold text-[#1A1A1A]">{label}</span>
        {description && (
          <div className="relative shrink-0">
            <button
              type="button"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              onFocus={() => setShowTip(true)}
              onBlur={() => setShowTip(false)}
              className="text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
              aria-label={`Info about ${label}`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {showTip && (
              <div className="absolute left-5 top-0 z-20 w-56 bg-[#1A1A1A] text-white text-xs rounded-sm p-2 leading-relaxed shadow-lg">
                {description}
              </div>
            )}
          </div>
        )}
      </div>
      <button
        data-testid={testId}
        type="button"
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'}`}
        aria-pressed={checked}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange, mode, showScaleTypePool = true }) => {
  if (!isOpen) return null;

  const {
    enabledScaleTypes = ['major'],
    includeRegular = true,
    includeBorrowed = false,
    includeSecondaryDominants = false,
    include7ths = false,
    guessScaleSubmode = 'chords'
  } = settings;

  const isChordSourceMode = CHORD_SOURCE_MODES.includes(mode);

  const majorEnabled = enabledScaleTypes.includes('major');
  const naturalMinorEnabled = enabledScaleTypes.includes('naturalMinor');
  const harmonicMinorEnabled = enabledScaleTypes.includes('harmonicMinor');
  const melodicMinorEnabled = enabledScaleTypes.includes('melodicMinor');
  const otherModesEnabled = OTHER_MODES.some(m => enabledScaleTypes.includes(m));

  const enabledCount = [majorEnabled, naturalMinorEnabled, harmonicMinorEnabled, melodicMinorEnabled, otherModesEnabled].filter(Boolean).length;

  const toggleScaleTypes = (types, currentlyEnabled) => {
    if (currentlyEnabled && enabledCount === 1) return;
    let newTypes;
    if (currentlyEnabled) {
      newTypes = enabledScaleTypes.filter(t => !types.includes(t));
    } else {
      newTypes = [...enabledScaleTypes, ...types];
    }
    if (newTypes.length === 0) newTypes = ['major'];
    onSettingsChange({ enabledScaleTypes: newTypes });
  };

  const Checkbox = ({ label, checked, onChange, testId, subtitle, disabled }) => (
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
        <span className="font-bold text-[#1A1A1A] text-sm">{label}</span>
        {subtitle && <p className="text-xs text-[#9CA3AF] mt-0.5">{subtitle}</p>}
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-sm border-2 border-[#002FA7] w-full max-w-md mx-4 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-[#1A1A1A]">Settings</h3>
          <button
            data-testid="close-settings-modal"
            onClick={onClose}
            className="p-1 hover:bg-[#F3F4F6] rounded transition-colors"
          >
            <X className="w-6 h-6 text-[#9CA3AF]" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Scale Types */}
          {showScaleTypePool && (
            <div className="border border-[#E5E7EB] rounded-sm p-4">
              <h4 className="font-bold text-[#1A1A1A] mb-3">Scale Types</h4>
              <p className="text-xs text-[#9CA3AF] mb-3">At least one must be selected</p>
              <div className="space-y-2">
                <Checkbox
                  label="Major"
                  checked={majorEnabled}
                  onChange={() => toggleScaleTypes(['major'], majorEnabled)}
                  testId="settings-scale-major"
                  disabled={majorEnabled && enabledCount === 1}
                />
                <Checkbox
                  label="Natural Minor"
                  checked={naturalMinorEnabled}
                  onChange={() => toggleScaleTypes(['naturalMinor'], naturalMinorEnabled)}
                  testId="settings-scale-natural-minor"
                  disabled={naturalMinorEnabled && enabledCount === 1}
                />
                <Checkbox
                  label="Harmonic Minor"
                  checked={harmonicMinorEnabled}
                  onChange={() => toggleScaleTypes(['harmonicMinor'], harmonicMinorEnabled)}
                  testId="settings-scale-harmonic-minor"
                  disabled={harmonicMinorEnabled && enabledCount === 1}
                />
                <Checkbox
                  label="Melodic Minor"
                  checked={melodicMinorEnabled}
                  onChange={() => toggleScaleTypes(['melodicMinor'], melodicMinorEnabled)}
                  testId="settings-scale-melodic-minor"
                  disabled={melodicMinorEnabled && enabledCount === 1}
                />
                <Checkbox
                  label="Other Modes"
                  subtitle="Dorian, Phrygian, Lydian, Mixolydian"
                  checked={otherModesEnabled}
                  onChange={() => toggleScaleTypes(OTHER_MODES, otherModesEnabled)}
                  testId="settings-scale-other-modes"
                  disabled={otherModesEnabled && enabledCount === 1}
                />
              </div>
            </div>
          )}

          {/* Unified Chord Types panel — for chord-source modes */}
          {isChordSourceMode && (
            <div className="border border-[#E5E7EB] rounded-sm p-4">
              <h4 className="font-bold text-[#1A1A1A] mb-0.5">Chord Types</h4>
              <p className="text-xs text-[#9CA3AF] mb-1">Hover the info icon for details.</p>
              <div className="divide-y divide-[#E5E7EB]">
                <SwitchRow
                  label="Regular Chords"
                  description="Standard diatonic chords from the scale. Turn this off to focus exclusively on the special chord types below."
                  checked={includeRegular}
                  onChange={() => onSettingsChange({ includeRegular: !includeRegular })}
                  testId="settings-regular-chords-toggle"
                />
                <SwitchRow
                  label="Parallel Minor"
                  description={'Borrowed chords from the parallel minor (i, \u266DIII, iv, v, \u266DVI, \u266DVII). Only applies in a major scale.'}
                  checked={includeBorrowed}
                  onChange={() => onSettingsChange({ includeBorrowed: !includeBorrowed })}
                  testId="settings-borrowed-toggle"
                />
                <SwitchRow
                  label="Secondary Dominants"
                  description="Secondary dominant chords (V/ii, V/iii, V/V, etc.). Only applies for Major, Natural Minor, and Harmonic Minor scales."
                  checked={includeSecondaryDominants}
                  onChange={() => onSettingsChange({ includeSecondaryDominants: !includeSecondaryDominants })}
                  testId="settings-secondary-dominants-toggle"
                />
                <SwitchRow
                  label="7ths"
                  description="Randomly turns the chords above into 7th chords (Maj7, m7, dom7, ø7, °7, aug7). Questions show (7). This is a modifier, not a standalone chord type."
                  checked={include7ths}
                  onChange={() => onSettingsChange({ include7ths: !include7ths })}
                  testId="settings-7th-toggle"
                />
              </div>
            </div>
          )}

          {/* Clue Type toggle — only for guess-scale mode */}
          {mode === 'guess-scale' && (
            <div className="border border-[#E5E7EB] rounded-sm p-4">
              <h4 className="font-bold text-[#1A1A1A] mb-1">Clue Type</h4>
              <p className="text-xs text-[#9CA3AF] mb-3">What you see as the clue each round</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  data-testid="settings-clue-chords"
                  onClick={() => onSettingsChange({ guessScaleSubmode: 'chords' })}
                  className={`p-3 border-2 rounded-sm text-left transition-all ${
                    guessScaleSubmode !== 'notes'
                      ? 'border-[#002FA7] bg-[#002FA7]/5'
                      : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                  }`}
                >
                  <div className="font-bold text-sm text-[#1A1A1A]">Chords</div>
                  <div className="text-xs text-[#9CA3AF]">Diatonic chord names</div>
                </button>
                <button
                  data-testid="settings-clue-notes"
                  onClick={() => onSettingsChange({ guessScaleSubmode: 'notes' })}
                  className={`p-3 border-2 rounded-sm text-left transition-all ${
                    guessScaleSubmode === 'notes'
                      ? 'border-[#002FA7] bg-[#002FA7]/5'
                      : 'border-[#E5E7EB] hover:border-[#002FA7]/50'
                  }`}
                >
                  <div className="font-bold text-sm text-[#1A1A1A]">Notes</div>
                  <div className="text-xs text-[#9CA3AF]">Individual scale notes</div>
                </button>
              </div>
            </div>
          )}

          {/* 7th Chords — guess-scale mode only */}
          {mode === 'guess-scale' && guessScaleSubmode !== 'notes' && (
            <div className="border border-[#E5E7EB] rounded-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#1A1A1A]">Display 7th Chords</h4>
                  <p className="text-xs text-[#9CA3AF] mt-1">
                    {include7ths ? 'Chords displayed with 7ths' : 'Chords displayed as triads'}
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">New question generated on change</p>
                </div>
                <button
                  data-testid="settings-7th-toggle"
                  onClick={() => onSettingsChange({ include7ths: !include7ths })}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                    include7ths ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    include7ths ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          data-testid="settings-done-button"
          onClick={onClose}
          className="w-full mt-6 bg-[#002FA7] text-white hover:bg-[#002FA7]/90 rounded-sm py-3 font-bold uppercase tracking-wider text-sm transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
