// src/ui/kit/Icon.tsx
import React from 'react';
import './kit.css';

export type IconName =
  | 'coin'
  | 'sword'
  | 'skull'
  | 'volume'
  | 'volume-mute'
  | 'restart'
  | 'menu'
  | 'gun'
  | 'totem'
  | 'orb'
  | 'close'
  | 'check'
  | 'arrow-up'
  | 'arrow-down'
  | 'trophy';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 16,
  color = 'currentColor',
  className = '',
  style,
  ...props
}) => {
  const renderPath = () => {
    switch (name) {
      case 'coin':
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
          </>
        );

      case 'sword':
        return (
          <>
            <path d="M14.5 17.5L3 6V3H6L17.5 14.5" />
            <path d="M13 19L19 13" />
            <path d="M16 16L21 21" />
            <path d="M19 21L21 19" />
          </>
        );

      case 'skull':
        return (
          <>
            <path d="M12 3C7.58 3 4 6.58 4 11C4 13.5 5.15 15.73 7 17.15V20C7 20.55 7.45 21 8 21H16C16.55 21 17 20.55 17 20V17.15C18.85 15.73 20 13.5 20 11C20 6.58 16.42 3 12 3Z" />
            <circle cx="9" cy="11" r="1.5" fill="currentColor" />
            <circle cx="15" cy="11" r="1.5" fill="currentColor" />
            <path d="M10 17V19" />
            <path d="M14 17V19" />
          </>
        );

      case 'volume':
        return (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        );

      case 'volume-mute':
        return (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        );

      case 'restart':
        return (
          <>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </>
        );

      case 'menu':
        return (
          <>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </>
        );

      case 'gun':
        return (
          <>
            <path d="M3 8H17V12H13V19H9V12H3V8Z" />
            <path d="M17 9H21V11H17" />
            <path d="M7 8V5H13V8" />
          </>
        );

      case 'totem':
        return (
          <>
            <path d="M12 2L4 7V13C4 18 12 22 12 22C12 22 20 18 20 13V7L12 2Z" />
            <path d="M12 6V18" />
            <path d="M8 10H16" />
          </>
        );

      case 'orb':
        return (
          <>
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path d="M12 2V4" />
            <path d="M12 20V22" />
            <path d="M2 12H4" />
            <path d="M20 12H22" />
          </>
        );

      case 'close':
        return (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        );

      case 'check':
        return (
          <>
            <polyline points="20 6 9 17 4 12" />
          </>
        );

      case 'arrow-up':
        return (
          <>
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </>
        );

      case 'arrow-down':
        return (
          <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </>
        );

      case 'trophy':
        return (
          <>
            <path d="M8 21h8m-4-4v4M6 4h12v4a6 6 0 0 1-12 0V4Z" />
            <path d="M6 6H3v2a4 4 0 0 0 4 4h0M18 6h3v2a4 4 0 0 1-4 4h0" />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke={color}
      className={`kz-icon ${className}`.trim()}
      style={style}
      aria-hidden="true"
      {...props}
    >
      {renderPath()}
    </svg>
  );
};
