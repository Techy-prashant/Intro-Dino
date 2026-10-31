// =============================================================================
// INTRODUCTION DINO - SPRITE DEFINITIONS & HITBOXES
// Exact coordinates & collision boxes matching Chromium T-Rex Runner
// =============================================================================

export class CollisionBox {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

export const SPRITE_DEFINITIONS = {
  ldpi: {
    backgroundEl: { x: 86, y: 2 },
    cactusLarge: { x: 332, y: 2 },
    cactusSmall: { x: 228, y: 2 },
    cloud: { x: 86, y: 2 },
    horizon: { x: 2, y: 54 },
    moon: { x: 484, y: 2 },
    pterodactyl: { x: 134, y: 2 },
    restart: { x: 2, y: 68 },
    textSprite: { x: 655, y: 2 },
    tRex: { x: 848, y: 2 },
    star: { x: 645, y: 2 },
  },
  hdpi: {
    backgroundEl: { x: 166, y: 2 },
    cactusLarge: { x: 652, y: 2 },
    cactusSmall: { x: 446, y: 2 },
    cloud: { x: 166, y: 2 },
    horizon: { x: 2, y: 104 },
    moon: { x: 954, y: 2 },
    pterodactyl: { x: 260, y: 2 },
    restart: { x: 2, y: 130 },
    textSprite: { x: 1294, y: 2 },
    tRex: { x: 1678, y: 2 },
    star: { x: 1276, y: 2 },
  },
};

// Obstacle configurations (natural heights in virtual units)
export const OBSTACLE_TYPES = [
  {
    type: 'cactusSmall',
    width: 17,
    height: 35,
    yOffsetFromBaseline: 35, // Sits directly on baseline
    multipleSpeed: 4,
    minGap: 200,
    minSpeed: 0,
    collisionBoxes: [
      new CollisionBox(0, 7, 5, 27),
      new CollisionBox(4, 0, 6, 34),
      new CollisionBox(10, 4, 7, 14),
    ],
  },
  {
    type: 'cactusLarge',
    width: 25,
    height: 50,
    yOffsetFromBaseline: 50, // Sits directly on baseline
    multipleSpeed: 6.5,
    minGap: 240,
    minSpeed: 0,
    collisionBoxes: [
      new CollisionBox(0, 12, 7, 38),
      new CollisionBox(8, 0, 7, 49),
      new CollisionBox(13, 10, 10, 38),
    ],
  },
  {
    type: 'pterodactyl',
    width: 46,
    height: 40,
    // Heights above baseline: Low (duck under), Mid (run under or duck), High (clear)
    altitudesAboveBaseline: [55, 80, 110],
    multipleSpeed: 999,
    minSpeed: 5.0, // Introduces gently later in progression
    minGap: 300,
    collisionBoxes: [
      new CollisionBox(15, 15, 16, 5),
      new CollisionBox(18, 21, 24, 6),
      new CollisionBox(2, 14, 4, 3),
      new CollisionBox(6, 10, 4, 7),
      new CollisionBox(10, 8, 6, 9),
    ],
    numFrames: 2,
    frameRate: 1000 / 6,
    speedOffset: 0.4,
  },
];

// Trex Collision Boxes matching Chromium
export const TREX_COLLISION_BOXES = {
  ducking: [
    new CollisionBox(1, 18, 55, 25),
  ],
  running: [
    new CollisionBox(22, 0, 17, 16),
    new CollisionBox(1, 18, 30, 9),
    new CollisionBox(10, 35, 14, 8),
    new CollisionBox(1, 24, 29, 5),
    new CollisionBox(5, 30, 21, 4),
    new CollisionBox(9, 34, 15, 4),
  ],
};

// Trex Dimensions and Animation Specs
// In Chromium sprite sheet: ducking frame bounding box is 59 wide by 47 high,
// with feet perfectly aligned with standing feet at the bottom!
export const TREX_SPECS = {
  width: 44,
  height: 47,
  widthDuck: 59,
  heightDuck: 47, // Bounding box height in sprite sheet is 47
  flashOn: 100,
  flashOff: 175,
  animFrames: {
    WAITING: { frames: [44, 0], msPerFrame: 1000 / 3 },
    RUNNING: { frames: [88, 132], msPerFrame: 1000 / 12 },
    CRASHED: { frames: [220], msPerFrame: 1000 / 60 },
    JUMPING: { frames: [0], msPerFrame: 1000 / 60 },
    DUCKING: { frames: [264, 323], msPerFrame: 1000 / 8 },
  },
};
