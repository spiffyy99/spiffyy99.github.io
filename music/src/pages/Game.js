import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Timer as TimerIcon, Trophy, Settings as SettingsIcon } from 'lucide-react';
import axios from 'axios';
import SettingsModal from '../components/SettingsModal';
import TimeUpModal from '../components/TimeUpModal';
import ThemeToggle from '../components/ThemeToggle';
import {
  ALL_NOTES,
  SCALE_TYPES,
  DEGREE_NUMBERS,
  INTERVALS,
  generateSessionId,
  getRandomScale,
  generateNumberToChordQuestion,
  generateChordToNumberQuestion,
  generateTranspositionQuestion,
  generateRandomNotePair,
  generateIntervalTransposition,
  generateGuessScaleQuestion,
  buildChordDisplay,
  formatRomanNumeral,
} from '../utils/chordLogic';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const randomRoot = () => ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)];

// Dynamic font size for question text
const questionTextClass = (text) => {
  if (!text) return 'text-5xl md:text-7xl';
  if (text.length > 14) return 'text-2xl md:text-4xl';
  if (text.length > 10) return 'text-3xl md:text-5xl';
  if (text.length > 6) return 'text-4xl md:text-6xl';
  return 'text-5xl md:text-7xl';
};

const Game = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = location.state || {};

  // Scale settings
  const [enabledScaleTypes, setEnabledScaleTypes] = useState(config.enabledScaleTypes || ['major']);
  const enabledScaleTypesRef = useRef(config.enabledScaleTypes || ['major']);
  const [includeBorrowed, setIncludeBorrowed] = useState(config.includeBorrowed || false);
  const includeBorrowedRef = useRef(config.includeBorrowed || false);
  const [include7ths, setInclude7ths] = useState(config.include7ths || false);
  const include7thsRef = useRef(config.include7ths || false);

  useEffect(() => { enabledScaleTypesRef.current = enabledScaleTypes; }, [enabledScaleTypes]);
  useEffect(() => { includeBorrowedRef.current = includeBorrowed; }, [includeBorrowed]);
  useEffect(() => { include7thsRef.current = include7ths; }, [include7ths]);

  // Quality switch
  const [selectedQuality, setSelectedQuality] = useState('major');

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showTimeUp, setShowTimeUp] = useState(false);

  // Initial scale computation
  const getInitialScale = () => {
    if (config.mode === 'transposition') return null;
    if (config.scaleSelection === 'random') {
      return getRandomScale(config.enabledScaleTypes || ['major']);
    }
    return { rootNote: config.selectedRoot || 'C', scaleType: config.selectedScaleType || 'major' };
  };

  const getRandomDifferentRoot = (excludeRoot) => {
    let newRoot;
    do {
      newRoot = randomRoot();
    } while (newRoot === excludeRoot);
    return newRoot;
  };

  const getRandomScaleType = () => {
    const scaleTypes = enabledScaleTypesRef.current || ['major'];
    return scaleTypes[Math.floor(Math.random() * scaleTypes.length)];
  };

  const getInitialTranspositionState = () => {
    if (config.mode !== 'transposition') return { sourceScale: null, targetScale: null };
    
    if (config.targetScaleSelection === 'random') {
      const src = randomRoot();
      const tgt = getRandomDifferentRoot(src);
      return {
        sourceScale: { rootNote: src, scaleType: getRandomScaleType() },
        targetScale: { rootNote: tgt, scaleType: getRandomScaleType() }
      };
    } else {
      return {
        sourceScale: { rootNote: config.sourceRoot || 'C', scaleType: getRandomScaleType() },
        targetScale: { rootNote: config.targetRoot || 'D', scaleType: getRandomScaleType() }
      };
    }
  };

  const transpState = getInitialTranspositionState();

  const [gameState, setGameState] = useState({
    sessionId: generateSessionId(),
    currentScale: getInitialScale(),
    sourceScale: transpState.sourceScale,
    targetScale: transpState.targetScale,
    currentQuestion: null,
    score: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    feedback: null,
    isGameActive: true,
    timeRemaining: config.timerDuration || null
  });

  // Generate question
  const generateQuestion = useCallback(() => {
    const scaleTypes = enabledScaleTypesRef.current;
    const borrowed = includeBorrowedRef.current;
    const sevenths = include7thsRef.current;

    if (config.mode === 'interval-transpose') {
      return { ...generateIntervalTransposition(), type: 'interval-transpose' };
    }
    if (config.mode === 'intervals') {
      return { ...generateRandomNotePair(), type: 'interval' };
    }
    if (config.mode === 'guess-scale') {
      return generateGuessScaleQuestion(scaleTypes, sevenths);
    }
    if (config.mode === 'number-to-chord') {
      const scale = config.scaleSelection === 'random'
        ? getRandomScale(scaleTypes)
        : { rootNote: gameState.currentScale?.rootNote || 'C', scaleType: gameState.currentScale?.scaleType || 'major' };
      return generateNumberToChordQuestion(scale.rootNote, scale.scaleType, borrowed, sevenths);
    }
    if (config.mode === 'chord-to-number') {
      const scale = config.scaleSelection === 'random'
        ? getRandomScale(scaleTypes)
        : { rootNote: gameState.currentScale?.rootNote || 'C', scaleType: gameState.currentScale?.scaleType || 'major' };
      return generateChordToNumberQuestion(scale.rootNote, scale.scaleType, borrowed, sevenths);
    }
    if (config.mode === 'transposition') {
      const randomScaleType = getRandomScaleType();
      if (config.targetScaleSelection === 'random') {
        const src = randomRoot();
        const tgt = getRandomDifferentRoot(src);
        return generateTranspositionQuestion(src, randomScaleType, tgt, randomScaleType, borrowed, sevenths);
      } else {
        const src = config.sourceRoot || 'C';
        const tgt = config.targetRoot || 'D';
        return generateTranspositionQuestion(src, randomScaleType, tgt, randomScaleType, borrowed, sevenths);
      }
    }
    return null;
  }, [config.mode, config.scaleSelection, config.targetScaleSelection, gameState.currentScale, gameState.sourceScale, gameState.targetScale]);

  // Initialize first question
  useEffect(() => {
    const firstQ = generateQuestion();
    if (firstQ) {
      setGameState(prev => ({
        ...prev,
        currentScale: firstQ.scale || firstQ.sourceScale || prev.currentScale,
        targetScale: firstQ.targetScale || prev.targetScale,
        currentQuestion: firstQ
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    if (config.timerMode === 'timed' && gameState.isGameActive && gameState.timeRemaining > 0) {
      const timer = setInterval(() => {
        setGameState(prev => {
          if (prev.timeRemaining <= 1) {
            clearInterval(timer);
            setTimeout(() => {
              saveGameSession();
              setShowTimeUp(true);
            }, 100);
            return { ...prev, timeRemaining: 0, isGameActive: false };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.timerMode, gameState.isGameActive, gameState.timeRemaining]);

  // Correct answer display text
  const getCorrectAnswerText = () => {
    const q = gameState.currentQuestion;
    if (!q) return '';
    if (q.type === 'number-to-chord' || q.type === 'transposition') {
      return buildChordDisplay(ALL_NOTES[q.correctNoteIndex], q.correctQuality);
    }
    if (q.type === 'chord-to-number') {
      if (q.correctAnswerQuality === 'flat') {
        return formatRomanNumeral(q.correctDegree, 'major', true);
      }
      return formatRomanNumeral(q.correctDegree, q.correctAnswerQuality, false);
    }
    if (q.type === 'interval') return q.correctInterval;
    if (q.type === 'interval-transpose') return q.correctNote;
    if (q.type === 'guess-scale') return q.correctScale?.rootNote || '';
    return '';
  };

  // Submit answer
  const submitAnswer = (isCorrect) => {
    setGameState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 1 : prev.score,
      totalQuestions: prev.totalQuestions + 1,
      correctAnswers: isCorrect ? prev.correctAnswers + 1 : prev.correctAnswers,
      feedback: isCorrect ? 'correct' : 'incorrect'
    }));

    setTimeout(() => {
      if (config.timerMode === 'untimed' || gameState.timeRemaining > 0) {
        const next = generateQuestion();
        if (next) {
          setGameState(prev => ({
            ...prev,
            currentScale: next.scale || next.sourceScale || prev.currentScale,
            targetScale: next.targetScale || prev.targetScale,
            currentQuestion: next,
            feedback: null
          }));
        }
      }
    }, 800);
  };

  // Answer handlers
  const handleNoteAnswer = (noteIndex) => {
    if (!gameState.isGameActive || gameState.feedback) return;
    const q = gameState.currentQuestion;
    if (!q) return;
    submitAnswer(noteIndex === q.correctNoteIndex && selectedQuality === q.correctQuality);
  };

  const handleDegreeAnswer = (degreeIndex) => {
    if (!gameState.isGameActive || gameState.feedback) return;
    const q = gameState.currentQuestion;
    if (!q) return;
    submitAnswer(degreeIndex === q.correctDegree && selectedQuality === q.correctAnswerQuality);
  };

  const handleIntervalAnswer = (answer) => {
    if (!gameState.isGameActive || gameState.feedback) return;
    const q = gameState.currentQuestion;
    if (!q) return;
    let isCorrect = false;
    if (q.type === 'interval-transpose') {
      isCorrect = answer === q.correctNote;
    } else if (q.type === 'interval') {
      const correctSemi = INTERVALS.find(i => i.name === q.correctInterval)?.semitones % 12;
      const answerSemi = INTERVALS.find(i => i.name === answer)?.semitones % 12;
      isCorrect = correctSemi === answerSemi;
    }
    submitAnswer(isCorrect);
  };

  const handleScaleRootAnswer = (noteIndex) => {
    if (!gameState.isGameActive || gameState.feedback) return;
    const q = gameState.currentQuestion;
    if (!q || q.type !== 'guess-scale') return;
    const selectedNote = ALL_NOTES[noteIndex];
    const isCorrect = selectedNote === q.correctScale?.rootNote;
    submitAnswer(isCorrect);
  };

  // Save session
  const saveGameSession = async () => {
    try {
      const accuracy = gameState.totalQuestions > 0
        ? (gameState.correctAnswers / gameState.totalQuestions) * 100 : 0;
      const scaleLabel = gameState.currentScale
        ? `${gameState.currentScale.rootNote} ${SCALE_TYPES[gameState.currentScale.scaleType]?.name || 'Major'}`
        : (gameState.sourceScale
          ? `${gameState.sourceScale.rootNote}\u2192${gameState.targetScale?.rootNote} ${SCALE_TYPES[gameState.sourceScale.scaleType]?.name}`
          : 'Random');
      await axios.post(`${API}/game/session`, {
        session_id: gameState.sessionId,
        key: config.scaleSelection === 'random' ? 'Random' : scaleLabel,
        mode: config.mode,
        timer_mode: config.timerMode === 'timed' ? config.timerDuration?.toString() : 'untimed',
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
    const scaleLabel = gameState.currentScale
      ? `${gameState.currentScale.rootNote} ${SCALE_TYPES[gameState.currentScale.scaleType]?.name || 'Major'}`
      : 'Random';
    navigate('/results', {
      state: {
        score: gameState.score,
        totalQuestions: gameState.totalQuestions,
        accuracy: gameState.totalQuestions > 0
          ? Math.round((gameState.correctAnswers / gameState.totalQuestions) * 100) : 0,
        scale: config.scaleSelection === 'random' ? 'Random' : scaleLabel,
        mode: config.mode,
        timerMode: config.timerMode
      }
    });
  };

  // Handle settings changes - FIX: regenerate question when scale type changes in preselected mode
  const handleSettingsChange = (newSettings) => {
    if ('enabledScaleTypes' in newSettings) {
      setEnabledScaleTypes(newSettings.enabledScaleTypes);
      
      // For guess-scale mode, regenerate when scale types change (untimed only)
      if (config.mode === 'guess-scale' && config.timerMode === 'untimed') {
        const sevenths = include7thsRef.current;
        const newQuestion = generateGuessScaleQuestion(newSettings.enabledScaleTypes, sevenths);
        if (newQuestion) {
          setGameState(prev => ({
            ...prev,
            currentQuestion: newQuestion,
            feedback: null
          }));
        }
      }
      // Auto-adjust + regenerate if current scale type is now invalid
      else if (config.scaleSelection === 'preselected' && gameState.currentScale) {
        if (!newSettings.enabledScaleTypes.includes(gameState.currentScale.scaleType)) {
          const newScaleType = newSettings.enabledScaleTypes[0];
          const root = gameState.currentScale.rootNote;
          const borrowed = includeBorrowedRef.current;
          const sevenths = include7thsRef.current;
          let newQuestion;
          if (config.mode === 'number-to-chord') {
            newQuestion = generateNumberToChordQuestion(root, newScaleType, borrowed, sevenths);
          } else if (config.mode === 'chord-to-number') {
            newQuestion = generateChordToNumberQuestion(root, newScaleType, borrowed, sevenths);
          }
          if (newQuestion) {
            setGameState(prev => ({
              ...prev,
              currentScale: { rootNote: root, scaleType: newScaleType },
              currentQuestion: newQuestion,
              feedback: null
            }));
          } else {
            setGameState(prev => ({
              ...prev,
              currentScale: { ...prev.currentScale, scaleType: newScaleType }
            }));
          }
        }
      }
      // For transposition mode, scale type is randomized, so no need to adjust
    }
    if ('includeBorrowed' in newSettings) {
      setIncludeBorrowed(newSettings.includeBorrowed);
    }
    if ('include7ths' in newSettings) {
      setInclude7ths(newSettings.include7ths);
      
      // For guess-scale mode, regenerate when 7ths setting changes (untimed only)
      if (config.mode === 'guess-scale' && config.timerMode === 'untimed') {
        const scaleTypes = enabledScaleTypesRef.current;
        const newQuestion = generateGuessScaleQuestion(scaleTypes, newSettings.include7ths);
        if (newQuestion) {
          setGameState(prev => ({
            ...prev,
            currentQuestion: newQuestion,
            feedback: null
          }));
        }
      }
      // If disabling 7ths and current question is a 7th, regenerate
      else if (!newSettings.include7ths && gameState.currentQuestion?.is7th) {
        const scale = gameState.currentScale || { rootNote: 'C', scaleType: 'major' };
        const borrowed = includeBorrowedRef.current;
        let newQuestion;
        if (config.mode === 'number-to-chord') {
          newQuestion = generateNumberToChordQuestion(scale.rootNote, scale.scaleType, borrowed, false);
        } else if (config.mode === 'chord-to-number') {
          newQuestion = generateChordToNumberQuestion(scale.rootNote, scale.scaleType, borrowed, false);
        } else if (config.mode === 'transposition') {
          const src = gameState.sourceScale || { rootNote: 'C', scaleType: 'major' };
          const tgt = gameState.targetScale || { rootNote: 'D', scaleType: 'major' };
          const randomScaleType = getRandomScaleType();
          newQuestion = generateTranspositionQuestion(src.rootNote, randomScaleType, tgt.rootNote, randomScaleType, borrowed, false);
        }
        if (newQuestion) {
          setGameState(prev => ({
            ...prev,
            currentQuestion: newQuestion,
            feedback: null
          }));
        }
      }
    }
  };

  // Scale change handlers (preselected + untimed)
  const handleScaleRootChange = (newRoot) => {
    const scaleType = gameState.currentScale?.scaleType || 'major';
    const borrowed = includeBorrowedRef.current;
    let newQuestion;
    if (config.mode === 'number-to-chord') {
      newQuestion = generateNumberToChordQuestion(newRoot, scaleType, borrowed);
    } else {
      newQuestion = generateChordToNumberQuestion(newRoot, scaleType, borrowed);
    }
    setGameState(prev => ({
      ...prev,
      currentScale: { rootNote: newRoot, scaleType },
      currentQuestion: newQuestion,
      feedback: null
    }));
  };

  const handleScaleTypeChange = (newScaleType) => {
    const root = gameState.currentScale?.rootNote || 'C';
    const borrowed = includeBorrowedRef.current;
    let newQuestion;
    if (config.mode === 'number-to-chord') {
      newQuestion = generateNumberToChordQuestion(root, newScaleType, borrowed);
    } else {
      newQuestion = generateChordToNumberQuestion(root, newScaleType, borrowed);
    }
    setGameState(prev => ({
      ...prev,
      currentScale: { rootNote: root, scaleType: newScaleType },
      currentQuestion: newQuestion,
      feedback: null
    }));
  };


  const handleSourceRootChange = (newRoot) => {
    if (config.targetScaleSelection !== 'preselected') return;
    const scaleType = getRandomScaleType();
    const tgtRoot = gameState.targetScale?.rootNote || 'D';
    const newQ = generateTranspositionQuestion(newRoot, scaleType, tgtRoot, scaleType, includeBorrowedRef.current);
    setGameState(prev => ({
      ...prev,
      sourceScale: { rootNote: newRoot, scaleType },
      currentQuestion: newQ,
      feedback: null
    }));
  };

  const handleTargetRootChange = (newRoot) => {
    if (config.targetScaleSelection !== 'preselected') return;
    const srcRoot = gameState.sourceScale?.rootNote || 'C';
    if (newRoot === srcRoot) return; // Prevent setting target same as source
    const scaleType = getRandomScaleType();
    const newQ = generateTranspositionQuestion(srcRoot, scaleType, newRoot, scaleType, includeBorrowedRef.current);
    setGameState(prev => ({
      ...prev,
      targetScale: { rootNote: newRoot, scaleType },
      currentQuestion: newQ,
      feedback: null
    }));
  };

  // Loading state
  if (!gameState.currentQuestion) {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center"><p>Loading...</p></div>;
  }

  const q = gameState.currentQuestion;
  const isChordMode = config.mode === 'number-to-chord' || config.mode === 'transposition';
  const isDegreeMode = config.mode === 'chord-to-number';
  const isIntervalMode = config.mode === 'intervals' || config.mode === 'interval-transpose';
  const isGuessScaleMode = config.mode === 'guess-scale';
  const isPreselectedUntimed = config.scaleSelection === 'preselected' && config.timerMode === 'untimed';

  // Quality options - show 7ths only when enabled AND question is a 7th question
  const show7thOptions = include7ths && q.is7th;
  const qualityOptions = isDegreeMode
    ? ['major', 'minor', 'dim', 'aug', 'flat']
    : show7thOptions
      ? ['maj7', 'min7', 'dom7', 'halfdim7', 'dim7', 'aug7']
      : ['major', 'minor', 'dim', 'aug'];
  const qualityLabels = {
    major: 'Major', minor: 'Minor', dim: 'Dim', aug: 'Aug', flat: '\u266D Flat',
    maj7: 'Maj7', min7: 'm7', dom7: '7', halfdim7: 'ø7', dim7: '°7', aug7: 'Aug7'
  };

  const displayScale = q.scale || q.sourceScale || gameState.currentScale;

  // Get question text for dynamic sizing
  const getQuestionText = () => {
    if (q.type === 'number-to-chord') return q.romanNumeral;
    if (q.type === 'chord-to-number' || q.type === 'transposition') return q.chordDisplay;
    if (q.type === 'interval') return `${q.note1} \u2192 ${q.note2}`;
    if (q.type === 'interval-transpose') return q.startNote;
    return '';
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

          <div className="flex items-center gap-4">
            <ThemeToggle />
            {(!isIntervalMode || isGuessScaleMode) && (
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

        {/* Scale Display - modes 1 & 2 (not for guess-scale) */}
        {!isIntervalMode && !isGuessScaleMode && config.mode !== 'transposition' && displayScale && (
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Current Scale</p>
            {isPreselectedUntimed ? (
              <div className="flex items-center justify-center gap-3">
                <select
                  data-testid="game-root-selector"
                  value={gameState.currentScale?.rootNote || 'C'}
                  onChange={(e) => handleScaleRootChange(e.target.value)}
                  className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7] bg-transparent border-b-4 border-[#002FA7] focus:outline-none text-center cursor-pointer hover:bg-[#002FA7]/5 transition-colors px-3 py-1"
                >
                  {ALL_NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <select
                  data-testid="game-scale-type-selector"
                  value={gameState.currentScale?.scaleType || 'major'}
                  onChange={(e) => handleScaleTypeChange(e.target.value)}
                  className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7] bg-transparent border-b-4 border-[#002FA7] focus:outline-none text-center cursor-pointer hover:bg-[#002FA7]/5 transition-colors px-3 py-1"
                >
                  {enabledScaleTypes.map(id => <option key={id} value={id}>{SCALE_TYPES[id].name}</option>)}
                </select>
              </div>
            ) : (
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-[#002FA7]" data-testid="current-scale">
                {displayScale.rootNote} {SCALE_TYPES[displayScale.scaleType]?.name || 'Major'}
              </h2>
            )}
          </div>
        )}

        {/* Transposition Scale Display - shared scale type + From/To roots */}
        {config.mode === 'transposition' && (
          <div className="text-center mb-8">
            {/* Scale type display - randomly selected each question */}
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Scale Type</p>
              <h3 className="text-2xl md:text-3xl font-bold text-[#002FA7]">
                {SCALE_TYPES[q.sourceScale?.scaleType || gameState.sourceScale?.scaleType]?.name}
              </h3>
            </div>

            {/* From → To roots */}
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">From</p>
                {config.targetScaleSelection === 'preselected' && config.timerMode === 'untimed' ? (
                  <select
                    data-testid="source-root-change"
                    value={gameState.sourceScale?.rootNote || 'C'}
                    onChange={(e) => handleSourceRootChange(e.target.value)}
                    className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7] bg-transparent border-b-4 border-[#002FA7] focus:outline-none text-center cursor-pointer hover:bg-[#002FA7]/5 transition-colors px-3 py-1"
                  >
                    {ALL_NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                ) : (
                  <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7]">
                    {q.sourceScale?.rootNote || gameState.sourceScale?.rootNote}
                  </h2>
                )}
              </div>

              <div className="text-4xl text-[#9CA3AF]">{'\u2192'}</div>

              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">To</p>
                {config.targetScaleSelection === 'preselected' && config.timerMode === 'untimed' ? (
                  <select
                    data-testid="target-root-change"
                    value={gameState.targetScale?.rootNote || 'D'}
                    onChange={(e) => handleTargetRootChange(e.target.value)}
                    className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7] bg-transparent border-b-4 border-[#002FA7] focus:outline-none text-center cursor-pointer hover:bg-[#002FA7]/5 transition-colors px-3 py-1"
                  >
                    {ALL_NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                ) : (
                  <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-[#002FA7]" data-testid="target-scale">
                    {q.targetScale?.rootNote || gameState.targetScale?.rootNote}
                  </h2>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Question Display */}
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-4">
            {config.mode === 'number-to-chord' ? 'Select the chord for' :
             config.mode === 'chord-to-number' ? 'Select the roman numeral for' :
             config.mode === 'intervals' ? 'Identify the interval' :
             config.mode === 'interval-transpose' ? 'Find the destination note' :
             config.mode === 'guess-scale' ? `This is a ${SCALE_TYPES[q?.correctScaleType]?.name || 'scale'}. Which root note?` :
             'Transpose this chord'}
          </p>
          <div
            data-testid="question-display"
            className={`inline-flex items-center justify-center min-w-[250px] md:min-w-[350px] max-w-[95vw] px-8 md:px-16 ${isGuessScaleMode ? 'min-h-[120px] py-6' : 'h-[180px]'} border-4 rounded-sm transition-colors duration-150 ${
              gameState.feedback === 'correct'
                ? 'bg-green-100 border-green-500'
                : gameState.feedback === 'incorrect'
                ? 'bg-red-100 border-red-500'
                : 'bg-white border-[#002FA7]'
            }`}
          >
            {q.type === 'interval-transpose' ? (
              <div className="text-center px-6">
                <div className="text-5xl md:text-7xl font-bold text-[#1A1A1A] mb-3">{q.startNote}</div>
                <div className="text-xl font-medium text-[#002FA7] mb-1">{q.direction === 'up' ? '\u2191 UP' : '\u2193 DOWN'}</div>
                <div className="text-lg font-medium text-[#9CA3AF]">{q.intervalFullName}</div>
              </div>
            ) : q.type === 'guess-scale' ? (
              <div className="flex flex-wrap justify-center gap-3 md:gap-4 px-4">
                {q.chords.map((chord, idx) => (
                  <span key={idx} className="text-2xl md:text-4xl font-bold text-[#1A1A1A]">
                    {chord.display}
                  </span>
                ))}
              </div>
            ) : (
              <span className={`${questionTextClass(getQuestionText())} font-bold text-[#1A1A1A]`}>
                {getQuestionText()}
              </span>
            )}
          </div>

          {/* Correct answer indicator - always reserve space */}
          <div className="h-8 mt-3 flex items-center justify-center">
            {gameState.feedback === 'incorrect' && (
              <p className="text-sm font-bold text-[#FF3B30]" data-testid="correct-answer-display">
                Correct: {getCorrectAnswerText()}
              </p>
            )}
          </div>
        </div>

        {/* Answer Area */}
        {(isChordMode || isDegreeMode) && (
          <>
            {/* Quality Switch */}
            <div className={`flex flex-wrap justify-center gap-2 mb-6 ${show7thOptions ? 'max-w-md mx-auto' : ''}`}>
              {qualityOptions.map(qo => (
                <button
                  key={qo}
                  data-testid={`quality-${qo}`}
                  onClick={() => setSelectedQuality(qo)}
                  className={`px-3 md:px-4 py-2 border-2 rounded-sm font-bold text-xs md:text-sm uppercase tracking-wider transition-all ${
                    selectedQuality === qo
                      ? 'border-[#002FA7] bg-[#002FA7] text-white'
                      : 'border-[#E5E7EB] bg-white hover:border-[#002FA7]/50 text-[#1A1A1A]'
                  }`}
                >
                  {qualityLabels[qo]}
                </button>
              ))}
            </div>

            {/* Root Note Buttons (modes 1 & 3) */}
            {isChordMode && (
              <div className="max-w-5xl mx-auto">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 text-center">Select Root Note</p>
                <div className="grid grid-cols-6 md:grid-cols-12 gap-2 md:gap-3">
                  {ALL_NOTES.map((note, idx) => (
                    <button
                      key={note}
                      data-testid={`note-button-${note}`}
                      onClick={() => handleNoteAnswer(idx)}
                      disabled={!gameState.isGameActive || gameState.feedback}
                      className="h-14 md:h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-[10px] md:text-xs font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50 px-1"
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Degree Buttons (mode 2) */}
            {isDegreeMode && (
              <div className="max-w-3xl mx-auto">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 text-center">Select Degree</p>
                <div className="grid grid-cols-7 gap-2 md:gap-3">
                  {DEGREE_NUMBERS.map((num, idx) => (
                    <button
                      key={num}
                      data-testid={`degree-button-${num}`}
                      onClick={() => handleDegreeAnswer(idx)}
                      disabled={!gameState.isGameActive || gameState.feedback}
                      className="h-16 md:h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-xl md:text-3xl font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Interval Transpose Buttons */}
        {config.mode === 'interval-transpose' && (
          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 text-center">Select Note</p>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-3">
              {ALL_NOTES.map((note) => (
                <button
                  key={note}
                  data-testid={`note-button-${note}`}
                  onClick={() => handleIntervalAnswer(note)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-sm md:text-base font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {note}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interval Recognition Buttons */}
        {config.mode === 'intervals' && (
          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 text-center">Select Interval</p>
            <div className="grid grid-cols-4 gap-3">
              {INTERVALS.map((interval) => (
                <button
                  key={interval.name}
                  data-testid={`interval-button-${interval.name}`}
                  onClick={() => handleIntervalAnswer(interval.name)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all font-bold flex flex-col items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <span className="text-2xl">{interval.name}</span>
                  <span className="text-[10px] text-[#9CA3AF] mt-1">{interval.fullName}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Guess Scale Root Note Buttons */}
        {isGuessScaleMode && (
          <div className="max-w-5xl mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 text-center">Select Root Note</p>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2 md:gap-3">
              {ALL_NOTES.map((note, idx) => (
                <button
                  key={note}
                  data-testid={`scale-root-button-${note}`}
                  onClick={() => handleScaleRootAnswer(idx)}
                  disabled={!gameState.isGameActive || gameState.feedback}
                  className="h-14 md:h-20 w-full rounded-sm border border-[#E5E7EB] bg-white hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-blue-50 transition-all text-[10px] md:text-xs font-bold flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50 px-1"
                >
                  {note}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* End Game */}
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

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={{ enabledScaleTypes, includeBorrowed, include7ths }}
        onSettingsChange={handleSettingsChange}
        mode={config.mode}
      />

      <TimeUpModal
        isOpen={showTimeUp}
        score={gameState.score}
        accuracy={gameState.totalQuestions > 0
          ? Math.round((gameState.correctAnswers / gameState.totalQuestions) * 100) : 0}
        totalQuestions={gameState.totalQuestions}
        onPlayAgain={() => navigate('/setup', { state: { mode: config.mode } })}
        onGoHome={() => navigate('/')}
      />
    </div>
  );
};

export default Game;
