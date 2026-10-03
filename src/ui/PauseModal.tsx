// src/ui/PauseModal.tsx
import React, { useEffect, useState } from 'react';
import { GameEventBus, type GameState, type GameStats } from '../services/GameEventBus';
import { useMenuNavigation } from '../hooks/useMenuNavigation';
import { Icon } from './kit/Icon';

interface PauseModalProps {
  gameState: GameState;
  stats: GameStats;
}

interface MenuEntry {
  id: string;
  label: string;
  subLabel?: React.ReactNode;
  action: () => void;
  variant?: 'primary' | 'crimson' | 'gold' | 'default';
}

export const PauseModal: React.FC<PauseModalProps> = ({ gameState, stats }) => {
  const [hasCheckpoint, setHasCheckpoint] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const isOpen = gameState === 'PAUSED' && !isLeaderboardOpen;

  useEffect(() => {
    const bus = GameEventBus.getInstance();
    const unsubCp = bus.on('checkpoint:status', (status) => {
      setHasCheckpoint(status);
    });
    const unsubSound = bus.on('sound:status', (enabled) => {
      setSoundEnabled(enabled);
    });
    const unsubAction = bus.on('action:trigger', (action) => {
      if (action.type === 'OPEN_LEADERBOARD') {
        setIsLeaderboardOpen(true);
      } else if (action.type === 'LEADERBOARD_CLOSED' || action.type === 'RESUME_GAME' || action.type === 'RESTART_RUN') {
        setIsLeaderboardOpen(false);
      }
    });

    return () => {
      unsubCp();
      unsubSound();
      unsubAction();
    };
  }, []);

  const handleResume = () => {
    GameEventBus.getInstance().emit('action:trigger', { type: 'RESUME_GAME' });
  };

  const handleRespawnCheckpoint = () => {
    GameEventBus.getInstance().emit('action:trigger', { type: 'RESPAWN_CHECKPOINT' });
  };

  const handleRestart = () => {
    GameEventBus.getInstance().emit('action:trigger', { type: 'RESTART_RUN' });
  };

  const handleToggleSound = () => {
    GameEventBus.getInstance().emit('action:trigger', { type: 'TOGGLE_SOUND' });
  };

  const handleOpenLeaderboard = () => {
    GameEventBus.getInstance().emit('action:trigger', { type: 'OPEN_LEADERBOARD' });
  };

  // Construct dynamic menu entries list
  const menuOptions: MenuEntry[] = [
    {
      id: 'resume',
      label: 'Resume Game',
      subLabel: <Icon name="play" size={14} />,
      variant: 'primary',
      action: handleResume,
    },
  ];

  if (hasCheckpoint) {
    menuOptions.push({
      id: 'respawn',
      label: 'Respawn at Checkpoint',
      subLabel: <Icon name="checkpoint" size={14} />,
      variant: 'gold',
      action: handleRespawnCheckpoint,
    });
  }

  menuOptions.push(
    {
      id: 'leaderboard',
      label: 'Global Leaderboard',
      subLabel: <Icon name="trophy" size={14} />,
      variant: 'default',
      action: handleOpenLeaderboard,
    },
    {
      id: 'sound',
      label: `Audio: ${soundEnabled ? 'ON' : 'MUTED'}`,
      subLabel: <Icon name={soundEnabled ? 'volume' : 'volume-mute'} size={14} />,
      variant: 'default',
      action: handleToggleSound,
    },
    {
      id: 'restart',
      label: 'Restart Run',
      subLabel: <Icon name="restart" size={14} />,
      variant: 'crimson',
      action: handleRestart,
    }
  );

  const { selectedIndex, getItemProps } = useMenuNavigation({
    isOpen,
    itemCount: menuOptions.length,
    onSelect: (index) => {
      const option = menuOptions[index];
      if (option) {
        option.action();
      }
    },
    onClose: handleResume,
  });

  if (!isOpen) return null;

  return (
    <div className="pause-modal-backdrop react-interactive" role="dialog" aria-modal="true">
      <div className="pause-modal-card">
        {/* Japanese + English Title Banner */}
        <div className="modal-header">
          <span className="modal-kanji-tag">神月 • 一時停止</span>
          <h2 className="modal-title">GAME PAUSED</h2>
          <div className="modal-divider" />
        </div>

        {/* Current Run Quick Stats */}
        <div className="modal-stats-grid">
          <div className="modal-stat-box">
            <Icon name="coin" size={16} />
            <span className="stat-box-label">COINS</span>
            <span className="stat-box-value gold">{stats.coins}</span>
          </div>
          <div className="modal-stat-box">
            <Icon name="sword" size={16} />
            <span className="stat-box-label">KILLS</span>
            <span className="stat-box-value crimson">{stats.kills}</span>
          </div>
          <div className="modal-stat-box">
            <Icon name="skull" size={16} />
            <span className="stat-box-label">DEATHS</span>
            <span className="stat-box-value">{stats.deaths}</span>
          </div>
        </div>

        {/* Action Buttons Menu */}
        <div className="modal-menu-list">
          {menuOptions.map((opt, index) => {
            const isSelected = selectedIndex === index;
            const itemProps = getItemProps(index);

            return (
              <button
                key={opt.id}
                type="button"
                className={`modal-menu-btn variant-${opt.variant || 'default'} ${
                  isSelected ? 'is-selected' : ''
                }`}
                {...itemProps}
              >
                <span className="btn-text">{opt.label}</span>
                {opt.subLabel && <span className="btn-keyhint">{opt.subLabel}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
