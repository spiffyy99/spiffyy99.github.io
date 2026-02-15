import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Timer as TimerIcon, Trophy } from 'lucide-react';
import axios from 'axios';
import {
  MAJOR_KEYS,
  ALL_CHORDS_DISPLAY,
  getChordForNumber,
  getNumberForChord,
  getRandomKey,
  getRandomNumber,
  getRandomChordFromKey,
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

  const [includeBorrowed, setIncludeBorrowed] = useState(config.includeBorrowed || false);

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
      const sourceChord = getRandomChordFromKey(source, includeBorrowed);
      
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
        const number = getRandomNumber(includeBorrowed);
        return { key, question: number, type: 'number' };
      } else {
        // chord-to-number mode
        const number = getRandomNumber(includeBorrowed);
        const chord = getChordForNumber(key, number, includeBorrowed);
        return { key, question: chord, type: 'chord' };
      }
    }
  }, [config.mode, config.keySelection, config.targetKeySelection, gameState.currentKey, gameState.sourceKey, gameState.targetKey, includeBorrowed]);

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
      endGame();
    }
  }, [config.timerMode, gameState.isGameActive, gameState.timeRemaining]);

  // Handle answer
  const handleAnswer = (answer) => {
    if (!gameState.isGameActive || gameState.feedback) return;

    const { currentQuestion } = gameState;
    let isCorrect = false;

    if (config.mode === 'number-to-chord') {
      const correctChord = getChordForNumber(currentQuestion.key, currentQuestion.question, includeBorrowed);
      isCorrect = chordsAreEqual(answer, correctChord);
    } else if (config.mode === 'chord-to-number') {
      const correctNumber = getNumberForChord(currentQuestion.key, currentQuestion.question, includeBorrowed);
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

  const endGame = async () => {
    setGameState(prev => ({ ...prev, isGameActive: false }));

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

  if (!gameState.currentQuestion) {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
      <p>Loading...</p>
    </div>;
  }

  const getNumberRange = () => {
    return includeBorrowed ? '1-13' : '1-6';
  };

  const getNumberButtons = () => {
    const max = includeBorrowed ? 13 : 6;
    return Array.from({ length: max }, (_, i) => i + 1);
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
            {/* Borrowed Chords Toggle */}
            {config.timerMode === 'untimed' && (
              <button
                data-testid="borrowed-toggle-ingame"
                onClick={() => {
                  setIncludeBorrowed(!includeBorrowed);
                  // Generate new question immediately
                  setTimeout(() => {
                    const newQuestion = generateQuestion();
                    setGameState(prev => ({
                      ...prev,
                      currentQuestion: newQuestion
                    }));
                  }, 0);
                }}
                className={`text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-sm border-2 transition-all ${
                  includeBorrowed
                    ? 'border-[#002FA7] bg-[#002FA7] text-white'
                    : 'border-[#E5E7EB] text-[#9CA3AF] hover:border-[#002FA7]'
                }`}
              >
                Borrowed {includeBorrowed ? 'ON' : 'OFF'}
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
                  setGameState(prev => ({
                    ...prev,
                    currentKey: newKey
                  }));
                  setTimeout(() => {
                    const newQuestion = generateQuestion();
                    setGameState(prev => ({
                      ...prev,
                      currentKey: newKey,
                      currentQuestion: { ...newQuestion, key: newKey }
                    }));
                  }, 0);
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

        {/* Question Display */}
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-4">
            {config.mode === 'number-to-chord' ? `Select the chord for (${getNumberRange()})` :
             config.mode === 'chord-to-number' ? `Select the number for (${getNumberRange()})` :
             'Transpose this chord'}
          </p>
          <div 
            data-testid="question-display"
            className={`inline-block px-16 py-12 border-4 rounded-sm transition-all ${
              gameState.feedback === 'correct' 
                ? 'bg-green-100 border-green-500 animate-pulse'
                : gameState.feedback === 'incorrect'
                ? 'bg-red-100 border-red-500 animate-pulse'
                : 'bg-white border-[#002FA7]'
            }`}
          >
            <span className="text-6xl md:text-8xl font-bold text-[#1A1A1A]">
              {gameState.currentQuestion.question}
            </span>
          </div>
        </div>

        {/* Answer Buttons */}
        {(config.mode === 'number-to-chord' || config.mode === 'transposition') ? (
          <div className="space-y-4 max-w-5xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-3">
              Major Chords
            </p>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-3 md:gap-4 mb-8">
              {displayedChords.major.map((chord) => (
                <button
                  key={chord}
                  data-testid={`chord-button-${chord}`}
                  onClick={() => handleAnswer(chord)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-16 md:h-24 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-sm md:text-base font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {chord}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-3">
              Minor Chords
            </p>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-3 md:gap-4">
              {displayedChords.minor.map((chord) => (
                <button
                  key={chord}
                  data-testid={`chord-button-${chord}`}
                  onClick={() => handleAnswer(chord)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-16 md:h-24 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-sm md:text-base font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {chord}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 text-center">
              Select Number ({getNumberRange()})
            </p>
            <div className={`grid gap-4 ${includeBorrowed ? 'grid-cols-4 md:grid-cols-7' : 'grid-cols-3'}`}>
              {getNumberButtons().map((num) => (
                <button
                  key={num}
                  data-testid={`number-button-${num}`}
                  onClick={() => handleAnswer(num)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-3xl font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {num}
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
    </div>
  );
};

export default Game;
