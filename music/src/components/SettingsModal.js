import React from 'react';
import { X } from 'lucide-react';
import { SCALE_TYPES } from '../utils/chordLogic';

const OTHER_MODES = ['dorian', 'phrygian', 'lydian', 'mixolydian'];

const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange, mode }) => {
  if (!isOpen) return null;

  const { enabledScaleTypes = ['major'], includeBorrowed = false } = settings;

  const majorEnabled = enabledScaleTypes.includes('major');
  const naturalMinorEnabled = enabledScaleTypes.includes('naturalMinor');
  const harmonicMinorEnabled = enabledScaleTypes.includes('harmonicMinor');
  const otherModesEnabled = OTHER_MODES.some(m => enabledScaleTypes.includes(m));

  const toggleScaleTypes = (types, currentlyEnabled) => {
    let newTypes;
    if (currentlyEnabled) {
      newTypes = enabledScaleTypes.filter(t => !types.includes(t));
    } else {
      newTypes = [...enabledScaleTypes, ...types];
    }
    if (newTypes.length === 0) newTypes = ['major'];
    onSettingsChange({ enabledScaleTypes: newTypes });
  };

  const Checkbox = ({ label, checked, onChange, testId, subtitle }) => (
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
          <div className="border border-[#E5E7EB] rounded-sm p-4">
            <h4 className="font-bold text-[#1A1A1A] mb-3">Scale Types</h4>
            <p className="text-xs text-[#9CA3AF] mb-3">Changes apply on the next question</p>
            <div className="space-y-2">
              <Checkbox
                label="Major"
                checked={majorEnabled}
                onChange={() => toggleScaleTypes(['major'], majorEnabled)}
                testId="settings-scale-major"
              />
              <Checkbox
                label="Natural Minor"
                checked={naturalMinorEnabled}
                onChange={() => toggleScaleTypes(['naturalMinor'], naturalMinorEnabled)}
                testId="settings-scale-natural-minor"
              />
              <Checkbox
                label="Harmonic Minor"
                checked={harmonicMinorEnabled}
                onChange={() => toggleScaleTypes(['harmonicMinor'], harmonicMinorEnabled)}
                testId="settings-scale-harmonic-minor"
              />
              <Checkbox
                label="Other Modes"
                subtitle="Dorian, Phrygian, Lydian, Mixolydian"
                checked={otherModesEnabled}
                onChange={() => toggleScaleTypes(OTHER_MODES, otherModesEnabled)}
                testId="settings-scale-other-modes"
              />
            </div>
          </div>

          {/* Borrowed Chords */}
          <div className="border border-[#E5E7EB] rounded-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[#1A1A1A]">Borrowed Chords</h4>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {includeBorrowed
                    ? 'Includes chords from parallel minor'
                    : 'Only diatonic scale chords'}
                </p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Only applies in major scale context</p>
              </div>
              <button
                data-testid="settings-borrowed-toggle"
                onClick={() => onSettingsChange({ includeBorrowed: !includeBorrowed })}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                  includeBorrowed ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  includeBorrowed ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
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
