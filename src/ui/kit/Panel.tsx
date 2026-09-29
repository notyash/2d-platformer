// src/ui/kit/Panel.tsx
import React from 'react';
import './kit.css';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'crimson-border' | 'parchment';
  as?: React.ElementType;
  children?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  variant = 'default',
  as: Component = 'div',
  className = '',
  children,
  ...props
}) => {
  const variantClass = `kz-panel--${variant}`;

  return (
    <Component className={`kz-panel ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
};
