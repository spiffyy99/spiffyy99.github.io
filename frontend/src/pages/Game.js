import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Timer as TimerIcon, Trophy, Settings as SettingsIcon } from 'lucide-react';
import axios from 'axios';
import SettingsModal from '../components/SettingsModal';
import TimeUpModal from '../components/TimeUpModal';
import {
  MAJOR_KEYS,
  ALL_CHORDS_DISPLAY,
  getChordForNumber,
  getNumberForChord,
  getRandomKey,
  getRandomNumber,
  getRandomChordFromKey,
  getAllRomanNumerals,
  transposeChord,
  generateSessionId,
  chordsAreEqual
} from '../utils/chordLogic';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Game = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = location.state || {};

  const [gameState, setGameState] = useState({
    sessionId: generateSessionId(),
    currentKey: config.keySelection === 'random' ? getRandomKey() : (config.selectedKey || 'C'),
    sourceKey: config.sourceKey || 'C',
    targetKey: config.targetKeySelection === 'random' ? getRandomKey() : (config.targetKey || 'D'),
    currentQuestion: null,
    score: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    feedback: null,
    isGameActive: true,
    timeRemaining: config.timerDuration || null
  });

  const [includeParallelMinor, setIncludeParallelMinor] = useState(config.includeBorrowed || false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTimeUp, setShowTimeUp] = useState(false);

  const [displayedChords] = useState({
    major: ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'],
    minor: ['Cm', 'C#m/Dbm', 'Dm', 'D#m/Ebm', 'Em', 'Fm', 'F#m/Gbm', 'Gm', 'G#m/Abm', 'Am', 'A#m/Bbm', 'Bm']
  });

  // Generate new question
  const generateQuestion = useCallback(() => {
    if (config.mode === 'transposition') {
      // Transposition mode
      const source = gameState.sourceKey;
      const target = config.targetKeySelection === 'random' ? getRandomKey() : gameState.targetKey;
      const sourceChord = getRandomChordFromKey(source, includeParallelMinor);
      
      return {
        key: source,
        targetKey: target,
        question: sourceChord,
        type: 'transposition'
      };
    } else {
      // Regular modes
      const key = config.keySelection === 'random' ? getRandomKey() : gameState.currentKey;
      
      if (config.mode === 'number-to-chord') {
        const romanNumeral = getRandomNumber(includeParallelMinor);
        return { key, question: romanNumeral, type: 'number' };
      } else {
        // chord-to-number mode
        const romanNumeral = getRandomNumber(includeParallelMinor);
        const chord = getChordForNumber(key, romanNumeral, includeParallelMinor);
        return { key, question: chord, type: 'chord' };
      }
    }
  }, [config.mode, config.keySelection, config.targetKeySelection, gameState.currentKey, gameState.sourceKey, gameState.targetKey, includeParallelMinor]);

  // Initialize first question
  useEffect(() => {
    const firstQuestion = generateQuestion();
    setGameState(prev => ({
      ...prev,
      currentKey: firstQuestion.key,
      targetKey: firstQuestion.targetKey || prev.targetKey,
      currentQuestion: firstQuestion
    }));
  }, [generateQuestion]);

  // Timer countdown
  useEffect(() => {
    if (config.timerMode === 'timed' && gameState.isGameActive && gameState.timeRemaining > 0) {
      const timer = setInterval(() => {
        setGameState(prev => {
          if (prev.timeRemaining <= 1) {
            clearInterval(timer);
            return { ...prev, timeRemaining: 0, isGameActive: false };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);

      return () => clearInterval(timer);
    } else if (config.timerMode === 'timed' && gameState.timeRemaining === 0 && gameState.isGameActive) {
      // Show time up modal instead of navigating immediately
      saveGameSession();
      setShowTimeUp(true);
    }
  }, [config.timerMode, gameState.isGameActive, gameState.timeRemaining]);

  // Handle answer
  const handleAnswer = (answer) => {
    if (!gameState.isGameActive || gameState.feedback) return;

    const { currentQuestion } = gameState;
    let isCorrect = false;

    if (config.mode === 'number-to-chord') {
      const correctChord = getChordForNumber(currentQuestion.key, currentQuestion.question, includeParallelMinor);
      isCorrect = chordsAreEqual(answer, correctChord);
    } else if (config.mode === 'chord-to-number') {
      const correctNumber = getNumberForChord(currentQuestion.key, currentQuestion.question, includeParallelMinor);
      isCorrect = answer === correctNumber;
    } else if (config.mode === 'transposition') {
      const correctChord = transposeChord(currentQuestion.question, currentQuestion.key, currentQuestion.targetKey);
      isCorrect = chordsAreEqual(answer, correctChord);
    }

    setGameState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 1 : prev.score,
      totalQuestions: prev.totalQuestions + 1,
      correctAnswers: isCorrect ? prev.correctAnswers + 1 : prev.correctAnswers,
      feedback: isCorrect ? 'correct' : 'incorrect'
    }));

    // Move to next question after brief delay
    setTimeout(() => {
      if (config.timerMode === 'untimed' || gameState.timeRemaining > 0) {
        const nextQuestion = generateQuestion();
        setGameState(prev => ({
          ...prev,
          currentKey: nextQuestion.key,
          targetKey: nextQuestion.targetKey || prev.targetKey,
          currentQuestion: nextQuestion,
          feedback: null
        }));
      }
    }, 500);
  };

  const saveGameSession = async () => {
    // Save session to backend
    try {
      const accuracy = gameState.totalQuestions > 0 
        ? (gameState.correctAnswers / gameState.totalQuestions) * 100 
        : 0;

      await axios.post(`${API}/game/session`, {
        session_id: gameState.sessionId,
        key: config.selectedKey || (config.mode === 'transposition' ? `${gameState.sourceKey}→${gameState.targetKey}` : 'Random'),
        mode: config.mode,
        timer_mode: config.timerMode === 'timed' ? config.timerDuration.toString() : 'untimed',
        score: gameState.score,
        total_questions: gameState.totalQuestions,
        accuracy: Math.round(accuracy)
      });
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const endGame = async () => {
    setGameState(prev => ({ ...prev, isGameActive: false }));
    await saveGameSession();

    // Navigate to results
    navigate('/results', {
      state: {
        score: gameState.score,
        totalQuestions: gameState.totalQuestions,
        accuracy: gameState.totalQuestions > 0 
          ? Math.round((gameState.correctAnswers / gameState.totalQuestions) * 100)
          : 0,
        key: config.selectedKey || (config.mode === 'transposition' ? `${gameState.sourceKey}→${gameState.targetKey}` : 'Random'),
        mode: config.mode,
        timerMode: config.timerMode
      }
    });
  };
        mode: config.mode,
        timerMode: config.timerMode
      }
    });
  };

  const handleSettingsChange = (newSettings) => {
    if ('includeParallelMinor' in newSettings) {
      setIncludeParallelMinor(newSettings.includeParallelMinor);
      // Generate new question with updated settings
      setTimeout(() => {
        const newQuestion = generateQuestion();
        setGameState(prev => ({
          ...prev,
          currentQuestion: newQuestion
        }));
      }, 0);
    }
  };

  if (!gameState.currentQuestion) {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
      <p>Loading...</p>
    </div>;
  }

  const getRomanNumeralButtons = () => {
    return getAllRomanNumerals(includeParallelMinor);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            data-testid="quit-game-button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#9CA3AF] hover:text-[#002FA7] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Quit</span>
          </button>

          <div className="flex items-center gap-6">
            {/* Settings Button (only in untimed mode) */}
            {config.timerMode === 'untimed' && (
              <button
                data-testid="settings-button"
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 text-[#9CA3AF] hover:text-[#002FA7] transition-colors"
              >
                <SettingsIcon className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest hidden md:inline">Settings</span>
              </button>
            )}
            
            {config.timerMode === 'timed' && (
              <div className="flex items-center gap-2 text-[#002FA7]" data-testid="timer-display">
                <TimerIcon className="w-5 h-5" />
                <span className="text-2xl font-bold">{gameState.timeRemaining}s</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[#1A1A1A]" data-testid="score-display">
              <Trophy className="w-5 h-5 text-[#FF3B30]" />
              <span className="text-2xl font-bold">{gameState.score}</span>
            </div>
          </div>
        </div>

        {/* Current Key Display */}
        {config.mode !== 'transposition' && (
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
              Current Key
            </p>
            {config.keySelection === 'preselected' && config.timerMode === 'untimed' ? (
              <select
                data-testid="key-change-selector"
                value={gameState.currentKey}
                onChange={(e) => {
                  const newKey = e.target.value;
                  // Generate new question with the new key immediately
                  const newQuestion = (() => {
                    if (config.mode === 'number-to-chord') {
                      const romanNumeral = getRandomNumber(includeParallelMinor);
                      return { key: newKey, question: romanNumeral, type: 'number' };
                    } else {
                      // chord-to-number mode
                      const romanNumeral = getRandomNumber(includeParallelMinor);
                      const chord = getChordForNumber(newKey, romanNumeral, includeParallelMinor);
                      return { key: newKey, question: chord, type: 'chord' };
                    }
                  })();
                  
                  setGameState(prev => ({
                    ...prev,
                    currentKey: newKey,
                    currentQuestion: newQuestion,
                    feedback: null
                  }));
                }}
                className="text-4xl md:text-6xl font-bold tracking-tighter text-[#002FA7] bg-transparent border-b-4 border-[#002FA7] focus:outline-none text-center cursor-pointer hover:bg-[#002FA7]/5 transition-colors px-4 py-2"
              >
                {Object.keys(MAJOR_KEYS).map((key) => (
                  <option key={key} value={key}>
                    {key} Major
                  </option>
                ))}
              </select>
            ) : (
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-[#002FA7]" data-testid="current-key">
                {gameState.currentKey} Major
              </h2>
            )}
          </div>
        )}

        {/* Transposition Keys Display */}
        {config.mode === 'transposition' && (
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
                From
              </p>
              {config.timerMode === 'untimed' ? (
                <select
                  data-testid="source-key-change-selector"
                  value={gameState.sourceKey}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    setGameState(prev => ({
                      ...prev,
                      sourceKey: newKey
                    }));
                    setTimeout(() => {
                      const newQuestion = generateQuestion();
                      setGameState(prev => ({
                        ...prev,
                        sourceKey: newKey,
                        currentQuestion: { ...newQuestion, key: newKey }
                      }));
                    }, 0);
                  }}
                  className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7] bg-transparent border-b-4 border-[#002FA7] focus:outline-none text-center cursor-pointer hover:bg-[#002FA7]/5 transition-colors px-4 py-2"
                >
                  {Object.keys(MAJOR_KEYS).map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7]">
                  {gameState.sourceKey}
                </h2>
              )}
            </div>
            
            <div className="text-4xl text-[#9CA3AF]">→</div>
            
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
                To
              </p>
              {config.targetKeySelection === 'preselected' && config.timerMode === 'untimed' ? (
                <select
                  data-testid="target-key-change-selector"
                  value={gameState.targetKey}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    setGameState(prev => ({
                      ...prev,
                      targetKey: newKey
                    }));
                    setTimeout(() => {
                      const newQuestion = generateQuestion();
                      setGameState(prev => ({
                        ...prev,
                        targetKey: newKey,
                        currentQuestion: { ...newQuestion, targetKey: newKey }
                      }));
                    }, 0);
                  }}
                  className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7] bg-transparent border-b-4 border-[#002FA7] focus:outline-none text-center cursor-pointer hover:bg-[#002FA7]/5 transition-colors px-4 py-2"
                >
                  {Object.keys(MAJOR_KEYS).map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7]" data-testid="target-key">
                  {gameState.targetKey}
                </h2>
              )}
            </div>
          </div>
        )}

        {/* Question Display - Fixed size to prevent glitching */}
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-4">
            {config.mode === 'number-to-chord' ? 'Select the chord for' :
             config.mode === 'chord-to-number' ? 'Select the roman numeral for' :
             'Transpose this chord'}
          </p>
          <div 
            data-testid="question-display"
            className={`inline-flex items-center justify-center min-w-[280px] min-h-[180px] px-16 py-12 border-4 rounded-sm ${
              gameState.feedback === 'correct' 
                ? 'bg-green-100 border-green-500'
                : gameState.feedback === 'incorrect'
                ? 'bg-red-100 border-red-500'
                : 'bg-white border-[#002FA7]'
            }`}
          >
            <span className="text-5xl md:text-7xl font-bold text-[#1A1A1A]">
              {gameState.currentQuestion.question}
            </span>
          </div>
        </div>

        {/* Answer Buttons */}
        {(config.mode === 'number-to-chord' || config.mode === 'transposition') ? (
          <div className="space-y-4 max-w-5xl mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
              Major Chords
            </p>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2 md:gap-3 mb-8">
              {displayedChords.major.map((chord) => (
                <button
                  key={chord}
                  data-testid={`chord-button-${chord}`}
                  onClick={() => handleAnswer(chord)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-14 md:h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-[10px] md:text-xs font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50 px-1"
                >
                  {chord}
                </button>
              ))}
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
              Minor Chords
            </p>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2 md:gap-3">
              {displayedChords.minor.map((chord) => (
                <button
                  key={chord}
                  data-testid={`chord-button-${chord}`}
                  onClick={() => handleAnswer(chord)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-14 md:h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-[10px] md:text-xs font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50 px-1"
                >
                  {chord}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 text-center">
              Select Roman Numeral
            </p>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {getRomanNumeralButtons().map((numeral) => (
                <button
                  key={numeral}
                  data-testid={`number-button-${numeral}`}
                  onClick={() => handleAnswer(numeral)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-2xl md:text-3xl font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {numeral}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* End Game Button (for untimed mode) */}
        {config.timerMode === 'untimed' && gameState.isGameActive && (
          <div className="text-center mt-12">
            <button
              data-testid="end-game-button"
              onClick={endGame}
              className="rounded-none border-2 border-[#FF3B30] bg-transparent text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white transition-all duration-200 font-bold uppercase tracking-wider text-sm px-6 py-3"
            >
              End Game
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={{ includeParallelMinor }}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
};

export default Game;
