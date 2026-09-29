import Phaser from 'phaser';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MainStageScene } from './scenes/MainStageScene';
import { ReactOverlay } from './ui/ReactOverlay';

// Suppress harmless Phaser tilemap dimension warnings for single backdrop images
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Image tile area not tile size multiple in:')) {
    return;
  }
  originalWarn(...args);
};

const BASE_WIDTH = 854; // 16:9 standard game resolution
const BASE_HEIGHT = 480; // 15 vertical tiles x 32px

export type DisplayMode = 'fullscreen' | 'framed';

export function getDisplayMode(): DisplayMode {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    if (modeParam === 'framed') return 'framed';
    if ((window as any).__KAMIZUKI_MODE__ === 'framed') return 'framed';
  }
  return 'fullscreen';
}

export function setDisplayMode(mode: DisplayMode) {
  if (typeof window !== 'undefined') {
    (window as any).__KAMIZUKI_MODE__ = mode;
    const masterWrapper = document.getElementById('game-master-wrapper');
    if (masterWrapper) {
      masterWrapper.className = `game-master-wrapper mode-${mode}`;
    }
  }
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi|Tablet/i;
  const isMobileUA = mobileRegex.test(userAgent);
  const isTouchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  const isCoarsePointer = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse) and (hover: none)').matches);
  const isSmallTouchDevice = Boolean('ontouchstart' in window && (window.innerWidth <= 1024 || window.screen.width <= 1024));

  return isMobileUA || isTouchMac || isCoarsePointer || isSmallTouchDevice;
}

function showMobileBlocker() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="mobile-blocker">
      <div class="mobile-card">
        <div class="mobile-icon">⛩️</div>
        <h1 class="mobile-title">KAMIZUKI</h1>
        <div class="mobile-badge">DESKTOP ONLY</div>
        <p class="mobile-desc">
          KamiZuki platformer is designed exclusively for precision desktop keyboard & mouse controls. Mobile and touchscreen devices are not supported.
        </p>
        <div class="mobile-reqs">
          <div class="req-item"><span class="req-icon">⌨️</span><span>Keyboard Controls (WASD / Arrows / Space)</span></div>
          <div class="req-item"><span class="req-icon">🖱️</span><span>Mouse Blaster Controls (Left-Click)</span></div>
          <div class="req-item"><span class="req-icon">🖥️</span><span>Desktop / Laptop Display</span></div>
        </div>
        <div class="mobile-footer">Please open this game on a desktop or laptop computer to play.</div>
      </div>
    </div>
  `;
}

// Global Singletons to guard against double instantiation under StrictMode or HMR
let activeGame: Phaser.Game | null = null;
let activeReactRoot: Root | null = null;

async function bootstrap() {
  if (isMobileDevice()) {
    showMobileBlocker();
    return;
  }

  // 1. Wait for document.fonts.ready before initial render (with 1s timeout guard)
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 1000)),
      ]);
    } catch {
      // Font load fallback
    }
  }

  // 2. Tear down any existing instances (StrictMode / HMR guard)
  if (activeGame) {
    activeGame.destroy(true);
    activeGame = null;
  }
  if (activeReactRoot) {
    activeReactRoot.unmount();
    activeReactRoot = null;
  }

  const app = document.getElementById('app');
  if (!app) return;

  const displayMode = getDisplayMode();

  // 3. Build unified layout container: Single Source of Truth (#game-stage)
  app.innerHTML = `
    <div class="game-master-wrapper mode-${displayMode}" id="game-master-wrapper">
      <div id="game-stage" class="game-stage">
        <div id="game-canvas-host" class="game-canvas-host"></div>
        <div id="react-overlay-root"></div>
      </div>
    </div>
  `;

  const canvasHost = document.getElementById('game-canvas-host');
  const stage = document.getElementById('game-stage');
  const reactRootEl = document.getElementById('react-overlay-root');

  if (!canvasHost || !stage || !reactRootEl) return;

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
    parent: 'game-canvas-host',
    scale: {
      mode: Phaser.Scale.FIT,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
    },
    fps: {
      target: 60,
      min: 30,
      smoothStep: true,
    },
    render: {
      powerPreference: 'high-performance',
      batchSize: 4096,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 800 },
        debug: false,
      },
    },
    scene: [MainStageScene],
  };

  // 4. Initialize Phaser Game
  activeGame = new Phaser.Game(config);

  // 5. Mount React Overlay UI
  activeReactRoot = createRoot(reactRootEl);
  activeReactRoot.render(React.createElement(ReactOverlay));
}

// Start application bootstrap
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootstrap());
  } else {
    bootstrap();
  }
}
