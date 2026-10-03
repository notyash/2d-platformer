// src/ui/LeaderboardModal.tsx
import React, { useEffect, useState } from 'react';
import { GameEventBus } from '../services/GameEventBus';
import { LeaderboardManager, type LeaderboardEntry } from '../managers/LeaderboardManager';
import { Icon } from './kit/Icon';
import './kit/kit.css';

interface LeaderboardModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen: controlledIsOpen, onClose }) => {
  const [isOpen, setIsOpen] = useState<boolean>(controlledIsOpen ?? false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Instant load from local cache
      const cached = LeaderboardManager.getInstance().getTopEntries(15);
      setEntries(cached);

      // 2. Fetch fresh live records from backend
      const live = await LeaderboardManager.getInstance().refreshLeaderboard();
      if (live && Array.isArray(live)) {
        setEntries(live);
      }
    } catch (err) {
      console.warn('[LeaderboardModal] Error fetching leaderboard entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (controlledIsOpen !== undefined) {
      setIsOpen(controlledIsOpen);
      if (controlledIsOpen) loadData();
    }
  }, [controlledIsOpen]);

  useEffect(() => {
    const bus = GameEventBus.getInstance();
    const unsub = bus.on('action:trigger', (action) => {
      if (action.type === 'OPEN_LEADERBOARD') {
        setIsOpen(true);
        loadData();
      } else if (action.type === 'LEADERBOARD_CLOSED' || action.type === 'CLOSE_MODAL' || action.type === 'RESTART_RUN') {
        setIsOpen(false);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') {
        if (!isOpen) {
          setIsOpen(true);
          loadData();
        } else {
          handleClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsub();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    GameEventBus.getInstance().emit('action:trigger', { type: 'LEADERBOARD_CLOSED' });
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="pause-modal-backdrop react-interactive" role="dialog" aria-modal="true">
      <div className="pause-modal-card leaderboard-modal-card">
        {/* Header Title */}
        <div className="modal-header">
          <div className="leaderboard-header-top" style={{ justifyContent: 'center' }}>
            <span className="modal-kanji-tag modal-kanji-tag--gold">神月 • 排行榜</span>
          </div>

          <h2 className="modal-title modal-title--gold">LEADERBOARD</h2>
          <span className="modal-subtitle">Top Speedrun Records & Scores</span>
          <div className="modal-divider modal-divider--gold" />
        </div>

        {/* Leaderboard Table Container */}
        <div className="leaderboard-table-container">
          <div className="leaderboard-table-header">
            <span className="col-rank">RANK</span>
            <span className="col-player">PLAYER / WALLET</span>
            <span className="col-time">TIME</span>
            <span className="col-score">SCORE</span>
            <span className="col-deaths">DEATHS</span>
            <span className="col-verified">STATUS</span>
          </div>

          <div className="leaderboard-table-body">
            {entries.length === 0 ? (
              <div className="leaderboard-empty-state">
                <Icon name="trophy" size={32} />
                <p className="empty-title">No Recorded Runs Yet</p>
                <span className="empty-desc">
                  Be the first warrior to conquer Stage 1 and claim the #1 spot!
                </span>
              </div>
            ) : (
              entries.map((entry, idx) => {
                const rankNum = idx + 1;
                const isTop1 = rankNum === 1;
                const isTop2 = rankNum === 2;
                const isTop3 = rankNum === 3;
                const isUnminted = entry.playerName.includes('[Unminted]');
                const cleanName = entry.playerName.replace(' [Unminted]', '');

                return (
                  <div
                    key={entry.runId || `rank-${rankNum}`}
                    className={`leaderboard-row ${isTop1 ? 'is-first' : isTop2 ? 'is-second' : isTop3 ? 'is-third' : ''}`}
                  >
                    {/* Rank */}
                    <div className="col-rank">
                      {isTop1 ? (
                        <span className="rank-badge rank-badge--1">🥇 #1</span>
                      ) : isTop2 ? (
                        <span className="rank-badge rank-badge--2">🥈 #2</span>
                      ) : isTop3 ? (
                        <span className="rank-badge rank-badge--3">🥉 #3</span>
                      ) : (
                        <span className="rank-badge">#{rankNum}</span>
                      )}
                    </div>

                    {/* Player / Wallet */}
                    <div className="col-player">
                      <span className="player-name">{cleanName}</span>
                      {entry.walletAddress && (
                        <span className="player-wallet">{entry.walletAddress}</span>
                      )}
                      {isUnminted && (
                        <span className="unminted-tag">Guest</span>
                      )}
                    </div>

                    {/* Time */}
                    <div className="col-time font-mono">
                      {entry.formattedTime || LeaderboardManager.formatTime(entry.timeMs)}
                    </div>

                    {/* Score */}
                    <div className="col-score font-mono gold">
                      {entry.score.toLocaleString()}
                    </div>

                    {/* Deaths */}
                    <div className="col-deaths font-mono">
                      {entry.deaths}
                    </div>

                    {/* Status / Whitelist */}
                    <div className="col-verified">
                      {entry.isWhitelisted ? (
                        <span className="status-badge status-badge--whitelist" title="Eligible for NFT Whitelist">
                          ✨ Whitelisted
                        </span>
                      ) : entry.verified ? (
                        <span className="status-badge status-badge--verified" title="Tamper-Proof Anti-Cheat Verified">
                          🛡️ Verified
                        </span>
                      ) : (
                        <span className="status-badge status-badge--pending">Unverified</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="leaderboard-modal-footer">
          <button
            type="button"
            className="modal-menu-btn variant-default"
            onClick={loadData}
            disabled={isLoading}
            style={{ width: 'auto', padding: '0.45rem 1.25rem' }}
          >
            <Icon name="restart" size={14} />
            <span className="btn-text">{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="modal-menu-btn variant-crimson"
            onClick={handleClose}
            style={{ width: 'auto', padding: '0.45rem 1.5rem' }}
          >
            <span className="btn-text">Close (ESC)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
