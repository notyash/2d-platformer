// src/ui/kit/PromptChip.tsx
import React from 'react';
import { Panel } from './Panel';
import { KeyCap } from './KeyCap';
import './kit.css';

export interface PromptChipProps {
  keyName: string;
  label: string;
  variant?: 'default' | 'warning' | 'crimson';
  className?: string;
}

export const PromptChip: React.FC<PromptChipProps> = ({
  keyName,
  label,
  variant = 'warning',
  className = '',
}) => {
  return (
    <Panel
      variant="default"
      className={`kz-prompt-chip kz-prompt-chip--${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="kz-prompt-chip__body">
        <KeyCap size="sm">{keyName}</KeyCap>
        <span className="kz-prompt-chip__label">{label}</span>
      </div>
    </Panel>
  );
};
