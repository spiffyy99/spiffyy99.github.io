import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, RotateCcw, TrendingUp } from 'lucide-react';

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const results = location.state || {};

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 90) return 'text-[#059669]';
    if (accuracy >= 70) return 'text-[#002FA7]';
    if (accuracy >= 50) return 'text-[#FF3B30]';
    return 'text-[#9CA3AF]';
  };

  const getAccuracyMessage = (accuracy) => {
    if (accuracy >= 90) return 'Outstanding!';
    if (accuracy >= 70) return 'Great job!';
    if (accuracy >= 50) return 'Good effort!';
    return 'Keep practicing!';
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Results Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-sm p-8 md:p-12 shadow-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1A1A1A] mb-2">
              Game Complete!
            </h2>
            <p className="text-[#9CA3AF]">{getAccuracyMessage(results.accuracy)}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="text-center p-6 bg-[#F3F4F6] rounded-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
                Score
              </p>
              <p className="text-4xl font-bold text-[#1A1A1A]" data-testid="final-score">
                {results.score}
              </p>
            </div>

            <div className="text-center p-6 bg-[#F3F4F6] rounded-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
                Questions
              </p>
              <p className="text-4xl font-bold text-[#1A1A1A]" data-testid="total-questions">
                {results.totalQuestions}
              </p>
            </div>
          </div>

          {/* Accuracy Display */}
          <div className="text-center mb-8 p-8 border-4 border-[#E5E7EB] rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-3">
              Accuracy
            </p>
            <p className={`text-6xl md:text-8xl font-bold ${getAccuracyColor(results.accuracy)}`} data-testid="accuracy-percentage">
              {results.accuracy}%
            </p>
          </div>

          {/* Game Details */}
          <div className="space-y-2 mb-8 p-6 bg-[#F3F4F6] rounded-sm">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Key:</span>
              <span className="font-bold text-[#1A1A1A]">{results.key}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Mode:</span>
              <span className="font-bold text-[#1A1A1A]">
                {results.mode === 'number-to-chord' ? 'Number → Chord' : 'Chord → Number'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Timer:</span>
              <span className="font-bold text-[#1A1A1A]">
                {results.timerMode === 'untimed' ? 'Untimed' : `${results.timerMode}s`}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              data-testid="play-again-button"
              onClick={() => navigate('/setup', { state: { mode: results.mode } })}
              className="flex items-center justify-center gap-2 rounded-none bg-[#002FA7] text-white hover:bg-[#002FA7]/90 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-bold uppercase tracking-wider text-sm px-6 py-3"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>

            <button
              data-testid="dashboard-button"
              onClick={() => navigate('/dashboard')}
              className="flex items-center justify-center gap-2 rounded-none border-2 border-[#002FA7] bg-transparent text-[#002FA7] hover:bg-[#002FA7] hover:text-white transition-all duration-200 font-bold uppercase tracking-wider text-sm px-6 py-3"
            >
              <TrendingUp className="w-4 h-4" />
              Dashboard
            </button>

            <button
              data-testid="home-button"
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-2 rounded-none border-2 border-[#E5E7EB] bg-transparent text-[#1A1A1A] hover:border-[#1A1A1A] transition-all duration-200 font-bold uppercase tracking-wider text-sm px-6 py-3"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
