import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const Home = () => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);

  const modes = [
    {
      id: 'number-to-chord',
      title: 'Number \u2192 Chord',
      description: 'See a roman numeral, select the correct root note and chord type',
      icon: Music
    },
    {
      id: 'chord-to-number',
      title: 'Chord \u2192 Number',
      description: 'See a chord, select the correct degree and quality',
      icon: Music
    },
    {
      id: 'transposition',
      title: 'Transposition',
      description: 'Transpose chords between different scales and modes',
      icon: Music
    },
    {
      id: 'intervals',
      title: 'Interval Recognition',
      description: 'Identify the interval between two notes',
      icon: Music
    },
    {
      id: 'interval-transpose',
      title: 'Interval Transposition',
      description: 'Find the note given start note, interval, and direction',
      icon: Music
    },
    {
      id: 'guess-scale',
      title: 'Guess the Scale',
      description: 'See diatonic chords and identify which scale they belong to',
      icon: Music
    }
  ];

  const handleModeSelect = (modeId) => {
    setSelectedMode(modeId);
    navigate('/setup', { state: { mode: modeId } });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
        {/* Theme Toggle */}
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>

        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-[#1A1A1A] mb-4">
            Scale Genius
          </h1>
          <p className="text-base md:text-lg text-[#9CA3AF] max-w-2xl mx-auto">
            Master chord progressions across all scales and modes. Choose your mode and start practicing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mb-12">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                data-testid={`mode-${mode.id}`}
                onClick={() => handleModeSelect(mode.id)}
                className="bg-white border border-[#E5E7EB] rounded-sm p-8 hover:border-[#002FA7] hover:shadow-md transition-all duration-200 text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#F3F4F6] group-hover:bg-[#002FA7] transition-colors rounded-sm">
                    <Icon className="w-6 h-6 text-[#002FA7] group-hover:text-white transition-colors" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-medium tracking-tight text-[#1A1A1A] mb-2">
                      {mode.title}
                    </h3>
                    <p className="text-[#9CA3AF]">
                      {mode.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;
