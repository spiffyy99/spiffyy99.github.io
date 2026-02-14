import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Timer as TimerIcon, Trophy } from 'lucide-react';
import axios from 'axios';
import {
  MAJOR_KEYS,
  MAJOR_CHORDS,
  MINOR_CHORDS,
  getChordForNumber,
  getNumberForChord,
  getNumberForChordEnharmonic,
  getRandomKey,
  getRandomNumber,
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
    currentQuestion: null,
    score: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    feedback: null,
    isGameActive: true,
    timeRemaining: config.timerDuration || null
  });

  const [displayedChords] = useState({
    major: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
    minor: ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm']
  });

  // Generate new question
  const generateQuestion = useCallback(() => {
    const key = config.keySelection === 'random' ? getRandomKey() : gameState.currentKey;
    
    if (config.mode === 'number-to-chord') {
      const number = getRandomNumber();
      return { key, question: number, type: 'number' };
    } else {
      // chord-to-number mode
      const number = getRandomNumber();
      const chord = getChordForNumber(key, number);
      return { key, question: chord, type: 'chord' };
    }
  }, [config.mode, config.keySelection, gameState.currentKey]);

  // Initialize first question
  useEffect(() => {
    const firstQuestion = generateQuestion();
    setGameState(prev => ({
      ...prev,
      currentKey: firstQuestion.key,
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
      const correctChord = getChordForNumber(currentQuestion.key, currentQuestion.question);
      // Use enharmonic-aware comparison
      isCorrect = chordsAreEqual(answer, correctChord);
    } else {
      // Use enharmonic-aware number lookup
      const correctNumber = getNumberForChordEnharmonic(currentQuestion.key, currentQuestion.question);
      isCorrect = answer === correctNumber;
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
        key: config.selectedKey || 'Random',
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
        key: config.selectedKey || 'Random',
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
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
            Current Key
          </p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-[#002FA7]" data-testid="current-key">
            {gameState.currentKey} Major
          </h2>
        </div>

        {/* Question Display */}
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-4">
            {config.mode === 'number-to-chord' ? 'Select the chord for' : 'Select the number for'}
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
        {config.mode === 'number-to-chord' ? (
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
                  className="h-16 md:h-24 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-lg md:text-xl font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
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
                  className="h-16 md:h-24 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-lg md:text-xl font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {chord}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 text-center">
              Select Number
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  data-testid={`number-button-${num}`}
                  onClick={() => handleAnswer(num)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-24 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-4xl font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
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
