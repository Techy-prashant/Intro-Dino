// =============================================================================
// INTRODUCTION DINO - FULLSCREEN CORE ENGINE
// 60 FPS, proportional scaling, soothing pacing, and continuous horizontal narrative
// =============================================================================

import { CONFIG, isMobileLayout } from './config.js';
import { ASSETS } from './assets.js';
import { Trex, TrexStatus } from './physics.js';
import { ObstacleManager } from './obstacles.js';
import { Horizon } from './horizon.js';
import { CheckpointManager } from './checkpoints.js';
import { AudioManager } from './audio.js';
import { PersistenceManager } from './persistence.js';
import { SPRITE_DEFINITIONS } from './sprites.js';

export const GameState = {
  START_SCREEN: 'START_SCREEN',
  PLAYING: 'PLAYING',
  CRASHED: 'CRASHED',
};

export class GameEngine {
  constructor(canvas, narrativeTrackEl, instructionBarEl, muteBtnEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.narrativeTrackEl = narrativeTrackEl;
    this.instructionBarEl = instructionBarEl;
    this.muteBtnEl = muteBtnEl;

    // Subsystems
    this.audio = new AudioManager();
    this.trex = new Trex(canvas);
    this.obstacleManager = new ObstacleManager(canvas);
    this.horizon = new Horizon(canvas);
    this.checkpoints = new CheckpointManager(narrativeTrackEl);

    // Game state (ALWAYS fresh on load / refresh)
    this.state = GameState.START_SCREEN;
    this.speed = CONFIG.game.speed;
    this.score = 0;
    this.distanceRan = 0;
    this.highScore = PersistenceManager.getHighScore();
    this.horizon.setHighScore(this.highScore);

    // Fullscreen scaling factors
    this.scale = 2.0;
    this.groundBaselineY = 400;

    // Day / Night cycle
    this.isNightMode = false;

    // Sprite Images
    this.sprite1x = new Image();
    this.sprite2x = new Image();
    this.isHiDpi = window.devicePixelRatio > 1;
    this.activeSprite = this.isHiDpi ? this.sprite2x : this.sprite1x;
    this.assetsLoaded = false;

    // Timing
    this.lastTime = 0;
    this.rafId = null;

    // Touch input
    this.touchStartY = 0;
    this.isTouchDucking = false;
    this.isTouchOnInteractive = false;
    this.ignoreTouchUntil = 0;
  }

  async init() {
    this.setupResolution();
    this.setupEventListeners();
    await this.loadSpriteAssets();

    // Try playing startup jingle on load if browser permits
    this.audio.tryAutoPlayStartup();

    // Initial silent render of start screen
    this.render();

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  setupResolution() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    this.isHiDpi = dpr > 1;
    this.activeSprite = this.isHiDpi ? this.sprite2x : this.sprite1x;

    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;

    // Ground baseline sits naturally at ~72% of viewport height
    this.groundBaselineY = Math.round(H * 0.72);

    // Desktop scale calculation (preserved exactly for desktop layouts)
    const desktopScale = Math.round(Math.max(1.4, Math.min(2.5, H / 380)) * 10) / 10;
    const isMobile = isMobileLayout(W, H);

    if (isMobile) {
      // Mobile / narrow screen: reduce gameplay scale to ~80-85% of desktop scale for spaciousness,
      // comfort, and increased obstacle visibility while preserving crisp pixel art
      const mobileTarget = desktopScale * 0.82;
      const maxMobileScale = Math.min(1.75, Math.max(1.25, W / 235));
      this.scale = Math.round(Math.min(maxMobileScale, mobileTarget) * 10) / 10;
    } else {
      this.scale = desktopScale;
    }

    this.trex.setEnvironment(this.groundBaselineY, this.scale);
    this.obstacleManager.setEnvironment(this.groundBaselineY, this.scale);
    this.horizon.setEnvironment(this.groundBaselineY, this.scale);

    if (this.state === GameState.CRASHED) {
      this.renderGameOverPanel(true);
    }
  }

  loadSpriteAssets() {
    return new Promise((resolve) => {
      let loaded = 0;
      const onLoad = () => {
        loaded++;
        if (loaded >= 2) {
          this.assetsLoaded = true;
          resolve();
        }
      };

      this.sprite1x.onload = onLoad;
      this.sprite2x.onload = onLoad;
      this.sprite1x.src = ASSETS.SPRITE_1X;
      this.sprite2x.src = ASSETS.SPRITE_2X;
    });
  }

  setupEventListeners() {
    // First user gesture listener to play welcoming startup jingle if autoplay was blocked
    const onFirstUserGesture = () => {
      window.removeEventListener('keydown', onFirstUserGesture, true);
      window.removeEventListener('pointerdown', onFirstUserGesture, true);
      window.removeEventListener('touchstart', onFirstUserGesture, true);

      this.audio.init().then(() => {
        if (!this.audio.hasPlayedStartup && this.state === GameState.START_SCREEN) {
          this.audio.playStartupMusic();
        }
      });
    };
    window.addEventListener('keydown', onFirstUserGesture, true);
    window.addEventListener('pointerdown', onFirstUserGesture, true);
    window.addEventListener('touchstart', onFirstUserGesture, true);

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Fullscreen touch controls
    window.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

    // Window resize
    window.addEventListener('resize', () => {
      this.setupResolution();
    });

    // Page visibility & focus handling (reset touch state and prevent accidental jump when returning from external profile tabs)
    const onVisibilityOrFocusReset = () => {
      this.lastTime = performance.now();
      this.isTouchOnInteractive = false;
      this.isTouchDucking = false;
      this.ignoreTouchUntil = performance.now() + 350;
    };
    document.addEventListener('visibilitychange', onVisibilityOrFocusReset);
    window.addEventListener('focus', onVisibilityOrFocusReset);

    // Game Over Retry button & Modal click handlers
    const retryBtn = document.getElementById('game-over-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleAction();
      });
    }

    const gameOverPanel = document.getElementById('game-over-panel');
    if (gameOverPanel) {
      gameOverPanel.addEventListener('click', (e) => {
        if (this.state === GameState.CRASHED) {
          this.handleAction();
        }
      });
    }

    // Mute button
    if (this.muteBtnEl) {
      this.updateMuteIcon();
      this.muteBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMute();
      });
    }
  }

  toggleMute() {
    const isMuted = this.audio.toggleMute();
    this.updateMuteIcon();
  }

  updateMuteIcon() {
    if (!this.muteBtnEl) return;
    if (this.audio.isMuted) {
      this.muteBtnEl.setAttribute('aria-label', 'Sound Muted (Press M)');
      this.muteBtnEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
    } else {
      this.muteBtnEl.setAttribute('aria-label', 'Sound On (Press M)');
      this.muteBtnEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    }
  }

  handleKeyDown(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      this.handleAction();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      if (this.state === GameState.PLAYING) {
        this.trex.setDuck(true);
      }
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this.toggleMute();
    }
  }

  handleKeyUp(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (this.state === GameState.PLAYING) {
        this.trex.endJump();
      }
    } else if (e.code === 'ArrowDown') {
      if (this.state === GameState.PLAYING) {
        this.trex.setDuck(false);
      }
    }
  }

  isInteractiveTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    return Boolean(
      target.closest('a') ||
      target.closest('button') ||
      target.closest('#mute-btn') ||
      target.closest('#game-over-panel') ||
      target.closest('.checkpoint-image-link') ||
      target.closest('.checkpoint-email-link') ||
      target.closest('.checkpoint-media-wrapper') ||
      target.closest('.social-profiles-bar') ||
      target.closest('.social-item') ||
      target.closest('.click-me-badge')
    );
  }

  handleTouchStart(e) {
    // If returning from external link tab, ignore ghost touch for 350ms
    if (this.ignoreTouchUntil && performance.now() < this.ignoreTouchUntil) {
      return;
    }

    // Give clickable introduction images, links, buttons, and social bar absolute touch priority
    if (this.isInteractiveTarget(e.target)) {
      this.isTouchOnInteractive = true;
      return;
    }

    this.isTouchOnInteractive = false;
    if (e.preventDefault) e.preventDefault();

    const touch = e.touches ? e.touches[0] : e;
    this.touchStartY = touch.clientY || 0;

    // Lower portion touch triggers ducking
    if (touch.clientY > window.innerHeight * 0.65) {
      if (this.state === GameState.PLAYING) {
        this.trex.setDuck(true);
        this.isTouchDucking = true;
        return;
      }
    }

    this.handleAction();
  }

  handleTouchMove(e) {
    if (this.isTouchOnInteractive) return;
    if (e.preventDefault) e.preventDefault();
    if (this.state === GameState.PLAYING && e.touches && e.touches[0]) {
      const deltaY = e.touches[0].clientY - this.touchStartY;
      if (deltaY > 20 && !this.isTouchDucking) {
        this.trex.setDuck(true);
        this.isTouchDucking = true;
      }
    }
  }

  handleTouchEnd(e) {
    if (this.isTouchOnInteractive) {
      this.isTouchOnInteractive = false;
      return;
    }
    if (e.preventDefault) e.preventDefault();
    if (this.isTouchDucking) {
      this.trex.setDuck(false);
      this.isTouchDucking = false;
    } else if (this.state === GameState.PLAYING) {
      this.trex.endJump();
    }
  }

  handleAction() {
    // Initialise audio on user interaction
    this.audio.init();

    if (this.state === GameState.START_SCREEN) {
      this.startGame();
    } else if (this.state === GameState.PLAYING) {
      const jumped = this.trex.startJump(this.speed);
      if (jumped) {
        this.audio.playPress();
      }
    } else if (this.state === GameState.CRASHED) {
      this.resumeGame();
    }
  }

  startGame() {
    this.state = GameState.PLAYING;
    document.body.classList.remove('game-over-active');
    // Note: Do NOT play jump sound on game start! Startup music is separate.

    // Softly fade in peaceful ambient background music
    this.audio.startBGM();

    // Start instruction fades out
    if (this.instructionBarEl) {
      this.instructionBarEl.classList.add('hidden');
    }

    this.score = 0;
    this.distanceRan = 0;
    const isMobile = isMobileLayout();
    this.speed = isMobile ? (CONFIG.game.mobileSpeed || 3.8) : CONFIG.game.speed;
    this.trex.reset();
    this.obstacleManager.reset();
    this.horizon.reset();
    this.checkpoints.reset();
  }

  resumeGame() {
    this.state = GameState.PLAYING;
    document.body.classList.remove('game-over-active');

    // Softly resume background music on recovery
    this.audio.resumeBGM();

    // Resume instruction fades out
    if (this.instructionBarEl) {
      this.instructionBarEl.classList.add('hidden');
    }

    // Preserve score & restore gentle speed for that score
    const isMobile = isMobileLayout();
    const baseSpeed = isMobile ? (CONFIG.game.mobileSpeed || 3.8) : CONFIG.game.speed;
    const maxSpeed = isMobile ? (CONFIG.game.mobileMaxSpeed || 5.8) : CONFIG.game.maxSpeed;
    this.speed = Math.min(
      maxSpeed,
      baseSpeed + (this.distanceRan * CONFIG.game.acceleration)
    );
    this.trex.reset();
    this.trex.startSafeWindow(CONFIG.resume.safeWindowDuration);
    this.obstacleManager.clearRunway(CONFIG.resume.obstacleClearDistance);
  }

  onCrash() {
    this.state = GameState.CRASHED;
    this.trex.status = TrexStatus.CRASHED;
    this.audio.playHit();
    this.audio.pauseBGM();

    // High score updating
    PersistenceManager.setHighScore(Math.floor(this.score));
    this.highScore = PersistenceManager.getHighScore();
    this.horizon.setHighScore(this.highScore);

    // Activate Game Over state & render clean foreground modal
    document.body.classList.add('game-over-active');
    this.renderGameOverPanel(true);

    // Subtle, elegant resume prompt at bottom (for test-suite and screen readers)
    if (this.instructionBarEl) {
      this.instructionBarEl.textContent = 'PRESS SPACEBAR TO RESUME';
      this.instructionBarEl.classList.remove('hidden');
    }
  }

  loop(currentTime) {
    const deltaTime = Math.min(currentTime - this.lastTime, 100);
    this.lastTime = currentTime;

    if (this.assetsLoaded) {
      this.update(deltaTime);
      this.render();
    }

    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  update(deltaTime) {
    if (this.state === GameState.START_SCREEN) {
      this.trex.update(deltaTime);
      return;
    }

    if (this.state === GameState.PLAYING) {
      const framesElapsed = deltaTime / (1000 / 60);
      const distanceDelta = this.speed * framesElapsed;
      this.distanceRan += distanceDelta;
      this.score = this.distanceRan * 0.025;

      // Gentle, soothing speed progression
      const isMobile = isMobileLayout();
      const baseSpeed = isMobile ? (CONFIG.game.mobileSpeed || 3.8) : CONFIG.game.speed;
      const maxSpeed = isMobile ? (CONFIG.game.mobileMaxSpeed || 5.8) : CONFIG.game.maxSpeed;

      this.speed = Math.min(
        maxSpeed,
        baseSpeed + (this.distanceRan * CONFIG.game.acceleration)
      );

      // Day / Night cycle at 700 pt milestones
      const cycleMilestone = Math.floor(Math.floor(this.score) / CONFIG.nightMode.invertDistance);
      const isNightCycle = cycleMilestone % 2 === 1;

      if (isNightCycle !== this.isNightMode) {
        this.isNightMode = isNightCycle;
        if (this.isNightMode) {
          document.body.classList.add('night-mode');
        } else {
          document.body.classList.remove('night-mode');
        }
      }

      // Update subsystems
      this.trex.update(deltaTime);
      this.obstacleManager.update(deltaTime, this.speed);
      const playReachedSound = this.horizon.update(deltaTime, this.speed, this.score, this.isNightMode);

      if (playReachedSound) {
        this.audio.playScoreReached();
      }

      // Continuous traveling checkpoint narrative update
      this.checkpoints.update(this.score);

      // Collision detection
      if (this.obstacleManager.checkCollision(this.trex)) {
        this.onCrash();
      }
    }
  }

  render() {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // 1. Draw Horizon ground line across 100vw, wandering clouds, moon, and top-right score
    this.horizon.draw(this.activeSprite, this.isHiDpi);

    // 2. Draw Obstacles (cacti & flying birds)
    this.obstacleManager.draw(this.activeSprite, this.isHiDpi);

    // 3. Draw Trex
    this.trex.draw(this.activeSprite, this.isHiDpi);

    // 4. Draw Game Over treatment if crashed
    if (this.state === GameState.CRASHED) {
      this.renderGameOver();
    }
  }

  renderGameOver() {
    this.renderGameOverPanel();
  }

  renderGameOverPanel(force = false) {
    const textCanvas = document.getElementById('game-over-text-canvas');
    const retryCanvas = document.getElementById('game-over-retry-canvas');
    if (!textCanvas || !retryCanvas || !this.activeSprite) return;

    const spriteDefs = this.isHiDpi ? SPRITE_DEFINITIONS.hdpi : SPRITE_DEFINITIONS.ldpi;
    const spriteSheetScale = this.isHiDpi ? 2 : 1;
    // Scale for crisp pixel presentation: ~1.4x - 2.2x
    const panelScale = Math.min(Math.max(this.scale * 0.9, 1.3), 2.2);

    // 1. Original Chrome Dino GAME OVER text sprite (191 x 11 px)
    const textSprite = spriteDefs.textSprite;
    const textSourceX = textSprite.x;
    const textSourceY = textSprite.y + (13 * spriteSheetScale);
    const textWidth = 191;
    const textHeight = 11;
    const textTargetW = Math.round(textWidth * panelScale);
    const textTargetH = Math.round(textHeight * panelScale);

    if (force || textCanvas.width !== textTargetW || textCanvas.height !== textTargetH) {
      textCanvas.width = textTargetW;
      textCanvas.height = textTargetH;
      textCanvas.style.width = `${textTargetW}px`;
      textCanvas.style.height = `${textTargetH}px`;

      const textCtx = textCanvas.getContext('2d');
      textCtx.imageSmoothingEnabled = false;
      textCtx.clearRect(0, 0, textTargetW, textTargetH);
      textCtx.drawImage(
        this.activeSprite,
        textSourceX,
        textSourceY,
        textWidth * spriteSheetScale,
        textHeight * spriteSheetScale,
        0,
        0,
        textTargetW,
        textTargetH
      );
    }

    // 2. Original Chrome Dino Restart Button sprite (36 x 32 px)
    const restartSprite = spriteDefs.restart;
    const restartWidth = 36;
    const restartHeight = 32;
    const restartTargetW = Math.round(restartWidth * panelScale);
    const restartTargetH = Math.round(restartHeight * panelScale);

    if (force || retryCanvas.width !== restartTargetW || retryCanvas.height !== restartTargetH) {
      retryCanvas.width = restartTargetW;
      retryCanvas.height = restartTargetH;
      retryCanvas.style.width = `${restartTargetW}px`;
      retryCanvas.style.height = `${restartTargetH}px`;

      const retryCtx = retryCanvas.getContext('2d');
      retryCtx.imageSmoothingEnabled = false;
      retryCtx.clearRect(0, 0, restartTargetW, restartTargetH);
      retryCtx.drawImage(
        this.activeSprite,
        restartSprite.x,
        restartSprite.y,
        restartWidth * spriteSheetScale,
        restartHeight * spriteSheetScale,
        0,
        0,
        restartTargetW,
        restartTargetH
      );
    }
  }
}
