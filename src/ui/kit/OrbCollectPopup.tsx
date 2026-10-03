// src/ui/kit/OrbCollectPopup.tsx
import React from 'react';
import './kit.css';

export interface OrbCollectPopupProps {
  id: string;
  current: number;
  total: number;
  x: number; // screen percentage %
  y: number; // screen percentage %
  className?: string;
}

export const OrbCollectPopup: React.FC<OrbCollectPopupProps> = ({
  current,
  total,
  x,
  y,
  className = '',
}) => {
  return (
    <div
      className={`kz-orb-collect-popup-wrapper ${className}`.trim()}
      style={{
        left: `${x}%`,
        top: `${y}%`,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="kz-orb-collect-popup">
        <div className="kz-orb-collect-popup__body">
          <span className="kz-orb-collect-popup__count">
            <span className="kz-orb-collect-popup__current">{current}</span>
            <span className="kz-orb-collect-popup__slash">/</span>
            <span className="kz-orb-collect-popup__total">{total}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
