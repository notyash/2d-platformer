// src/ui/ReactOverlay.tsx
import React, { useEffect, useState } from 'react';
import { GameEventBus, type GameState, type GameStats } from '../services/GameEventBus';
import { KamiZukiHUD } from './KamiZukiHUD';
import { PauseModal } from './PauseModal';
import { DebugReadout } from './DebugReadout';

export const ReactOverlay: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('PLAYING');
  const [stats, setStats] = useState<GameStats>({ coins: 0, kills: 0, deaths: 0 });

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
      {/* Top KamiZuki HUD (Coins, Kills, Deaths chips, Space Grotesk timer, Actions) */}
      <KamiZukiHUD />

      {/* Pause Modal (First user of useMenuNavigation) */}
      <PauseModal gameState={gameState} stats={stats} />

      {/* Dev-Only Event Bus Overlay (toggled with backtick key `) */}
      <DebugReadout />
    </div>
  );
};
