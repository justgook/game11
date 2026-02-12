
// Calculate grid dimensions from loaded image
export function getPlayerSpriteGrid(playerAnimConfig, img) {
  if (!img || !img.width || !img.height) {
    return { cols: 13, rows: 56 }; // fallback
  }

  return {
    cols: Math.floor(img.width / playerAnimConfig.frameWidth),
    rows: Math.floor(img.height / playerAnimConfig.frameHeight)
  };
}

// Helper function to get UV coordinates for a specific animation frame
export function getPlayerAnimUV(playerAnimConfig, animName, direction, frameIndex, grid) {
  const anim = playerAnimConfig.animations[animName];
  if (!anim) return { u1: 0, v1: 0, u2: 0, v2: 0 };

  // direction can be 0-3 index or direction name
  const dirIdx = typeof direction === 'number' ? direction : playerAnimConfig.directions.indexOf(direction);
  if (dirIdx < 0 || dirIdx >= anim.length) return { u1: 0, v1: 0, u2: 0, v2: 0 };

  const frames = anim[dirIdx];
  if (!frames || frameIndex >= frames.length) return { u1: 0, v1: 0, u2: 0, v2: 0 };

  const frameIdx = frames[frameIndex];

  const col = frameIdx % grid.cols;
  const row = Math.floor(frameIdx / grid.cols);

  return {
    u1: col / grid.cols,
    v1: row / grid.rows,
    u2: (col + 1) / grid.cols,
    v2: (row + 1) / grid.rows
  };
}

// Get number of frames for an animation in a specific direction
export function getAnimFrameCount(playerAnimConfig, animName, direction) {
  const anim = playerAnimConfig.animations[animName];
  if (!anim) return 1;

  const dirIdx = typeof direction === 'number' ? direction : playerAnimConfig.directions.indexOf(direction);
  if (dirIdx < 0 || dirIdx >= anim.length) return 1;

  return anim[dirIdx].length;
}

// Map player state to animation name
export function getAnimNameFromState(state) {
  const mapping = {
    'idle': 'idle',
    'walk': 'walking',
    'slash': 'melee',
    'shoot': 'shooting',
    'dash': 'dashing'
  };
  return mapping[state] || 'idle';
}
