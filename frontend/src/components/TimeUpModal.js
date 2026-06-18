import React from 'react';
import { RotateCcw, Home } from 'lucide-react';

const TimeUpModal = ({ isOpen, score, accuracy, totalQuestions, onPlayAgain, onGoHome }) => {
  if (!isOpen) return null;

  const getAccuracyColor = (acc) => {
    if (acc >= 90) return 'text-[#059669]';
    if (acc >= 70) return 'text-[#002FA7]';
    if (acc >= 50) return 'text-[#FF3B30]';
    return 'text-[#9CA3AF]';
  };

  const getMessage = (acc) => {
    if (acc >= 90) return 'Outstanding!';
    if (acc >= 70) return 'Great job!';
    if (acc >= 50) return 'Good effort!';
    return 'Keep practicing!';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-sm border-2 border-[#002FA7] w-full max-w-lg mx-4 p-8 shadow-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-4xl font-bold text-[#1A1A1A] mb-2">Time's Up!</h2>
          <p className="text-[#9CA3AF]">{getMessage(accuracy)}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 bg-[#F3F4F6] rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
              Score
            </p>
            <p className="text-3xl font-bold text-[#1A1A1A]" data-testid="timeup-score">
              {score}
            </p>
          </div>
          <div className="text-center p-4 bg-[#F3F4F6] rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
              Questions
            </p>
            <p className="text-3xl font-bold text-[#1A1A1A]">
              {totalQuestions}
            </p>
          </div>
        </div>

        {/* Accuracy */}
        <div className="text-center mb-6 p-6 border-2 border-[#E5E7EB] rounded-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
            Accuracy
          </p>
          <p className={`text-6xl font-bold ${getAccuracyColor(accuracy)}`} data-testid="timeup-accuracy">
            {accuracy}%
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            data-testid="play-again-timeup"
            onClick={onPlayAgain}
            className="flex items-center justify-center gap-2 rounded-none bg-[#002FA7] text-white hover:bg-[#002FA7]/90 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-bold uppercase tracking-wider text-sm px-4 py-3"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>
          <button
            data-testid="home-timeup"
            onClick={onGoHome}
            className="flex items-center justify-center gap-2 rounded-none border-2 border-[#E5E7EB] bg-transparent text-[#1A1A1A] hover:border-[#1A1A1A] transition-all duration-200 font-bold uppercase tracking-wider text-sm px-4 py-3"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeUpModal;
