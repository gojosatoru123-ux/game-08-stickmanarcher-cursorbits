import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Pause, Volume2, VolumeX, Target, Zap, Smartphone } from 'lucide-react';
import { GameState, Arrow } from './types';
import { createInitialState, updateGameState, PLAYER_X, ARROW_SPEED_FACTOR, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './gameLogic';
import { render } from './Renderer';
import { audioSystem } from './AudioSystem';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState>(createInitialState());
  const [isStarted, setIsStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);

  const startNewGame = () => {
    setState(createInitialState());
    setIsStarted(true);
    lastTimeRef.current = performance.now();
  };

  const togglePause = () => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleShoot = useCallback((angle: number, charge: number) => {
    if (state.player.isDead || state.isGameOver || state.isPaused) return;

    const arrow: Arrow = {
      id: Math.random().toString(36).substr(2, 9),
      pos: { x: state.player.pos.x, y: state.player.pos.y + 20 },
      vel: {
        x: Math.cos(angle) * charge * ARROW_SPEED_FACTOR * 2,
        y: Math.sin(angle) * charge * ARROW_SPEED_FACTOR * 2
      },
      angle: angle,
      ownerId: 'player',
      isStuck: false,
      damage: 26
    };

    setState(prev => ({
      ...prev,
      arrows: [...prev.arrows, arrow],
      player: { ...prev.player, charge: 0 }
    }));

    if (!isMuted) audioSystem.playShoot();
  }, [state.player.isDead, state.isGameOver, state.isPaused, isMuted, state.player.pos.x, state.player.pos.y]);

  // Game Loop
  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = (time - lastTimeRef.current) / 16.67; // Normalize to 60fps
      setState(prev => {
        const next = updateGameState(prev, deltaTime);
        
        // Play sounds based on state changes
        if (!isMuted) {
          if (next.score > prev.score) audioSystem.playHit();
          if (next.isGameOver && !prev.isGameOver) audioSystem.playGameOver();
          if (next.wave > prev.wave) audioSystem.playWaveStart();
        }
        
        return next;
      });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isStarted && !state.isPaused && !state.isGameOver) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isStarted, state.isPaused, state.isGameOver]);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', resize);
    resize();

    render(ctx, state, canvas.width, canvas.height);

    return () => window.removeEventListener('resize', resize);
  }, [state]);

  // Input Handling
  useEffect(() => {
    const getVirtualCoords = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      
      const scaleX = canvas.width / VIRTUAL_WIDTH;
      const scaleY = canvas.height / VIRTUAL_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      
      const offsetX = (canvas.width - VIRTUAL_WIDTH * scale) / 2;
      const offsetY = (canvas.height - VIRTUAL_HEIGHT * scale) / 2;
      
      return {
        x: (clientX - offsetX) / scale,
        y: (clientY - offsetY) / scale
      };
    };

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      if (!isStarted || state.isGameOver || state.isPaused || isPortrait) return;
      setState(prev => ({ ...prev, player: { ...prev.player, charge: 0.1 } }));
    };

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isStarted || state.isGameOver || state.isPaused || isPortrait) return;
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const virtual = getVirtualCoords(clientX, clientY);
      const dx = virtual.x - PLAYER_X;
      const dy = virtual.y - (state.player.pos.y + 20);
      const angle = Math.atan2(dy, dx);
      
      setState(prev => {
        if (prev.player.charge > 0) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const charge = Math.min(1, dist / 200);
          if (!isMuted && Math.abs(charge - prev.player.charge) > 0.1) audioSystem.playBowTension(charge);
          return { ...prev, player: { ...prev.player, aimAngle: angle, charge } };
        }
        return { ...prev, player: { ...prev.player, aimAngle: angle } };
      });
    };

    const handleMouseUp = (e: MouseEvent | TouchEvent) => {
      if (!isStarted || state.isGameOver || state.isPaused || isPortrait) return;
      setState(prev => {
        if (prev.player.charge > 0) {
          handleShoot(prev.player.aimAngle, prev.player.charge);
        }
        return prev;
      });
    };

    // Keyboard Controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isStarted || state.isGameOver || state.isPaused || isPortrait) return;
      
      if (e.code === 'Space' || e.code === 'Enter') {
        if (state.player.charge === 0) {
          setState(prev => ({ ...prev, player: { ...prev.player, charge: 0.1 } }));
        } else {
          setState(prev => ({ 
            ...prev, 
            player: { ...prev.player, charge: Math.min(1, prev.player.charge + 0.05) } 
          }));
        }
      }

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        setState(prev => ({ ...prev, player: { ...prev.player, aimAngle: prev.player.aimAngle - 0.05 } }));
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        setState(prev => ({ ...prev, player: { ...prev.player, aimAngle: prev.player.aimAngle + 0.05 } }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        setState(prev => {
          if (prev.player.charge > 0) {
            handleShoot(prev.player.aimAngle, prev.player.charge);
          }
          return prev;
        });
      }
      if (e.code === 'Escape') togglePause();
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isStarted, state.isGameOver, state.isPaused, isPortrait, handleShoot, isMuted, state.player.pos.y, state.player.charge]);

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans select-none">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* HUD */}
      {isStarted && !state.isGameOver && (
        <div className="absolute top-4 left-4 right-4 md:top-8 md:left-8 md:right-8 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-2">
            <div className="bg-white/80 apple-blur apple-shadow px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl flex items-center gap-3 md:gap-4">
              <div className="flex flex-col">
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Score</span>
                <span className="text-lg md:text-2xl font-bold text-gray-900">{state.score}</span>
              </div>
              <div className="w-px h-6 md:h-8 bg-gray-200" />
              <div className="flex flex-col">
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Wave</span>
                <span className="text-lg md:text-2xl font-bold text-apple-accent">{state.wave}</span>
              </div>
              <div className="hidden sm:block w-px h-6 md:h-8 bg-gray-200" />
              <div className="hidden sm:flex flex-col">
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Best</span>
                <span className="text-lg md:text-2xl font-bold text-gray-400">{state.highScore}</span>
              </div>
            </div>

            <div className="bg-white/80 apple-blur apple-shadow px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl flex flex-col gap-1 w-48 md:w-64">
              <div className="flex justify-between items-center">
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Health</span>
                <span className="text-[10px] md:text-xs font-bold text-gray-600">{Math.ceil(state.player.health)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-apple-accent"
                  initial={{ width: "100%" }}
                  animate={{ width: `${(state.player.health / state.player.maxHealth) * 100}%` }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  style={{ backgroundColor: state.player.health < 30 ? '#ff3b30' : '#0071e3' }}
                />
              </div>
            </div>
            
            <AnimatePresence>
              {state.combo > 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="bg-apple-accent text-white px-4 py-2 rounded-xl flex flex-col gap-1 w-fit apple-shadow"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={16} fill="currentColor" />
                    <span className="font-bold">{state.combo}x COMBO</span>
                  </div>
                  <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-white"
                      initial={{ width: "100%" }}
                      animate={{ width: `${Math.max(0, (3000 - (Date.now() - state.lastKillTime)) / 3000 * 100)}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-2 md:gap-4 pointer-events-auto">
            <button 
              onClick={togglePause}
              className="w-10 h-10 md:w-12 md:h-12 bg-white/80 apple-blur apple-shadow rounded-full flex items-center justify-center text-gray-900 hover:bg-white transition-colors"
            >
              {state.isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
            </button>
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10 md:w-12 md:h-12 bg-white/80 apple-blur apple-shadow rounded-full flex items-center justify-center text-gray-900 hover:bg-white transition-colors"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Start Screen */}
      <AnimatePresence>
        {!isStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/40 apple-blur flex items-center justify-center z-50"
          >
            <div className="max-w-md w-[90%] p-6 md:p-12 bg-white apple-shadow rounded-[30px] md:rounded-[40px] text-center flex flex-col items-center gap-6 md:gap-8">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-apple-accent/10 rounded-2xl md:rounded-3xl flex items-center justify-center text-apple-accent animate-float">
                <Target size={32} className="md:w-12 md:h-12" />
              </div>
              <div className="space-y-1 md:space-y-2">
                <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-gray-900">Arrow Master</h1>
                <p className="text-xs md:text-base text-gray-500">Stickman Duel: Master the bow.</p>
              </div>
              
              <div className="w-full space-y-2 md:space-y-4 text-[10px] md:text-sm text-gray-400">
                <div className="flex justify-between border-b border-gray-100 pb-1 md:pb-2">
                  <span>Mouse / Touch</span>
                  <span className="text-gray-600">Drag & Release</span>
                </div>
                <div className="hidden md:flex justify-between border-b border-gray-100 pb-2">
                  <span>Aim</span>
                  <span className="text-gray-600">WASD / Arrows</span>
                </div>
                <div className="hidden md:flex justify-between">
                  <span>Shoot</span>
                  <span className="text-gray-600">Space / Enter</span>
                </div>
              </div>

              <button 
                onClick={startNewGame}
                className="w-full py-4 md:py-5 bg-apple-accent text-white rounded-xl md:rounded-2xl font-bold text-base md:text-lg apple-shadow hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Play size={18} fill="currentColor" />
                Start Duel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Screen */}
      <AnimatePresence>
        {state.isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/20 apple-blur flex items-center justify-center z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-[90%] p-6 md:p-12 bg-white apple-shadow rounded-[30px] md:rounded-[40px] text-center flex flex-col items-center gap-6 md:gap-8"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                <RotateCcw size={32} className="md:w-10 md:h-10" />
              </div>
              
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Battle Ended</h2>
                <p className="text-xs md:text-base text-gray-500">You fought with honor.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4 w-full">
                <div className="bg-gray-50 p-4 md:p-6 rounded-2xl md:rounded-3xl">
                  <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Final Score</span>
                  <span className="text-xl md:text-3xl font-bold text-gray-900">{state.score}</span>
                </div>
                <div className="bg-gray-50 p-4 md:p-6 rounded-2xl md:rounded-3xl">
                  <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Max Combo</span>
                  <span className="text-xl md:text-3xl font-bold text-gray-900">{state.maxCombo}</span>
                </div>
              </div>

              <button 
                onClick={startNewGame}
                className="w-full py-4 md:py-5 bg-gray-900 text-white rounded-xl md:rounded-2xl font-bold text-base md:text-lg apple-shadow hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                Try Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Screen */}
      <AnimatePresence>
        {state.isPaused && !state.isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/40 apple-blur flex items-center justify-center z-40"
          >
            <div className="text-center space-y-4 md:space-y-8">
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-gray-900">PAUSED</h2>
              <button 
                onClick={togglePause}
                className="w-16 h-16 md:w-24 md:h-24 bg-apple-accent text-white rounded-full flex items-center justify-center apple-shadow hover:scale-110 active:scale-95 transition-all mx-auto"
              >
                <Play size={32} fill="currentColor" className="ml-1 md:ml-2 md:w-10 md:h-10" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orientation Lock Overlay */}
      <AnimatePresence>
        {isPortrait && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white apple-blur flex flex-col items-center justify-center z-[100] text-center p-8"
          >
            <motion.div
              animate={{ rotate: 90 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="text-apple-accent mb-8"
            >
              <Smartphone size={80} />
            </motion.div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Rotate Your Device</h2>
            <p className="text-gray-500 max-w-xs">
              This game is designed for landscape mode. Please rotate your device for the best experience.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
