// =============================================================================
// INTRODUCTION DINO - MAIN ENTRY POINT
// Initializes and mounts the Chrome Dino runner game
// =============================================================================

import { GameEngine } from './engine.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas');
  const narrativeTrack = document.getElementById('narrative-track');
  const instructionBar = document.getElementById('instruction-bar');
  const muteBtn = document.getElementById('mute-btn');

  const engine = new GameEngine(canvas, narrativeTrack, instructionBar, muteBtn);
  // Attach engine to window immediately for debugging and programmatic test access
  window.__INTRO_DINO_ENGINE__ = engine;
  await engine.init();
});

