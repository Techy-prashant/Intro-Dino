// =============================================================================
// INTRODUCTION DINO - OBSTACLES & COLLISION DETECTION
// Fullscreen scaling, exact baseline resting, generous soothing spacing
// =============================================================================

import { CONFIG, isMobileLayout } from './config.js';
import { SPRITE_DEFINITIONS, OBSTACLE_TYPES, CollisionBox } from './sprites.js';

function getRandomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class Obstacle {
  constructor(canvasWidth, groundBaselineY, scale, typeConfig, speed) {
    this.typeConfig = typeConfig;
    this.type = typeConfig.type;
    this.scale = scale;
    this.groundBaselineY = groundBaselineY;

    // Small or large cacti can group 1 to 2 (rarely 3, keeping it gentle)
    this.size = this.type === 'pterodactyl' ? 1 : getRandomNum(1, 2);
    if (this.size > 1 && this.typeConfig.multipleSpeed > speed) {
      this.size = 1;
    }

    this.width = this.typeConfig.width * this.size * this.scale;
    this.height = this.typeConfig.height * this.scale;
    const isMobile = isMobileLayout();
    this.x = canvasWidth + (isMobile ? 60 : 50);

    // Y position calculated from the exact ground baseline
    if (this.type === 'pterodactyl') {
      const altitudes = this.typeConfig.altitudesAboveBaseline;
      const altitude = altitudes[getRandomNum(0, altitudes.length - 1)];
      this.y = this.groundBaselineY - (altitude * this.scale);
    } else {
      // Cacti sit directly on ground baseline
      this.y = this.groundBaselineY - this.height;
    }

    // Animation frames for flying bird
    this.currentFrame = 0;
    this.animTimer = 0;
    this.speedOffset = this.typeConfig.speedOffset || 0;

    // Generous, soothing gap calculation so player never feels crowded
    const screenGap = isMobile ? window.innerWidth * 0.70 : window.innerWidth * 0.42;
    const baseGap = isMobile
      ? Math.max(CONFIG.game.mobileMinObstacleGap || 280, screenGap)
      : Math.max(CONFIG.game.minObstacleGap, screenGap);
    this.gap = Math.round(baseGap + getRandomNum(isMobile ? 40 : 60, isMobile ? 140 : 240));

    this.followingObstacleCreated = false;
    this.remove = false;

    // Collision boxes scaled to world
    this.collisionBoxes = [];
    this.initCollisionBoxes();
  }

  initCollisionBoxes() {
    const s = this.scale;
    this.collisionBoxes = this.typeConfig.collisionBoxes.map(
      b => new CollisionBox(b.x * s, b.y * s, b.width * s, b.height * s)
    );

    // Adjust collision box width for multi-cactus groupings
    if (this.size > 1 && this.collisionBoxes.length >= 3) {
      this.collisionBoxes[1].width = this.width - this.collisionBoxes[0].width - this.collisionBoxes[2].width;
      this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width;
    }
  }

  update(deltaTime, speed) {
    const actualSpeed = (speed + this.speedOffset) * this.scale;
    this.x -= Math.round(actualSpeed * (deltaTime / (1000 / 60)));

    if (this.typeConfig.numFrames) {
      this.animTimer += deltaTime;
      if (this.animTimer >= this.typeConfig.frameRate) {
        this.currentFrame = (this.currentFrame + 1) % this.typeConfig.numFrames;
        this.animTimer = 0;
      }
    }

    if (this.x < -this.width - 20) {
      this.remove = true;
    }
  }

  draw(ctx, spriteImg, isHiDpi) {
    const spriteDefs = isHiDpi ? SPRITE_DEFINITIONS.hdpi : SPRITE_DEFINITIONS.ldpi;
    const spritePos = spriteDefs[this.type];
    const spriteSheetScale = isHiDpi ? 2 : 1;

    let sourceWidth = this.typeConfig.width * spriteSheetScale;
    let sourceHeight = this.typeConfig.height * spriteSheetScale;

    let sourceX = ((sourceWidth * this.size) * (0.5 * (this.size - 1))) + spritePos.x;
    let sourceY = spritePos.y;

    if (this.currentFrame > 0) {
      sourceX += sourceWidth * this.currentFrame;
    }

    ctx.drawImage(
      spriteImg,
      sourceX,
      sourceY,
      sourceWidth * this.size,
      sourceHeight,
      this.x,
      this.y,
      this.width,
      this.height
    );
  }

  getAbsoluteCollisionBoxes() {
    return this.collisionBoxes.map(
      b => new CollisionBox(this.x + b.x, this.y + b.y, b.width, b.height)
    );
  }
}

export class ObstacleManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.obstacles = [];
    this.groundBaselineY = 400;
    this.scale = 2.0;
  }

  setEnvironment(groundBaselineY, scale) {
    this.groundBaselineY = groundBaselineY;
    this.scale = scale;
  }

  update(deltaTime, speed) {
    for (let i = 0; i < this.obstacles.length; i++) {
      this.obstacles[i].update(deltaTime, speed);
    }

    this.obstacles = this.obstacles.filter(obs => !obs.remove);

    const canvasWidth = window.innerWidth;

    // Spawn new obstacles with generous spacing
    if (this.obstacles.length === 0) {
      const isMobile = isMobileLayout();
      const initialLead = isMobile ? Math.max(160, Math.round(canvasWidth * 0.5)) : 0;
      this.spawnObstacle(speed, null, initialLead);
    } else {
      const lastObstacle = this.obstacles[this.obstacles.length - 1];
      if (
        !lastObstacle.followingObstacleCreated &&
        canvasWidth - (lastObstacle.x + lastObstacle.width) >= lastObstacle.gap
      ) {
        this.spawnObstacle(speed);
        lastObstacle.followingObstacleCreated = true;
      }
    }
  }

  spawnObstacle(speed, forcedType = null, extraLead = 0) {
    let availableTypes = OBSTACLE_TYPES.filter(type => speed >= type.minSpeed);
    if (forcedType) {
      if (typeof forcedType === 'string') {
        const match = OBSTACLE_TYPES.find(t => t.type === forcedType);
        if (match) availableTypes = [match];
      } else {
        availableTypes = [forcedType];
      }
    }
    const chosenType = availableTypes[getRandomNum(0, availableTypes.length - 1)];

    const obstacle = new Obstacle(
      window.innerWidth + extraLead,
      this.groundBaselineY,
      this.scale,
      chosenType,
      speed
    );
    this.obstacles.push(obstacle);
    return obstacle;
  }

  draw(spriteImg, isHiDpi) {
    for (let i = 0; i < this.obstacles.length; i++) {
      this.obstacles[i].draw(this.ctx, spriteImg, isHiDpi);
    }
  }

  checkCollision(trex) {
    if (trex.flashing) return false;

    const trexBoxes = trex.collisionBoxes;

    for (let i = 0; i < this.obstacles.length; i++) {
      const obstacle = this.obstacles[i];

      // Quick bounding rejection
      if (
        trex.x + (trex.specs.width * trex.scale) < obstacle.x ||
        trex.x > obstacle.x + obstacle.width ||
        trex.y + (trex.specs.height * trex.scale) < obstacle.y ||
        trex.y > obstacle.y + obstacle.height
      ) {
        continue;
      }

      // Detailed AABB collision
      const obstacleBoxes = obstacle.getAbsoluteCollisionBoxes();
      for (let t = 0; t < trexBoxes.length; t++) {
        const tBox = trexBoxes[t];
        for (let o = 0; o < obstacleBoxes.length; o++) {
          const oBox = obstacleBoxes[o];

          if (
            tBox.x < oBox.x + oBox.width &&
            tBox.x + tBox.width > oBox.x &&
            tBox.y < oBox.y + oBox.height &&
            tBox.y + tBox.height > oBox.y
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  clearRunway(distance = 500) {
    this.obstacles = this.obstacles.filter(obs => obs.x > 150 + distance);
  }

  reset() {
    this.obstacles = [];
  }
}

ObstacleManager.OBSTACLE_TYPES = OBSTACLE_TYPES;
ObstacleManager.Obstacle = Obstacle;
