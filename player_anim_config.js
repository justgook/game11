// Player Animation Configuration for new_player.png sprite sheet
// Frame index calculation: index = row * columns + col (0-indexed, row-major)

const ANIM = {
  SPELLCAST: 0,
  THRUST: 1,
  WALK: 2,
  SLASH: 3,
  SHOOT: 4,
  HURT: 5,
  CLIMB: 6,
  IDLE: 7,
  JUMP: 8,
  SIT: 9,
  EMOTE: 10,
  RUN: 11,
  WATERING: 12,
  COMBAT_IDLE: 13,
  ONE_H_SLASH: 14,
  ONE_H_BACKSLASH: 15,
  ONE_H_HALFSLSH: 16
}

const ANIM_ROW_START = [
  0,
  4,
  8,
  12,
  16,
  20,     // 1 row
  21,    // 1 row
  22,
  26,
  30,
  34,
  38,
  42,
  46,
  50,
  54,
  58,
]

const DIR = {
  UP: 0,
  LEFT: 1,
  DOWN: 2,
  RIGHT: 3,
}


const COLS = 13;

function animFrames(name, dir, startCol, frameCount) {
  let row = ANIM_ROW_START[name];

  // Directional animations
  if (!['hurt', 'climb'].includes(name)) {
    row += dir; // down/left/right/up
  }

  const base = row * COLS + startCol;
  return Array.from({ length: frameCount }, (_, i) => base + i);
}

console.log(animFrames(ANIM.IDLE, DIR.UP, 0, 1), ANIM.IDLE * 4)

export const playerAnimConfig = {
  // Frame dimensions in pixels
  frameWidth: 64,
  frameHeight: 64,

  // Direction order matches a2d() function in game.js:
  // 0=down (angle π/2), 1=left (angle π), 2=right (angle 0), 3=up (angle -π/2)
  directions: ['down', 'left', 'right', 'up'],

  animSpeed: {
    idle: 0.2,
    dash: 0.08,
    shoot: 0.1,
    walk: 0.08,
    melee: 0.2,
  },
  // const animSpeed = P.st === 'dash' ? 0.08 : P.st === 'shoot' ? 0.1 : P.st === 'slash' ? 0.06 : P.st === 'walk' ? 0.15 : 0.2;

  animations: {
    idle: [
      [312, 312, 313],  // down (facing camera)
      [299, 299, 300],  // left
      [325, 325, 326],  // right
      [286, 286, 287]   // up (facing away)
    ],

    walking: [
      animFrames(ANIM.RUN, DIR.DOWN, 0, 8),
      animFrames(ANIM.RUN, DIR.LEFT, 0, 8),
      animFrames(ANIM.RUN, DIR.RIGHT, 0, 8),
      animFrames(ANIM.RUN, DIR.UP, 0, 8)
    ],

    melee: [
      animFrames(ANIM.SLASH, DIR.DOWN, 0, 6),
      animFrames(ANIM.SLASH, DIR.LEFT, 0, 6),
      animFrames(ANIM.SLASH, DIR.RIGHT, 0, 6),
      animFrames(ANIM.SLASH, DIR.UP, 0, 6)
    ],

    shooting: [
      animFrames(ANIM.SHOOT, DIR.DOWN, 0, 13),
      animFrames(ANIM.SHOOT, DIR.LEFT, 0, 13),
      animFrames(ANIM.SHOOT, DIR.RIGHT, 0, 13),
      animFrames(ANIM.SHOOT, DIR.UP, 0, 13)
    ],

    dashing: [ // thrust
      animFrames(ANIM.THRUST, DIR.DOWN, 0, 8),
      animFrames(ANIM.THRUST, DIR.LEFT, 0, 8),
      animFrames(ANIM.THRUST, DIR.RIGHT, 0, 8),
      animFrames(ANIM.THRUST, DIR.UP, 0, 8)
    ]
  }

};

