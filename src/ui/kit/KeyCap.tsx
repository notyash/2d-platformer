// src/ui/kit/KeyCap.tsx
import React from 'react';
import './kit.css';

export interface KeyCapProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md';
  isPressed?: boolean;
  children: React.ReactNode;
}

export const KeyCap: React.FC<KeyCapProps> = ({
  size = 'sm',
  isPressed = false,
  className = '',
  children,
  ...props
}) => {
  const sizeClass = `kz-keycap--${size}`;
  const pressedClass = isPressed ? 'kz-keycap--pressed' : '';

  return (
    <span className={`kz-keycap ${sizeClass} ${pressedClass} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
};
