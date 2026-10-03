// src/ui/VictoryModal.tsx
import React, { useEffect, useState } from 'react';
import { GameEventBus, type GameState, type GameStats } from '../services/GameEventBus';
import { useMenuNavigation } from '../hooks/useMenuNavigation';
import { Icon } from './kit/Icon';
import './kit/kit.css';

interface VictoryModalProps {
  gameState: GameState;
  stats: GameStats;
  timeString?: string;
}

interface MenuEntry {
  id: string;
  label: string;
  subLabel?: React.ReactNode;
  action: () => void;
  variant?: 'primary' | 'crimson' | 'gold' | 'default';
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ gameState, stats, timeString }) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const isOpen = gameState === 'VICTORY' && !isLeaderboardOpen;

  useEffect(() => {
    const bus = GameEventBus.getInstance();
    const unsubSound = bus.on('sound:status', (enabled) => {
      setSoundEnabled(enabled);
    });
    const unsubAction = bus.on('action:trigger', (action) => {
      if (action.type === 'OPEN_LEADERBOARD') {
        setIsLeaderboardOpen(true);
      } else if (action.type === 'LEADERBOARD_CLOSED' || action.type === 'RESTART_RUN') {
        setIsLeaderboardOpen(false);
      }
    });

    return () => {
      unsubSound();
      unsubAction();
    };
  }, []);

  const handleRestart = () => {
    GameEventBus.getInstance().emit('action:trigger', { type: 'RESTART_RUN' });
  };

  const handleOpenLeaderboard = () => {
    GameEventBus.getInstance().emit('action:trigger', { type: 'OPEN_LEADERBOARD' });
  };

  const handleToggleSound = () => {
    GameEventBus.getInstance().emit('action:trigger', { type: 'TOGGLE_SOUND' });
  };

  const menuOptions: MenuEntry[] = [
    {
      id: 'restart',
      label: 'Restart Run',
      subLabel: <Icon name="restart" size={14} />,
      variant: 'crimson',
      action: handleRestart,
    },
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
  ];

  const { selectedIndex, getItemProps } = useMenuNavigation({
    isOpen,
    itemCount: menuOptions.length,
    onSelect: (index) => {
      const option = menuOptions[index];
      if (option) {
        option.action();
      }
    },
    onClose: handleRestart,
  });

  if (!isOpen) return null;

  return (
    <div className="pause-modal-backdrop react-interactive" role="dialog" aria-modal="true">
      <div className="pause-modal-card victory-modal-card">
        {/* Japanese + English Title Banner */}
        <div className="modal-header">
          <span className="modal-kanji-tag modal-kanji-tag--gold">神月 • 勝利</span>
          <h2 className="modal-title modal-title--gold">STAGE COMPLETE!</h2>
          <span className="modal-subtitle">Orb of Victory Secured • Run Submitted!</span>
          <div className="modal-divider modal-divider--gold" />
        </div>

        {/* Victory Run Stats Grid */}
        <div className="modal-stats-grid">
          <div className="modal-stat-box">
            <Icon name="trophy" size={16} />
            <span className="stat-box-label">TIME</span>
            <span className="stat-box-value gold">{timeString || '00:00.00'}</span>
          </div>
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
