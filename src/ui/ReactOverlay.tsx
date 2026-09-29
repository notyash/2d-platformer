// src/ui/ReactOverlay.tsx
import React, { useEffect, useState } from 'react';
import { GameEventBus, type GameState, type GameStats } from '../services/GameEventBus';
import { KamiZukiHUD } from './KamiZukiHUD';
import { PauseModal } from './PauseModal';
import { DebugReadout } from './DebugReadout';
import { UIKitShowcase } from './UIKitShowcase';

export const ReactOverlay: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const [gameState, setGameState] = useState<GameState>('PLAYING');
  const [stats, setStats] = useState<GameStats>({ coins: 0, kills: 0, deaths: 0 });

  // Check if URL specifies /ui-kit showcase
  const [showUIKit, setShowUIKit] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && isDev) {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      return path.includes('ui-kit') || search.includes('ui-kit') || hash.includes('ui-kit');
    }
    return false;
  });

  useEffect(() => {
    const bus = GameEventBus.getInstance();

    const unsubState = bus.on('game:state', (newState) => {
      setGameState(newState);
    });

    const unsubStats = bus.on('stats:changed', (newStats) => {
      setStats(newStats);
    });

    return () => {
      unsubState();
      unsubStats();
    };
  }, []);

  return (
    <div className="react-ui-overlay">
      {/* Top KamiZuki HUD */}
      <KamiZukiHUD />

      {/* Pause Modal */}
      <PauseModal gameState={gameState} stats={stats} />

      {/* Dev-Only Event Bus Overlay (toggled with backtick `) */}
      {isDev && <DebugReadout onOpenUIKit={() => setShowUIKit(true)} />}

      {/* Dev-Only /ui-kit Showcase Gallery */}
      {isDev && showUIKit && <UIKitShowcase onClose={() => setShowUIKit(false)} />}
    </div>
  );
};
