import React from 'react';
import { X } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-sm border-2 border-[#002FA7] w-full max-w-md mx-4 p-6 shadow-lg">
        {/* Header */}
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

        {/* Settings Options */}
        <div className="space-y-4">
          {/* Parallel Minor Chords Toggle */}
          <div className="border border-[#E5E7EB] rounded-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-bold text-[#1A1A1A]">Parallel Minor Chords</h4>
                <p className="text-sm text-[#9CA3AF] mt-1">
                  {settings.includeParallelMinor 
                    ? 'Using 12 roman numerals (I-vi, i-♭VII)'
                    : 'Using 6 diatonic roman numerals (I-vi)'}
                </p>
              </div>
              <button
                data-testid="parallel-minor-toggle"
                onClick={() => onSettingsChange({ includeParallelMinor: !settings.includeParallelMinor })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.includeParallelMinor ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  settings.includeParallelMinor ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Future settings can be added here */}
        </div>

        {/* Close Button */}
        <button
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
