// =============================================================================
// INTRODUCTION DINO - TREX PHYSICS & ANIMATION
// Proportional fullscreen scaling, exact baseline alignment & buoyant jumping
// =============================================================================

import { CONFIG, isMobileLayout } from './config.js';
import { SPRITE_DEFINITIONS, TREX_COLLISION_BOXES, TREX_SPECS, CollisionBox } from './sprites.js';

export const TrexStatus = {
  WAITING: 'WAITING',
  RUNNING: 'RUNNING',
  JUMPING: 'JUMPING',
  DUCKING: 'DUCKING',
  CRASHED: 'CRASHED',
};

export class Trex {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.specs = TREX_SPECS;

    this.scale = 2.0;
    this.groundBaselineY = 400; // Y coordinate where feet rest on the ground line
    this.x = 100;
    this.y = this.groundBaselineY - (this.specs.height * this.scale);

    this.status = TrexStatus.WAITING;
    this.jumping = false;
    this.ducking = false;
    this.speedDrop = false;
    this.jumpVelocity = 0;
    this.reachedMinHeight = false;

    // Animation timers
    this.animTimer = 0;
    this.currentFrameIdx = 0;
    this.blinkDelay = 3000;
    this.blinkTimer = 0;

    // Invulnerability / Safe restart window
    this.flashing = false;
    this.flashTimer = 0;

    this.collisionBoxes = [];
    this.updateCollisionBoxes();
  }

  setEnvironment(groundBaselineY, scale) {
    this.groundBaselineY = groundBaselineY;
    this.scale = scale;
    const isMobile = isMobileLayout();
    const minX = isMobile ? Math.max(28, Math.round(window.innerWidth * 0.08)) : 70;
    const xRatio = isMobile ? 0.09 : 0.12;
    this.x = Math.max(minX, Math.round(window.innerWidth * xRatio));

    if (!this.jumping) {
      this.y = this.groundBaselineY - (this.specs.height * this.scale);
    }
    this.updateCollisionBoxes();
  }

  get groundY() {
    return this.groundBaselineY - (this.specs.height * this.scale);
  }

  updateCollisionBoxes() {
    const s = this.scale;
    const boxes = (this.ducking && this.status !== TrexStatus.CRASHED)
      ? TREX_COLLISION_BOXES.ducking
      : TREX_COLLISION_BOXES.running;

    this.collisionBoxes = boxes.map(
      b => new CollisionBox(this.x + (b.x * s), this.y + (b.y * s), b.width * s, b.height * s)
    );
  }

  startJump(speed) {
    if (!this.jumping && this.status !== TrexStatus.CRASHED) {
      this.status = TrexStatus.JUMPING;
      this.jumping = true;
      this.jumpVelocity = CONFIG.game.initialJumpVelocity * this.scale;
      this.reachedMinHeight = false;
      this.speedDrop = false;
      this.currentFrameIdx = 0;
      return true;
    }
    return false;
  }

  endJump() {
    const dropVel = CONFIG.game.dropVelocity * this.scale;
    if (this.reachedMinHeight && this.jumpVelocity < dropVel) {
      this.jumpVelocity = dropVel;
    }
  }

  setSpeedDrop() {
    this.speedDrop = true;
    this.jumpVelocity = 2.5 * this.scale;
  }

  setDuck(isDucking) {
    if (this.status === TrexStatus.CRASHED) return;

    if (isDucking) {
      if (this.jumping) {
        this.setSpeedDrop();
      } else if (this.status !== TrexStatus.DUCKING) {
        this.status = TrexStatus.DUCKING;
        this.ducking = true;
        this.currentFrameIdx = 0;
      }
    } else {
      if (this.status === TrexStatus.DUCKING) {
        this.status = TrexStatus.RUNNING;
        this.ducking = false;
        this.currentFrameIdx = 0;
      }
    }
  }

  startSafeWindow(duration = 1500) {
    this.flashing = true;
    this.flashTimer = 0;
    setTimeout(() => {
      this.flashing = false;
      if (this.ctx) this.ctx.globalAlpha = 1;
    }, duration);
  }

  update(deltaTime) {
    this.animTimer += deltaTime;

    // Safe window flashing
    if (this.flashing) {
      this.flashTimer += deltaTime;
      if (this.flashTimer % (this.specs.flashOn + this.specs.flashOff) < this.specs.flashOn) {
        this.ctx.globalAlpha = 0.4;
      } else {
        this.ctx.globalAlpha = 1;
      }
    } else {
      this.ctx.globalAlpha = 1;
    }

    // Jump Physics (soothing, floaty arc)
    if (this.jumping) {
      const framesElapsed = deltaTime / (1000 / 60);
      const gravity = CONFIG.game.gravity * this.scale;
      const speedDropMult = this.speedDrop ? CONFIG.game.speedDropCoefficient : 1;

      this.y += Math.round(this.jumpVelocity * speedDropMult * framesElapsed);
      this.jumpVelocity += gravity * framesElapsed;

      // Minimum height check for variable jump
      const minJumpY = this.groundY - (CONFIG.game.minJumpHeight * this.scale);
      if (this.y < minJumpY || this.speedDrop) {
        this.reachedMinHeight = true;
      }

      // Maximum height check
      const maxJumpY = this.groundY - (CONFIG.game.maxJumpHeight * this.scale);
      if (this.y < maxJumpY || this.speedDrop) {
        this.endJump();
      }

      // Back to ground check (landing precision)
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.jumping = false;
        this.jumpVelocity = 0;

        if (this.speedDrop && this.ducking) {
          this.status = TrexStatus.DUCKING;
        } else {
          this.status = this.ducking ? TrexStatus.DUCKING : TrexStatus.RUNNING;
        }
        this.speedDrop = false;
        this.currentFrameIdx = 0;
      }
    }

    // Animation frame update
    const animSpec = this.specs.animFrames[this.status];
    if (animSpec) {
      if (this.status === TrexStatus.WAITING) {
        this.blinkTimer += deltaTime;
        if (this.blinkTimer >= this.blinkDelay) {
          this.currentFrameIdx = 1; // eyes closed
          if (this.blinkTimer >= this.blinkDelay + 160) {
            this.currentFrameIdx = 0; // eyes open
            this.blinkTimer = 0;
            this.blinkDelay = 2500 + Math.random() * 4500;
          }
        }
      } else if (this.animTimer >= animSpec.msPerFrame) {
        this.currentFrameIdx = (this.currentFrameIdx + 1) % animSpec.frames.length;
        this.animTimer = 0;
      }
    }

    this.updateCollisionBoxes();
  }

  draw(spriteImg, isHiDpi) {
    const spriteDefs = isHiDpi ? SPRITE_DEFINITIONS.hdpi : SPRITE_DEFINITIONS.ldpi;
    const tRexSprite = spriteDefs.tRex;
    const spriteSheetScale = isHiDpi ? 2 : 1;

    const animSpec = this.specs.animFrames[this.status];
    const frameOffset = animSpec ? animSpec.frames[this.currentFrameIdx] : 0;

    const isDuckingState = this.ducking && this.status !== TrexStatus.CRASHED;

    let sourceX = tRexSprite.x + (frameOffset * spriteSheetScale);
    let sourceY = tRexSprite.y;
    let sourceWidth = (isDuckingState ? this.specs.widthDuck : this.specs.width) * spriteSheetScale;
    let sourceHeight = this.specs.height * spriteSheetScale;

    // Both standing and ducking share the exact same height and ground baseline!
    let targetWidth = (isDuckingState ? this.specs.widthDuck : this.specs.width) * this.scale;
    let targetHeight = this.specs.height * this.scale;
    let targetY = this.y;

    this.ctx.drawImage(
      spriteImg,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      this.x,
      targetY,
      targetWidth,
      targetHeight
    );

    this.ctx.globalAlpha = 1;
  }

  reset() {
    this.y = this.groundY;
    this.jumping = false;
    this.ducking = false;
    this.speedDrop = false;
    this.jumpVelocity = 0;
    this.status = TrexStatus.RUNNING;
    this.currentFrameIdx = 0;
    this.flashing = false;
    this.ctx.globalAlpha = 1;
    this.updateCollisionBoxes();
  }
}
