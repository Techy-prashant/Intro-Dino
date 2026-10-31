// =============================================================================
// INTRODUCTION DINO - HORIZON, GROUND, CLOUDS, MOON & TOP-RIGHT SCORE
// Fullscreen seamless ground spanning 100vw, wandering clouds, lunar phases
// =============================================================================

import { CONFIG } from './config.js';
import { SPRITE_DEFINITIONS } from './sprites.js';

function getRandomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class Horizon {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.scale = 2.0;
    this.groundBaselineY = 400;

    // Ground slices spanning the entire viewport width
    this.sliceWidth = 600 * this.scale;
    this.sliceHeight = 12 * this.scale;
    this.groundSlices = [];

    // Clouds
    this.clouds = [];
    this.maxClouds = 5;

    // Night Mode (Moon only, no cluttering stars)
    this.nightOpacity = 0;
    this.moonPhases = [140, 120, 100, 60, 40, 20, 0];
    this.currentPhaseIdx = 0;
    this.moonX = window.innerWidth - 180;
    this.moonY = 50;

    // Distance Meter (Top-Right score only)
    this.digits = ['0', '0', '0', '0', '0'];
    this.highScoreDigits = [];
    this.achievement = false;
    this.flashTimer = 0;
    this.flashIterations = 0;
    this.isFlashingScore = false;

    this.initGround();
  }

  setEnvironment(groundBaselineY, scale) {
    this.groundBaselineY = groundBaselineY;
    this.scale = scale;
    this.sliceWidth = 600 * this.scale;
    this.sliceHeight = 12 * this.scale;
    this.initGround();
  }

  initGround() {
    this.groundSlices = [];
    const count = Math.ceil(window.innerWidth / this.sliceWidth) + 2;
    for (let i = 0; i < count; i++) {
      this.groundSlices.push({
        x: i * this.sliceWidth,
        sourceX: Math.random() > 0.5 ? 2 : 602,
      });
    }
  }

  update(deltaTime, speed, actualScore, isNightTime) {
    const framesElapsed = deltaTime / (1000 / 60);
    const scrollSpeed = Math.round(speed * this.scale * framesElapsed);

    // 1. Scroll ground line across full width
    for (let i = 0; i < this.groundSlices.length; i++) {
      this.groundSlices[i].x -= scrollSpeed;
    }

    // Wrap ground slices around
    for (let i = 0; i < this.groundSlices.length; i++) {
      if (this.groundSlices[i].x <= -this.sliceWidth) {
        // Find rightmost edge
        let maxX = -Infinity;
        for (let j = 0; j < this.groundSlices.length; j++) {
          if (this.groundSlices[j].x > maxX) {
            maxX = this.groundSlices[j].x;
          }
        }
        this.groundSlices[i].x = maxX + this.sliceWidth;
        this.groundSlices[i].sourceX = Math.random() > 0.5 ? 2 : 602;
      }
    }

    // 2. Update wandering clouds
    this.updateClouds(deltaTime, speed);

    // 3. Update Moon in Night Mode
    this.updateNightMode(deltaTime, isNightTime);

    // 4. Update Score in top-right
    return this.updateScore(deltaTime, actualScore);
  }

  updateClouds(deltaTime, speed) {
    const cloudSpeed = Math.round(CONFIG.game.speed * 0.15 * this.scale * (deltaTime / (1000 / 60)));

    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].x -= cloudSpeed;
    }
    this.clouds = this.clouds.filter(c => c.x > -150);

    // Spawn clouds gracefully across the wide sky
    if (this.clouds.length < this.maxClouds) {
      const lastCloud = this.clouds[this.clouds.length - 1];
      const minSkyGap = window.innerWidth * 0.3;
      if (!lastCloud || (window.innerWidth - lastCloud.x >= minSkyGap)) {
        this.clouds.push({
          x: window.innerWidth + getRandomNum(20, 100),
          y: getRandomNum(Math.round(window.innerHeight * 0.12), Math.round(window.innerHeight * 0.36)),
        });
      }
    }
  }

  updateNightMode(deltaTime, isNightTime) {
    if (isNightTime) {
      if (this.nightOpacity === 0) {
        this.currentPhaseIdx = (this.currentPhaseIdx + 1) % this.moonPhases.length;
        this.moonX = window.innerWidth - Math.round(window.innerWidth * 0.22);
        this.moonY = Math.round(window.innerHeight * 0.15);
      }
      if (this.nightOpacity < 1) {
        this.nightOpacity = Math.min(1, this.nightOpacity + 0.025);
      }
      this.moonX -= CONFIG.nightMode.moonSpeed * this.scale;
    } else {
      if (this.nightOpacity > 0) {
        this.nightOpacity = Math.max(0, this.nightOpacity - 0.025);
      }
    }
  }

  updateScore(deltaTime, score) {
    let playReachedSound = false;

    const scoreStr = ('00000' + Math.floor(score)).slice(-5);
    this.digits = scoreStr.split('');

    if (score > 0 && Math.floor(score) % 100 === 0 && !this.achievement) {
      this.achievement = true;
      this.flashTimer = 0;
      this.flashIterations = 0;
      this.isFlashingScore = true;
      playReachedSound = true;
    }

    if (this.achievement) {
      this.flashTimer += deltaTime;
      if (this.flashTimer < 250) {
        this.isFlashingScore = false;
      } else if (this.flashTimer < 500) {
        this.isFlashingScore = true;
      } else {
        this.flashTimer = 0;
        this.flashIterations++;
        if (this.flashIterations >= 3) {
          this.achievement = false;
          this.isFlashingScore = false;
        }
      }
    }

    return playReachedSound;
  }

  setHighScore(highScore) {
    if (highScore > 0) {
      const hsStr = ('00000' + Math.floor(highScore)).slice(-5);
      this.highScoreDigits = ['H', 'I', ' ', ...hsStr.split('')];
    } else {
      this.highScoreDigits = [];
    }
  }

  draw(spriteImg, isHiDpi) {
    const spriteDefs = isHiDpi ? SPRITE_DEFINITIONS.hdpi : SPRITE_DEFINITIONS.ldpi;
    const spriteSheetScale = isHiDpi ? 2 : 1;

    // 1. Draw Moon in Night Mode
    if (this.nightOpacity > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.nightOpacity;

      const moonSprite = spriteDefs.moon;
      const phaseOffset = this.moonPhases[this.currentPhaseIdx];
      this.ctx.drawImage(
        spriteImg,
        moonSprite.x + (phaseOffset * spriteSheetScale),
        moonSprite.y,
        20 * spriteSheetScale,
        40 * spriteSheetScale,
        this.moonX,
        this.moonY,
        20 * this.scale,
        40 * this.scale
      );

      this.ctx.restore();
    }

    // 2. Draw Clouds
    const cloudSprite = spriteDefs.cloud;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      this.ctx.drawImage(
        spriteImg,
        cloudSprite.x,
        cloudSprite.y,
        46 * spriteSheetScale,
        14 * spriteSheetScale,
        c.x,
        c.y,
        46 * this.scale,
        14 * this.scale
      );
    }

    // 3. Draw Ground Line across full width
    // Surface sits at groundBaselineY - (13 * scale)
    const horizonSprite = spriteDefs.horizon;
    const groundDrawY = this.groundBaselineY - (13 * this.scale);

    for (let i = 0; i < this.groundSlices.length; i++) {
      const slice = this.groundSlices[i];
      this.ctx.drawImage(
        spriteImg,
        slice.sourceX * spriteSheetScale,
        horizonSprite.y,
        600 * spriteSheetScale,
        12 * spriteSheetScale,
        slice.x,
        groundDrawY,
        this.sliceWidth,
        this.sliceHeight
      );
    }

    // 4. Draw Score ONLY in top-right corner
    this.drawTopRightScore(spriteImg, isHiDpi);
  }

  drawTopRightScore(spriteImg, isHiDpi) {
    const spriteDefs = isHiDpi ? SPRITE_DEFINITIONS.hdpi : SPRITE_DEFINITIONS.ldpi;
    const textSprite = spriteDefs.textSprite;
    const spriteSheetScale = isHiDpi ? 2 : 1;

    // Small, crisp, comfortable pixel font size
    const digitW = 10 * 1.5;
    const digitH = 13 * 1.5;
    const destW = 12 * 1.5;

    const topPadding = 28;
    const rightPadding = 36;

    let cursorX = window.innerWidth - rightPadding - (this.digits.length * destW);

    // Draw current score
    if (!this.isFlashingScore) {
      for (let i = 0; i < this.digits.length; i++) {
        const digit = parseInt(this.digits[i], 10);
        this.ctx.drawImage(
          spriteImg,
          textSprite.x + (digit * 10 * spriteSheetScale),
          textSprite.y,
          10 * spriteSheetScale,
          13 * spriteSheetScale,
          cursorX + (i * destW),
          topPadding,
          digitW,
          digitH
        );
      }
    }

    // Draw High Score if present (dimmed)
    if (this.highScoreDigits.length > 0) {
      const hsX = cursorX - (this.highScoreDigits.length * destW) - 16;
      this.ctx.save();
      this.ctx.globalAlpha = 0.55;

      for (let i = 0; i < this.highScoreDigits.length; i++) {
        const char = this.highScoreDigits[i];
        let charIndex = 0;

        if (char === 'H') charIndex = 10;
        else if (char === 'I') charIndex = 11;
        else if (char === ' ') continue;
        else charIndex = parseInt(char, 10);

        this.ctx.drawImage(
          spriteImg,
          textSprite.x + (charIndex * 10 * spriteSheetScale),
          textSprite.y,
          10 * spriteSheetScale,
          13 * spriteSheetScale,
          hsX + (i * destW),
          topPadding,
          digitW,
          digitH
        );
      }

      this.ctx.restore();
    }
  }

  reset() {
    this.initGround();
    this.clouds = [];
    this.nightOpacity = 0;
    this.achievement = false;
    this.isFlashingScore = false;
  }
}
