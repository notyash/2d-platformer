// src/ui/kit/ProgressPips.tsx
import React, { useEffect, useState, useRef } from 'react';
import './kit.css';

export interface ProgressPipsProps extends React.HTMLAttributes<HTMLDivElement> {
  total: number;
  filled: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'crimson' | 'gold' | 'cyan';
}

export const ProgressPips: React.FC<ProgressPipsProps> = ({
  total,
  filled,
  size = 'md',
  variant = 'crimson',
  className = '',
  ...props
}) => {
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const prevFilledRef = useRef<number>(filled);

  const isComplete = filled >= total && total > 0;

  useEffect(() => {
    // Trigger one-time completion flash only when reaching 100% completion
    if (isComplete && prevFilledRef.current < total) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 500);
      return () => clearTimeout(timer);
    }
    prevFilledRef.current = filled;
  }, [filled, total, isComplete]);

  const pips = Array.from({ length: Math.max(0, total) }, (_, index) => {
    const isFilled = index < filled;
    return (
      <span
        key={index}
        className={`kz-pip kz-pip--${size} kz-pip--${variant} ${
          isFilled ? 'kz-pip--filled' : 'kz-pip--unfilled'
        }`}
      />
    );
  });

  return (
    <div
      className={`kz-pips ${isFlashing ? 'kz-pips--completed' : ''} ${className}`.trim()}
      aria-valuenow={filled}
      aria-valuemax={total}
      role="progressbar"
      {...props}
    >
      {pips}
    </div>
  );
};
