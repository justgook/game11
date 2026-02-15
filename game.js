"use strict";

import { playerAnimConfig } from './player_anim_config.js';
import { getPlayerSpriteGrid, getPlayerAnimUV, getAnimFrameCount, getAnimNameFromState } from './load.js';

// Tileset configuration
let tileset = null;
let tilesetLoaded = false;

const TILE_SIZE = 16; // Default tile size (also used as sprite size)

// Level Management
let currentLevelData = null;
let currentLevelUrl = 'levels/level1.json';
let isLevelComplete = false;
let isGameComplete = false;

const loadingScreen = document.getElementById('loadingScreen');
const levelCompleteScreen = document.getElementById('levelCompleteScreen');
const gameCompleteScreen = document.getElementById('gameCompleteScreen');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const restartBtn = document.getElementById('restartBtn');
const levelStats = document.getElementById('levelStats');

async function loadLevel(url) {
  loadingScreen.style.display = 'flex';
  levelCompleteScreen.style.display = 'none';
  gameCompleteScreen.style.display = 'none';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load level');
    currentLevelData = await response.json();
    currentLevelUrl = url;

    // Reset game state for new level
    resetGameForNewLevel();

    // Build level from data
    buildLevelFromData(currentLevelData);

    loadingScreen.style.display = 'none';
    isLevelComplete = false;
    isGameComplete = false;
    gWon = false;
    gOver = false;

  } catch (error) {
    console.error('Error loading level:', error);
    alert('Failed to load level: ' + url);
  }
}

function resetGameForNewLevel() {
  // Reset player
  P.hp = currentLevelData.player.hp;
  P.mhp = currentLevelData.player.maxHp;
  P.ammo = currentLevelData.player.ammo;
  P.mammo = currentLevelData.player.maxAmmo;
  P.wpns = currentLevelData.player.weapons;
  P.wi = 0;
  P.wpn = P.wpns[0];
  P.alive = true;
  P.inv = 0;
  P.ft = 0;
  P.dt = 0;
  P.dc = 0;
  P.ms = 0;
  P.st = 'idle';
  P.af = 0;
  P.at = 0;
  P.angle = 0;
  P.dir = 0;

  // Clear arrays
  enemies.length = 0;
  eSpawns.length = 0;
  pickups.length = 0;
  bul.length = 0;
  ebul.length = 0;
  particles.length = 0;

  // Reset game state
  kills = 0;
  gt = 0;
  shake = 0;
  shX = 0;
  shY = 0;
  mFlash = { a: false, x: 0, y: 0, t: 0 };
  showMM = false;
  curRoom = null;

  // Reset keys
  for (const key in keys) keys[key] = false;
}

function buildLevelFromData(data) {
  // Update dimensions
  LW = data.dimensions.w;
  LH = data.dimensions.h;
  T = data.dimensions.tileSize;

  // Reset level data array
  ld = new Uint8Array(LW * LH);
  floorVar = new Uint8Array(LW * LH);
  for (let i = 0; i < floorVar.length; i++) floorVar[i] = ((i * 7 + 13) * 31) & 3;

  // Clear rooms and corridors
  rooms.length = 0;
  corrs.length = 0;

  // Build rooms
  for (const r of data.rooms) {
    rooms.push(r);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        sT(x, y, (y === r.y || y === r.y + r.h - 1 || x === r.x || x === r.x + r.w - 1) ? TW : TF);
      }
    }
  }

  // Build corridors
  for (const c of data.corridors) {
    corrs.push(c);
    const hz = (c.x2 - c.x1) > (c.y2 - c.y1);
    if (hz) {
      for (let x = c.x1 - 1; x < c.x2 + 1; x++) {
        sT(x, c.y1, TF);
        sT(x, c.y1 + 1, TF);
      }
      for (let x = c.x1 - 1; x < c.x2 + 1; x++) {
        for (const fy of [c.y1, c.y1 + 1]) {
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            if (gT(x + dx, fy + dy) === 0) sT(x + dx, fy + dy, TW);
          }
        }
      }
    } else {
      for (let y = c.y1 - 1; y < c.y2 + 1; y++) {
        sT(c.x1, y, TF);
        sT(c.x1 + 1, y, TF);
      }
      for (let y = c.y1 - 1; y < c.y2 + 1; y++) {
        for (const fx of [c.x1, c.x1 + 1]) {
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            if (gT(fx + dx, y + dy) === 0) sT(fx + dx, y + dy, TW);
          }
        }
      }
    }
  }

  // Place obstacles
  for (const [x, y] of data.obstacles) sT(x, y, TO);

  // Place crates
  for (const [x, y] of data.crates) sT(x, y, TC);

  // Place barrels
  for (const [x, y] of data.barrels) sT(x, y, TB);

  // Set player spawn
  pSpawn = { x: data.playerSpawn.x, y: data.playerSpawn.y };
  P.x = pSpawn.x * T + T / 2;
  P.y = pSpawn.y * T + T / 2;
  sT(pSpawn.x, pSpawn.y, TF);

  // Spawn enemies
  for (const esp of data.enemySpawns) {
    eSpawns.push({ x: esp.x, y: esp.y });
    sT(esp.x, esp.y, TF);

    const et = ET[esp.type];
    const px = esp.x * T + T / 2;
    const py = esp.y * T + T / 2;

    const pat = [{ x: px, y: py }];
    for (const d of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2]]) {
      const nx = esp.x + d[0], ny = esp.y + d[1];
      if (!isS(nx, ny) && gT(nx, ny) === TF) {
        pat.push({ x: nx * T + T / 2, y: ny * T + T / 2 });
        if (pat.length >= 3) break;
      }
    }

    enemies.push({
      x: px, y: py, w: 22, h: 22, type: esp.type, ...et,
      mhp: et.hp, a: Math.random() * Math.PI * 2, st: 'patrol',
      ft: Math.random() * et.fr, at: 0, pp: pat, pi: 0, pw: 0,
      lx: 0, ly: 0, alive: true, hf: 0, sx: px, sy: py,
      af: 0, aT: 0, dir: 0, as: 'idle'
    });
  }

  // Place pickups
  for (const p of data.pickups || []) {
    pickups.push({ x: p.x * T + T / 2, y: p.y * T + T / 2, type: p.type, active: true });
    sT(p.x, p.y, TF);
  }

  totE = enemies.length;
}

function onLevelComplete() {
  isLevelComplete = true;
  gWon = true;

  if (currentLevelData.isLastLevel) {
    isGameComplete = true;
    setTimeout(() => {
      gameCompleteScreen.style.display = 'flex';
    }, 500);
  } else {
    levelStats.textContent = `${currentLevelData.name} - ${kills} enemies eliminated`;
    setTimeout(() => {
      levelCompleteScreen.style.display = 'flex';
    }, 500);
  }
}

nextLevelBtn.addEventListener('click', () => {
  if (currentLevelData && currentLevelData.nextLevel) {
    loadLevel(currentLevelData.nextLevel);
  }
});

restartBtn.addEventListener('click', () => {
  loadLevel('levels/level1.json');
});

const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
if (!gl) { document.body.innerHTML = '<h1 style="color:#fff;text-align:center;margin-top:40vh">WebGL not supported</h1>'; throw 0; }
function resize() { canvas.width = window.innerWidth * devicePixelRatio; canvas.height = window.innerHeight * devicePixelRatio; gl.viewport(0, 0, canvas.width, canvas.height); }
window.addEventListener('resize', resize); resize();

// SHADERS
const VS = `attribute vec2 aPos; attribute vec4 aCol; attribute vec2 aUV; uniform vec2 uRes; uniform vec2 uCam; uniform float uScale; varying vec4 vCol; varying vec2 vUV;
void main(){ vec2 p=(aPos-uCam)*uScale; gl_Position=vec4(p.x/uRes.x*2.0,-p.y/uRes.y*2.0,0.0,1.0); vCol=aCol; vUV=aUV; }`;
const VS_HUD = `attribute vec2 aPos; attribute vec4 aCol; attribute vec2 aUV; uniform vec2 uRes; varying vec4 vCol; varying vec2 vUV;
void main(){ gl_Position=vec4(aPos.x/uRes.x*2.0-1.0,-(aPos.y/uRes.y*2.0-1.0),0.0,1.0); vCol=aCol; vUV=aUV; }`;
const FS = `precision mediump float; varying vec4 vCol; varying vec2 vUV; uniform sampler2D uTex; uniform float uUseTex;
void main(){ if(uUseTex>0.5){ vec4 t=texture2D(uTex,vUV); if(t.a<0.05) discard; gl_FragColor=t*vCol; } else { gl_FragColor=vCol; } }`;

function mkS(src, type) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
function mkP(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, mkS(vs, gl.VERTEX_SHADER)); gl.attachShader(p, mkS(fs, gl.FRAGMENT_SHADER)); gl.linkProgram(p); return p; }
const prog = mkP(VS, FS), progHUD = mkP(VS_HUD, FS);
function gL(p) { return { aPos: gl.getAttribLocation(p, 'aPos'), aCol: gl.getAttribLocation(p, 'aCol'), aUV: gl.getAttribLocation(p, 'aUV'), uRes: gl.getUniformLocation(p, 'uRes'), uCam: gl.getUniformLocation(p, 'uCam'), uScale: gl.getUniformLocation(p, 'uScale'), uTex: gl.getUniformLocation(p, 'uTex'), uUseTex: gl.getUniformLocation(p, 'uUseTex') }; }
const loc = gL(prog), locH = gL(progHUD);

// BATCH
const MV = 120000, FPV = 8, buf = new Float32Array(MV * FPV); let vc = 0;
const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.DYNAMIC_DRAW);
let curTex = null, curUT = 0, curProg, curLoc, curHUD;

function pV(x, y, r, g, b, a, u, v) { const i = vc * FPV; buf[i] = x; buf[i + 1] = y; buf[i + 2] = r; buf[i + 3] = g; buf[i + 4] = b; buf[i + 5] = a; buf[i + 6] = u; buf[i + 7] = v; vc++; }
function pQ(x, y, w, h, r, g, b, a) { if (vc + 6 > MV) return; const x2 = x + w, y2 = y + h; pV(x, y, r, g, b, a, -1, -1); pV(x2, y, r, g, b, a, -1, -1); pV(x2, y2, r, g, b, a, -1, -1); pV(x, y, r, g, b, a, -1, -1); pV(x2, y2, r, g, b, a, -1, -1); pV(x, y2, r, g, b, a, -1, -1); }
function pTQ(x, y, w, h, u1, v1, u2, v2, r, g, b, a) { if (vc + 6 > MV) return; const x2 = x + w, y2 = y + h; pV(x, y, r, g, b, a, u1, v1); pV(x2, y, r, g, b, a, u2, v1); pV(x2, y2, r, g, b, a, u2, v2); pV(x, y, r, g, b, a, u1, v1); pV(x2, y2, r, g, b, a, u2, v2); pV(x, y2, r, g, b, a, u1, v2); }
function pRQ(cx, cy, w, h, ang, r, g, b, a) {
  if (vc + 6 > MV) return; const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2, hh = h / 2,
    p = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], tx = p.map(v => cx + v[0] * c - v[1] * s), ty = p.map(v => cy + v[0] * s + v[1] * c);
  pV(tx[0], ty[0], r, g, b, a, -1, -1); pV(tx[1], ty[1], r, g, b, a, -1, -1); pV(tx[2], ty[2], r, g, b, a, -1, -1); pV(tx[0], ty[0], r, g, b, a, -1, -1); pV(tx[2], ty[2], r, g, b, a, -1, -1); pV(tx[3], ty[3], r, g, b, a, -1, -1);
}

function flush() {
  if (!vc) return; gl.useProgram(curProg); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, vc * FPV)); const st = FPV * 4;
  gl.enableVertexAttribArray(curLoc.aPos); gl.vertexAttribPointer(curLoc.aPos, 2, gl.FLOAT, false, st, 0);
  gl.enableVertexAttribArray(curLoc.aCol); gl.vertexAttribPointer(curLoc.aCol, 4, gl.FLOAT, false, st, 8);
  gl.enableVertexAttribArray(curLoc.aUV); gl.vertexAttribPointer(curLoc.aUV, 2, gl.FLOAT, false, st, 24);
  if (curHUD) { gl.uniform2f(curLoc.uRes, canvas.width, canvas.height); } else { gl.uniform2f(curLoc.uRes, canvas.width / 2, canvas.height / 2); gl.uniform2f(curLoc.uCam, cam.x, cam.y); gl.uniform1f(curLoc.uScale, cam.scale); }
  gl.uniform1f(curLoc.uUseTex, curUT); if (curTex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, curTex); gl.uniform1i(curLoc.uTex, 0); }
  gl.drawArrays(gl.TRIANGLES, 0, vc); vc = 0;
}

function setTx(tx) { if (tx !== curTex || (tx ? 1 : 0) !== curUT) { flush(); curTex = tx; curUT = tx ? 1 : 0; } }
function beginP(p, l, h) { curProg = p; curLoc = l; curHUD = h; vc = 0; curTex = null; curUT = 0; }
function endP() { flush(); }

// TEXTURES
// Tileset configuration loading
async function loadTilesetConfig() {
  try {
    const response = await fetch('tileset.json');
    if (!response.ok) throw new Error('Failed to load tileset.json');
    tileset = await response.json();
    tilesetLoaded = true;

  } catch (error) {
    console.error('Error loading tileset config:', error);
    // Fallback to hardcoded tile mapping
    tileset = null;
    tilesetLoaded = false;
  }
}

const tex = {}; const texImages = {}; let texLoaded = 0; const TOTAL_TEX = 6;
let playerSpriteGrid = { cols: 13, rows: 56 }; // Default grid for player sprite

function loadTex(name, src) {
  const t = gl.createTexture(); const img = new Image(); img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    tex[name] = t;
    texImages[name] = img;

    // Calculate player sprite grid when player texture loads
    if (name === 'player') {
      playerSpriteGrid = getPlayerSpriteGrid(playerAnimConfig, img);
    }

    texLoaded++;
  }; img.src = src;
}
loadTex('atlas', 'assets/the_atlas.png'); loadTex('player', 'assets/player2.png');
loadTex('enemy_grunt', 'assets/enemy_grunt.png'); loadTex('enemy_heavy', 'assets/enemy_heavy.png');
loadTex('enemy_scout', 'assets/enemy_scout.png'); loadTex('items', 'assets/items.png');

function tUV(c, r) { return { u1: c / 8, v1: r / 4, u2: (c + 1) / 8, v2: (r + 1) / 4 }; }
function cUV(c, r) { return { u1: c / 9, v1: r / 4, u2: (c + 1) / 9, v2: (r + 1) / 4 }; }
function iUV(c, r) { return { u1: c / 4, v1: r / 2, u2: (c + 1) / 4, v2: (r + 1) / 2 }; }

// Tile UV from tileset configuration
function getTileUV(tileType, tx, ty) {
  if (!tilesetLoaded || !tileset) {
    // Fallback mapping using atlas coordinates (32 columns, 32 rows)
    const cols = 32, rows = 32;
    let col = 0, row = 0;
    switch (tileType) {
      case 1: col = 0; row = 0; break; // wall
      case 2: col = 1 + (floorVar[ty * LW + tx] % 4); row = 0; break; // floor variations
      case 3: col = 1; row = 0; break; // door (uses floor)
      case 4: col = 7; row = 0; break; // obstacle
      case 5: col = 8; row = 0; break; // crate
      case 6: col = 9; row = 0; break; // barrel
      default: col = 0; row = 0;
    }
    return { u1: col / cols, v1: row / rows, u2: (col + 1) / cols, v2: (row + 1) / rows };
  }

  let tileDef = tileset.tileDefinitions.find(t => t.id === tileType);
  // Door uses floor tile graphics
  if (tileType === 3) {
    tileDef = tileset.tileDefinitions.find(t => t.id === 2) || tileDef;
  }
  if (!tileDef) {
    const cols = tileset.metadata.atlasColumns;
    const rows = tileset.metadata.atlasRows;
    return { u1: 0 / cols, v1: 0 / rows, u2: 1 / cols, v2: 1 / rows };
  }

  // Handle autotile rules and bitmask mapping
  if (tileDef.autotile) {
    const autotile = tileDef.autotile;
    const cols = tileset.metadata.atlasColumns;
    const rows = tileset.metadata.atlasRows;

    // Handle 2x2 and wang autotile types (tiles with neighbor-based mapping)
    if ((autotile.type === '2x2' || autotile.type === 'wang') && Array.isArray(autotile.rules) && autotile.rules.length >= 16) {
      // Determine neighbor types to check
      let neighborTypes = autotile.neighborTypes;
      if (!neighborTypes) {
        // Default neighbor types based on autotile type
        neighborTypes = autotile.type === 'wang' ? [2, 3] : [1]; // wang checks floor/door, 2x2 checks walls
      }
      // Create predicate function
      const predicate = (x, y) => neighborTypes.includes(gT(x, y));

      // Calculate 4-direction neighbor bitmask (north, east, south, west)
      const mask = getSideBitmask(tx, ty, predicate);
      // Ensure mask is within 0-15 range
      const ruleIndex = mask & 0xF; // mask is already 0-15
      const rule = autotile.rules[ruleIndex];

      if (Array.isArray(rule) && rule.length >= 2) {
        const [col, row] = rule;
        return {
          u1: col / cols,
          v1: row / rows,
          u2: (col + 1) / cols,
          v2: (row + 1) / rows
        };
      }
    }

    // Handle basic autotile type (12 tiles: 4 walls, 4 outer corners, 4 inner corners)
    if (autotile.type === 'basic' && Array.isArray(autotile.rules) && autotile.rules.length >= 12) {
      // Determine neighbor types to check
      let neighborTypes = autotile.neighborTypes;
      if (!neighborTypes) {
        neighborTypes = [2, 3]; // Default to checking for floor/door
      }

      // Calculate basic autotile index (0-11)
      const ruleIndex = getBasicAutotileIndex(tx, ty, neighborTypes);
      const rule = autotile.rules[ruleIndex];

      if (Array.isArray(rule) && rule.length >= 2) {
        const [col, row] = rule;
        return {
          u1: col / cols,
          v1: row / rows,
          u2: (col + 1) / cols,
          v2: (row + 1) / rows
        };
      }
    }

    // Check simple rules first (e.g., neighborBelowIsFloor) - only if rules are objects with condition
    if (autotile.rules && autotile.rules.length > 0 && typeof autotile.rules[0] === 'object' && autotile.rules[0].condition) {
      for (const rule of autotile.rules) {
        if (rule.condition === 'neighborBelowIsFloor') {
          const bl = gT(tx, ty + 1);
          if (bl === 2 || bl === 3) { // floor or door
            return {
              u1: rule.col / cols,
              v1: rule.row / rows,
              u2: (rule.col + 1) / cols,
              v2: (rule.row + 1) / rows
            };
          }
        }
        // Add other rule conditions here as needed
      }
    }

    // Check bitmask mapping (legacy format)
    if (autotile.bitmaskMap || autotile.bitmaskGrid) {
      // Determine neighbor types to check
      let neighborTypes = autotile.neighborTypes;
      if (!neighborTypes) {
        neighborTypes = [1]; // Default to walls for backward compatibility
      }
      const predicate = (x, y) => neighborTypes.includes(gT(x, y));

      // Determine mask type
      const maskType = autotile.bitmaskType || 'side';
      const mask = maskType === 'corner' ? getCornerBitmask(tx, ty, predicate) : getSideBitmask(tx, ty, predicate);

      let col, row;

      // Check bitmaskGrid first (grid-based layout)
      if (autotile.bitmaskGrid && Array.isArray(autotile.bitmaskGrid) && autotile.bitmaskGrid.length >= 4) {
        const [startCol, startRow, gridCols, gridRows] = autotile.bitmaskGrid;
        // Ensure mask within grid bounds
        const gridIndex = mask % (gridCols * gridRows);
        col = startCol + (gridIndex % gridCols);
        row = startRow + Math.floor(gridIndex / gridCols);
      }
      // Fallback to explicit bitmaskMap
      else if (autotile.bitmaskMap && autotile.bitmaskMap[mask]) {
        const mapping = autotile.bitmaskMap[mask];
        if (Array.isArray(mapping) && mapping.length >= 2) {
          col = mapping[0];
          row = mapping[1];
        }
      }

      if (col !== undefined && row !== undefined) {
        return {
          u1: col / cols,
          v1: row / rows,
          u2: (col + 1) / cols,
          v2: (row + 1) / rows
        };
      }
    }
  }

  // Variation-based (floor tiles) and door tiles (use floor variation)
  const floorOrDoor = tileType === 2 || tileType === 3;
  if (floorOrDoor && tileDef.autotile && tileDef.autotile.type === 'variation') {
    const variation = floorVar[ty * LW + tx] % tileDef.autotile.variationCount;
    const varDef = tileDef.variations[variation];
    if (varDef) {
      const cols = tileset.metadata.atlasColumns;
      const rows = tileset.metadata.atlasRows;
      return {
        u1: varDef.col / cols,
        v1: varDef.row / rows,
        u2: (varDef.col + 1) / cols,
        v2: (varDef.row + 1) / rows
      };
    }
  }

  // Default tile coordinates
  const cols = tileset.metadata.atlasColumns;
  const rows = tileset.metadata.atlasRows;
  let col = 0, row = 0;
  if (tileDef.atlasCol !== undefined && tileDef.atlasRow !== undefined) {
    col = tileDef.atlasCol;
    row = tileDef.atlasRow;
  } else {
    // Fallback for tiles without explicit coordinates (e.g., walls with autotile only)
    // Use hardcoded mapping similar to tileset-not-loaded case
    switch (tileType) {
      case 1: col = 0; row = 0; break; // wall
      case 2: col = 1 + (floorVar[ty * LW + tx] % 4); row = 0; break; // floor
      case 3: col = 1; row = 0; break; // door
      case 4: col = 7; row = 0; break; // obstacle
      case 5: col = 8; row = 0; break; // crate
      case 6: col = 9; row = 0; break; // barrel
      default: col = 0; row = 0;
    }
  }
  return {
    u1: col / cols,
    v1: row / rows,
    u2: (col + 1) / cols,
    v2: (row + 1) / rows
  };
}

// Calculate 2x2 corner bitmask for autotiling (Godot-style)
// Bits: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left
// A bit is set (1) if all 3 cells around that corner are walls
function getCornerBitmask(tx, ty, predicate = null) {
  let mask = 0;

  // Helper to check if cell is wall
  const isWall = (x, y) => gT(x, y) === TW;
  const check = predicate || isWall;

  // Top-left corner: check (tx-1,ty-1), (tx,ty-1), (tx-1,ty)
  if (check(tx - 1, ty - 1) && check(tx, ty - 1) && check(tx - 1, ty)) mask |= 1 << 0;

  // Top-right corner: check (tx,ty-1), (tx+1,ty-1), (tx+1,ty)
  if (check(tx, ty - 1) && check(tx + 1, ty - 1) && check(tx + 1, ty)) mask |= 1 << 1;

  // Bottom-right corner: check (tx+1,ty), (tx+1,ty+1), (tx,ty+1)
  if (check(tx + 1, ty) && check(tx + 1, ty + 1) && check(tx, ty + 1)) mask |= 1 << 2;

  // Bottom-left corner: check (tx-1,ty), (tx-1,ty+1), (tx,ty+1)
  if (check(tx - 1, ty) && check(tx - 1, ty + 1) && check(tx, ty + 1)) mask |= 1 << 3;

  return mask;
}

// Calculate side bitmask for autotiling (simple 4-direction)
// Bits: 0=north, 1=east, 2=south, 3=west
// A bit is set (1) if neighbor in that direction is wall
function getSideBitmask(tx, ty, predicate = null) {
  let mask = 0;
  const isWall = (x, y) => gT(x, y) === TW;
  const check = predicate || isWall;

  if (check(tx, ty - 1)) mask |= 1 << 0; // north
  if (check(tx + 1, ty)) mask |= 1 << 1; // east
  if (check(tx, ty + 1)) mask |= 1 << 2; // south
  if (check(tx - 1, ty)) mask |= 1 << 3; // west

  return mask;
}

// Calculate basic autotile index (0-11) for 12-tile set
// Implements user's description:
// Index 0: North wall - wall with wall below, walls left and right
// Index 1: East wall - wall with wall left, walls above and below
// Index 2: South wall - wall with wall above, walls left and right
// Index 3: West wall - wall with wall right, walls above and below
// Index 4: NE outer corner - walls north and east, floor NE diagonal
// Index 5: ES outer corner - walls east and south, floor SE diagonal
// Index 6: SW outer corner - walls south and west, floor SW diagonal
// Index 7: WN outer corner - walls west and north, floor NW diagonal
// Index 8: NW inner corner - walls north and west, floor SE diagonal (opposite)
// Index 9: NE inner corner - walls north and east, floor SW diagonal (opposite)
// Index 10: SE inner corner - walls south and east, floor NW diagonal (opposite)
// Index 11: SW inner corner - walls south and west, floor NE diagonal (opposite)
function getBasicAutotileIndex(x, y, neighborTypes = [2, 3]) {
  const isWall = (x, y) => gT(x, y) === 1;
  const isFloor = (x, y) => neighborTypes.includes(gT(x, y));

  if (isWall(x - 1, y) && isWall(x + 1, y) && isFloor(x, y + 1)) return 0
  if (isWall(x, y - 1) && isWall(x, y + 1) && isFloor(x - 1, y)) return 1
  if (isWall(x - 1, y) && isWall(x + 1, y) && isFloor(x, y - 1)) return 2

  return 3
  // // Straight walls
  // if (isWall(tx, ty - 1) && isWall(tx - 1, ty) && isWall(tx + 1, ty)) return 0; // North
  // if (isWall(tx + 1, ty) && isWall(tx, ty - 1) && isWall(tx, ty + 1)) return 1; // East
  // if (isWall(tx, ty + 1) && isWall(tx - 1, ty) && isWall(tx + 1, ty)) return 2; // South
  // if (isWall(tx - 1, ty) && isWall(tx, ty - 1) && isWall(tx, ty + 1)) return 3; // West
  //
  // // Outer corners
  // if (isWall(tx, ty - 1) && isWall(tx + 1, ty) && isFloor(tx + 1, ty - 1)) return 4; // NE
  // if (isWall(tx + 1, ty) && isWall(tx, ty + 1) && isFloor(tx + 1, ty + 1)) return 5; // ES
  // if (isWall(tx, ty + 1) && isWall(tx - 1, ty) && isFloor(tx - 1, ty + 1)) return 6; // SW
  // if (isWall(tx - 1, ty) && isWall(tx, ty - 1) && isFloor(tx - 1, ty - 1)) return 7; // WN
  //
  // // Inner corners
  // if (isWall(tx, ty - 1) && isWall(tx - 1, ty) && isFloor(tx + 1, ty + 1)) return 8;  // NW
  // if (isWall(tx, ty - 1) && isWall(tx + 1, ty) && isFloor(tx - 1, ty + 1)) return 9;  // NE
  // if (isWall(tx, ty + 1) && isWall(tx + 1, ty) && isFloor(tx - 1, ty - 1)) return 10; // SE
  // if (isWall(tx, ty + 1) && isWall(tx - 1, ty) && isFloor(tx + 1, ty - 1)) return 11; // SW

  return 0; // Default
}

// LEVEL
let T = TILE_SIZE, LW = 60, LH = 45, ld = new Uint8Array(LW * LH);
let floorVar = new Uint8Array(LW * LH);
const TW = 1, TF = 2, TD = 3, TO = 4, TC = 5, TB = 6, TSP = 7, TSE = 8, TA = 9, TH = 10;
function sT(x, y, v) { if (x >= 0 && x < LW && y >= 0 && y < LH) ld[y * LW + x] = v; }
function gT(x, y) { return (x >= 0 && x < LW && y >= 0 && y < LH) ? ld[y * LW + x] : TW; }
function isS(tx, ty) { const t = gT(tx, ty); return t === TW || t === TO || t === TC || t === TB; }
function w2t(wx, wy) { return { tx: Math.floor(wx / T), ty: Math.floor(wy / T) }; }
function rC(x, y, w, h) { const x1 = Math.floor(x / T), y1 = Math.floor(y / T), x2 = Math.floor((x + w - .01) / T), y2 = Math.floor((y + h - .01) / T); for (let ty = y1; ty <= y2; ty++)for (let tx = x1; tx <= x2; tx++)if (isS(tx, ty)) return true; return false; }
function hLOS(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy), st = Math.ceil(d / (T * .4)); for (let i = 0; i <= st; i++) { const t = i / st; if (isS(Math.floor((x1 + dx * t) / T), Math.floor((y1 + dy * t) / T))) return false; } return true; }

const rooms = [], corrs = [];
let pSpawn = { x: 6, y: 6 };
const eSpawns = [], pickups = [];

// CAMERA
const cam = { x: 0, y: 0, scale: 1 };
function updCam(tx, ty) { cam.scale = Math.min(canvas.width, canvas.height) / (T * 40); cam.x += (tx - cam.x) * .1; cam.y += (ty - cam.y) * .1; }

// PLAYER
const P = {
  x: pSpawn.x * T + T / 2, y: pSpawn.y * T + T / 2, w: 20, h: 20, speed: 150, angle: 0, hp: 100, mhp: 100, ammo: 50, mammo: 80,
  wpn: 'pistol', wi: 0, wpns: ['pistol', 'shotgun', 'melee'], ft: 0, fr: { pistol: .25, shotgun: .6, melee: .4 },
  mr: 50, md: 35, ms: 0, alive: true, inv: 0, dt: 0, dc: 0, ds: 600, dd: .12, af: 0, at: 0, dir: 0, st: 'idle'
};
const WS = { pistol: { d: 20, sp: .03, s: 800, r: 500, ac: 1, bc: 1 }, shotgun: { d: 12, sp: .15, s: 700, r: 300, ac: 2, bc: 5 } };
let bul = [], ebul = [];
function sBul(x, y, a, s, isE) { const ar = isE ? ebul : bul; for (let i = 0; i < (s.bc || 1); i++) { const an = a + (Math.random() - .5) * s.sp * 2; ar.push({ x, y, vx: Math.cos(an) * s.s, vy: Math.sin(an) * s.s, d: s.d, l: s.r / s.s }); } }

// ENEMIES
const ET = { grunt: { hp: 40, s: 80, fr: 1.2, dr: 280, d: 10, sp: .1, tn: 'enemy_grunt' }, heavy: { hp: 80, s: 50, fr: 2, dr: 320, d: 15, sp: .15, tn: 'enemy_heavy' }, scout: { hp: 25, s: 120, fr: .8, dr: 350, d: 8, sp: .05, tn: 'enemy_scout' } };
const enemies = [];

let particles = [], gt = 0, showMM = false, curRoom = null, kills = 0, totE = 0;
let gOver = false, gWon = false, shake = 0, shX = 0, shY = 0, mFlash = { a: false, x: 0, y: 0, t: 0 };
function spP(x, y, n, r, g, b, s, l) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = (Math.random() * .7 + .3) * s; particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: l * (.5 + Math.random() * .5), ml: l, r, g, b, sz: 2 + Math.random() * 3 }); } }
function fRoom(wx, wy) { const tx = Math.floor(wx / T), ty = Math.floor(wy / T); for (const r of rooms) if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r; for (const c of corrs) { if (Math.abs(c.x2 - c.x1) > Math.abs(c.y2 - c.y1)) { if (ty === c.y1 || ty === c.y1 + 1) if (tx >= Math.min(c.x1, c.x2) - 1 && tx <= Math.max(c.x1, c.x2) + 1) return { x: Math.min(c.x1, c.x2) - 1, y: c.y1, w: Math.abs(c.x2 - c.x1) + 3, h: 2, n: 'Corridor' }; } else { if (tx === c.x1 || tx === c.x1 + 1) if (ty >= Math.min(c.y1, c.y2) - 1 && ty <= Math.max(c.y1, c.y2) + 1) return { x: c.x1, y: Math.min(c.y1, c.y2) - 1, w: 2, h: Math.abs(c.y2 - c.y1) + 3, n: 'Corridor' }; } } return null; }
function inCorr(wx, wy) { const tx = Math.floor(wx / T), ty = Math.floor(wy / T); for (const c of corrs) { if (Math.abs(c.x2 - c.x1) > Math.abs(c.y2 - c.y1)) { if (ty === c.y1 || ty === c.y1 + 1) if (tx >= Math.min(c.x1, c.x2) - 1 && tx <= Math.max(c.x1, c.x2) + 1) return true; } else { if (tx === c.x1 || tx === c.x1 + 1) if (ty >= Math.min(c.y1, c.y2) - 1 && ty <= Math.max(c.y1, c.y2) + 1) return true; } } return false; }
function a2d(a) { const n = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (n > Math.PI * .25 && n <= Math.PI * .75) return 0; if (n > Math.PI * .75 && n <= Math.PI * 1.25) return 1; if (n > Math.PI * 1.25 && n <= Math.PI * 1.75) return 3; return 2; }

// INPUT
const keys = {}, mouse = { x: 0, y: 0, d: false, wx: 0, wy: 0 };
window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Digit1') P.wi = 0; if (e.code === 'Digit2') P.wi = 1; if (e.code === 'Digit3') P.wi = 2; if (e.code === 'KeyQ') P.wi = (P.wi + 1) % 3; P.wpn = P.wpns[P.wi]; });
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX * devicePixelRatio; mouse.y = e.clientY * devicePixelRatio; });
canvas.addEventListener('mousedown', e => { mouse.d = true; e.preventDefault(); });
canvas.addEventListener('mouseup', () => { mouse.d = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// UPDATE
let lastT = performance.now();
function update(dt) {
  if (gOver || gWon) return; gt += dt;
  mouse.wx = (mouse.x - canvas.width / 2) / cam.scale + cam.x; mouse.wy = (mouse.y - canvas.height / 2) / cam.scale + cam.y;
  P.angle = Math.atan2(mouse.wy - P.y, mouse.wx - P.x); P.dir = a2d(P.angle);
  let dx = 0, dy = 0; if (keys.KeyW || keys.ArrowUp) dy -= 1; if (keys.KeyS || keys.ArrowDown) dy += 1; if (keys.KeyA || keys.ArrowLeft) dx -= 1; if (keys.KeyD || keys.ArrowRight) dx += 1;
  if (dx || dy) { const l = Math.sqrt(dx * dx + dy * dy); dx /= l; dy /= l; }
  if (P.dc > 0) P.dc -= dt; if (keys.ShiftLeft && P.dc <= 0 && (dx || dy) && P.dt <= 0) { P.dt = P.dd; P.dc = .8; P.inv = P.dd; spP(P.x, P.y, 8, .3, .6, 1, 200, .3); }
  let spd = P.speed; if (P.dt > 0) { P.dt -= dt; spd = P.ds; } const hw = P.w / 2;
  const nx = P.x + dx * spd * dt; if (!rC(nx - hw, P.y - hw, P.w, P.h)) P.x = nx;
  const ny = P.y + dy * spd * dt; if (!rC(P.x - hw, ny - hw, P.w, P.h)) P.y = ny;
  if (P.inv > 0) P.inv -= dt; if (P.ft > 0) P.ft -= dt;

  // Animation state management
  const prevSt = P.st;
  P.at += dt;

  // Determine state priority: dash > shoot > melee > walk > idle
  if (P.dt > 0) {
    P.st = 'dash';
  } else if (P.ft > 0 && P.wpn !== 'melee' && mouse.d) {
    P.st = 'shoot';
  } else if (P.ms > 0) {
    P.st = 'slash';
  } else if (dx || dy) {
    P.st = 'walk';
  } else {
    P.st = 'idle';
  }

  // Reset animation frame when state changes
  if (P.st !== prevSt) {
    P.af = 0;
    P.at = 0;
  }

  // Update animation frame based on state
  const animName = getAnimNameFromState(P.st);
  const frameCount = getAnimFrameCount(playerAnimConfig, animName, P.dir);
  // const animSpeed = P.st === 'dash' ? 0.08 : P.st === 'shoot' ? 0.1 : P.st === 'slash' ? 0.06 : P.st === 'walk' ? 0.15 : 0.2;
  const animSpeed = playerAnimConfig.animSpeed[P.st]
  if (P.at > animSpeed) {
    P.at = 0;
    P.af = (P.af + 1) % frameCount;
  }

  if (mouse.d && P.ft <= 0) {
    if (P.wpn === 'melee') {
      P.ft = P.fr.melee; P.ms = .3; shake = .05; P.st = 'slash';
      for (const e of enemies) {
        if (!e.alive) continue; const ex = e.x - P.x, ey = e.y - P.y, ed = Math.sqrt(ex * ex + ey * ey);
        if (ed < P.mr) {
          let ad = Math.atan2(ey, ex) - P.angle; while (ad > Math.PI) ad -= Math.PI * 2; while (ad < -Math.PI) ad += Math.PI * 2;
          if (Math.abs(ad) < Math.PI * .6) {
            e.hp -= P.md; e.hf = .15; spP(e.x, e.y, 6, 1, .3, .1, 150, .3); shake = .1;
            if (e.hp <= 0) { e.alive = false; kills++; spP(e.x, e.y, 20, .8, .1, .05, 200, .5); } else { e.st = 'chase'; e.lx = P.x; e.ly = P.y; }
          }
        }
      }
    } else {
      const s = WS[P.wpn]; if (P.ammo >= s.ac) {
        P.ammo -= s.ac; P.ft = P.fr[P.wpn]; P.st = 'shoot';
        const md = 16, mx = P.x + Math.cos(P.angle) * md, my = P.y + Math.sin(P.angle) * md;
        sBul(mx, my, P.angle, s, false); mFlash = { a: true, x: mx, y: my, t: .06 }; shake = P.wpn === 'shotgun' ? .08 : .03;
      }
    }
  }
  if (P.ms > 0) P.ms -= dt;
  if (shake > 0) { shake -= dt; shX = (Math.random() - .5) * 8 * (shake / .1); shY = (Math.random() - .5) * 8 * (shake / .1); } else { shX = 0; shY = 0; }
  if (mFlash.a) { mFlash.t -= dt; if (mFlash.t <= 0) mFlash.a = false; }

  for (let i = bul.length - 1; i >= 0; i--) {
    const b = bul[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt;
    const tt = w2t(b.x, b.y); if (isS(tt.tx, tt.ty)) {
      spP(b.x, b.y, 3, 1, .8, .3, 100, .2);
      if (gT(tt.tx, tt.ty) === TB) {
        sT(tt.tx, tt.ty, TF); spP(tt.tx * T + T / 2, tt.ty * T + T / 2, 15, .8, .4, .1, 200, .5);
        for (const e of enemies) { if (!e.alive) continue; if (Math.sqrt((e.x - tt.tx * T - T / 2) ** 2 + (e.y - tt.ty * T - T / 2) ** 2) < T * 2.5) { e.hp -= 30; e.hf = .15; if (e.hp <= 0) { e.alive = false; kills++; spP(e.x, e.y, 20, .8, .1, .05, 200, .5); } } } shake = .15;
      }
      bul.splice(i, 1); continue;
    }
    let hit = false; for (const e of enemies) {
      if (!e.alive) continue; if (Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
        e.hp -= b.d; e.hf = .15; spP(b.x, b.y, 4, 1, .3, .1, 120, .2);
        if (e.hp <= 0) { e.alive = false; kills++; spP(e.x, e.y, 20, .8, .1, .05, 200, .5); } else { e.st = 'chase'; e.lx = P.x; e.ly = P.y; } hit = true; break;
      }
    }
    if (hit || b.l <= 0) bul.splice(i, 1);
  }

  for (let i = ebul.length - 1; i >= 0; i--) {
    const b = ebul[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt;
    if (isS(Math.floor(b.x / T), Math.floor(b.y / T))) { spP(b.x, b.y, 2, 1, .5, .2, 80, .15); ebul.splice(i, 1); continue; }
    if (P.inv <= 0 && Math.abs(b.x - P.x) < P.w / 2 && Math.abs(b.y - P.y) < P.h / 2) {
      P.hp -= b.d; P.inv = .3; shake = .1; spP(P.x, P.y, 6, 1, .2, .2, 100, .3); ebul.splice(i, 1);
      if (P.hp <= 0) { P.alive = false; gOver = true; spP(P.x, P.y, 30, .8, .2, .1, 250, .8); } continue;
    }
    if (b.l <= 0) ebul.splice(i, 1);
  }

  for (const e of enemies) {
    if (!e.alive) continue; if (e.hf > 0) e.hf -= dt; e.ft -= dt;
    const ex = P.x - e.x, ey = P.y - e.y, ed = Math.sqrt(ex * ex + ey * ey), cs = ed < e.dr && hLOS(e.x, e.y, P.x, P.y);
    let mov = false; e.aT += dt;
    if (e.st === 'patrol') {
      if (cs) { e.st = 'chase'; e.at = 5; e.lx = P.x; e.ly = P.y; for (const o of enemies) { if (o === e || !o.alive) continue; if (Math.sqrt((o.x - e.x) ** 2 + (o.y - e.y) ** 2) < 200) { o.st = 'chase'; o.at = 3; o.lx = P.x; o.ly = P.y; } } }
      else {
        const pp = e.pp[e.pi], px = pp.x - e.x, py = pp.y - e.y, pd = Math.sqrt(px * px + py * py);
        if (pd < 8) { e.pw += dt; if (e.pw > 1.5) { e.pw = 0; e.pi = (e.pi + 1) % e.pp.length; } }
        else { const mx = px / pd * e.s * dt * .5, my = py / pd * e.s * dt * .5; if (!rC(e.x + mx - e.w / 2, e.y - e.w / 2, e.w, e.h)) e.x += mx; if (!rC(e.x - e.w / 2, e.y + my - e.w / 2, e.w, e.h)) e.y += my; e.a = Math.atan2(py, px); mov = true; }
      }
    }
    else if (e.st === 'chase') {
      e.at -= dt; if (cs) {
        e.lx = P.x; e.ly = P.y; e.at = 5; e.a = Math.atan2(ey, ex);
        if (ed > 120) { const mx = ex / ed * e.s * dt, my = ey / ed * e.s * dt; if (!rC(e.x + mx - e.w / 2, e.y - e.w / 2, e.w, e.h)) e.x += mx; if (!rC(e.x - e.w / 2, e.y + my - e.w / 2, e.w, e.h)) e.y += my; mov = true; }
        if (e.ft <= 0) { e.ft = e.fr * (.8 + Math.random() * .4); sBul(e.x, e.y, e.a, { d: e.d, sp: e.sp, s: 500, r: 400, bc: 1 }, true); }
      }
      else {
        const lx = e.lx - e.x, ly = e.ly - e.y, ld2 = Math.sqrt(lx * lx + ly * ly); if (ld2 > 12) { const mx = lx / ld2 * e.s * dt, my = ly / ld2 * e.s * dt; if (!rC(e.x + mx - e.w / 2, e.y - e.w / 2, e.w, e.h)) e.x += mx; if (!rC(e.x - e.w / 2, e.y + my - e.w / 2, e.w, e.h)) e.y += my; e.a = Math.atan2(ly, lx); mov = true; }
        if (e.at <= 0) e.st = 'return';
      }
    }
    else if (e.st === 'return') {
      const sx = e.sx - e.x, sy = e.sy - e.y, sd = Math.sqrt(sx * sx + sy * sy);
      if (sd < 8) { e.st = 'patrol'; e.pi = 0; } else { const mx = sx / sd * e.s * dt * .6, my = sy / sd * e.s * dt * .6; if (!rC(e.x + mx - e.w / 2, e.y - e.w / 2, e.w, e.h)) e.x += mx; if (!rC(e.x - e.w / 2, e.y + my - e.w / 2, e.w, e.h)) e.y += my; e.a = Math.atan2(sy, sx); mov = true; }
      if (cs) { e.st = 'chase'; e.at = 5; e.lx = P.x; e.ly = P.y; }
    }
    e.dir = a2d(e.a); if (mov) { e.as = 'walk'; if (e.aT > .18) { e.aT = 0; e.af = (e.af + 1) % 4; } } else { e.as = 'idle'; e.af = 0; }
  }

  for (const p of pickups) {
    if (!p.active) continue; if (Math.sqrt((P.x - p.x) ** 2 + (P.y - p.y) ** 2) < 20) {
      if (p.type === 'ammo') { P.ammo = Math.min(P.ammo + 15, P.mammo); p.active = false; spP(p.x, p.y, 8, 1, .8, .2, 100, .3); }
      else if (p.type === 'health' && P.hp < P.mhp) { P.hp = Math.min(P.hp + 30, P.mhp); p.active = false; spP(p.x, p.y, 8, .2, 1, .3, 100, .3); }
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .95; p.vy *= .95; p.l -= dt; if (p.l <= 0) particles.splice(i, 1); }
  curRoom = fRoom(P.x, P.y); showMM = curRoom !== null || inCorr(P.x, P.y);

  // Check win condition
  if (kills >= totE && !isLevelComplete) {
    onLevelComplete();
  }

  updCam(P.x + shX, P.y + shY);
}

// RENDER
function render() {
  if (texLoaded < TOTAL_TEX) { gl.clearColor(.05, .04, .06, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  gl.clearColor(.03, .02, .04, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const hW = (canvas.width / 2) / cam.scale, hH = (canvas.height / 2) / cam.scale;
  const mnX = Math.max(0, Math.floor((cam.x - hW) / T) - 1), mnY = Math.max(0, Math.floor((cam.y - hH) / T) - 1);
  const mxX = Math.min(LW - 1, Math.ceil((cam.x + hW) / T) + 1), mxY = Math.min(LH - 1, Math.ceil((cam.y + hH) / T) + 1);

  beginP(prog, loc, false);
  // Tiles
  setTx(tex.atlas);
  for (let ty = mnY; ty <= mxY; ty++)for (let tx = mnX; tx <= mxX; tx++) {
    const t = gT(tx, ty); if (!t) continue;

    // Draw floor under obstacles, crates, barrels
    if (t === TO || t === TC || t === TB) {
      const floorUV = getTileUV(2, tx, ty); // Use floor tile with variation based on floorVar & 1
      pTQ(tx * T, ty * T, T, T, floorUV.u1, floorUV.v1, floorUV.u2, floorUV.v2, 1, 1, 1, 1);
    }

    // Get UV for the tile itself
    const uv = getTileUV(t, tx, ty);
    const tint = t === TD ? .85 : 1;
    pTQ(tx * T, ty * T, T, T, uv.u1, uv.v1, uv.u2, uv.v2, tint, tint, tint, 1);
  }

  // Pickups
  setTx(tex.items);
  for (const p of pickups) {
    if (!p.active) continue; const bob = Math.sin(gt * 3) * 2, pl = .9 + Math.sin(gt * 5) * .1;
    const uv = iUV(p.type === 'health' ? 0 : 1, 0); pTQ(p.x - 10, p.y - 10 + bob, 20, 20, uv.u1, uv.v1, uv.u2, uv.v2, pl, pl, pl, 1);
  }

  // Particles
  setTx(null); for (const p of particles) pQ(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz, p.r, p.g, p.b, p.l / p.ml);

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue; setTx(tex[e.tn]);
    let col = 0; if (e.as === 'walk') col = 1 + e.af; const uv = cUV(col, e.dir);
    const fl = e.hf > 0; pTQ(e.x - 16, e.y - 16, 32, 32, uv.u1, uv.v1, uv.u2, uv.v2, fl ? 3 : 1, fl ? .5 : 1, fl ? .5 : 1, 1);
    setTx(null); pQ(e.x - 12, e.y - 20, 24, 4, .15, .1, .1, .8); pQ(e.x - 12, e.y - 20, 24 * Math.max(0, e.hp / e.mhp), 4, .8, .15, .1, .9);
    if (e.st === 'chase') pQ(e.x - 2, e.y - 24, 4, 4, 1, .2, .1, .9);
  }

  // Bullets
  setTx(tex.items);
  for (const b of bul) { const uv = iUV(0, 1); pTQ(b.x - 5, b.y - 5, 10, 10, uv.u1, uv.v1, uv.u2, uv.v2, 1, 1, 1, 1); }
  for (const b of ebul) { const uv = iUV(1, 1); pTQ(b.x - 5, b.y - 5, 10, 10, uv.u1, uv.v1, uv.u2, uv.v2, 1, 1, 1, 1); }
  if (mFlash.a) { const uv = iUV(2, 1); pTQ(mFlash.x - 10, mFlash.y - 10, 20, 20, uv.u1, uv.v1, uv.u2, uv.v2, 1, 1, 1, .9); }

  // Player
  if (P.alive) {
    setTx(tex.player);

    // Get animation name from player state and use current animation frame
    const animName = getAnimNameFromState(P.st);
    const uv = getPlayerAnimUV(playerAnimConfig, animName, P.dir, P.af, playerSpriteGrid);
    const fl = P.inv > 0 && Math.sin(gt * 30) > 0;
    pTQ(P.x - 16, P.y - 16, 32, 32, uv.u1, uv.v1, uv.u2, uv.v2, fl ? 2 : 1, fl ? 2 : 1, fl ? 2 : 1, 1);

    if (P.wpn === 'melee' && P.ms > 0) {
      setTx(null);
      const sa = P.angle + Math.sin(P.ms * 20) * .8;
      pQ(P.x + Math.cos(sa) * 26 - 4, P.y + Math.sin(sa) * 26 - 4, 8, 8, .8, .85, .95, .8);
    }
  }
  endP();

  // HUD
  beginP(progHUD, locH, true); setTx(null);
  const W = canvas.width, H = canvas.height, hs = Math.min(W, H) / 800;
  pQ(18 * hs, H - 52 * hs, 204 * hs, 24 * hs, .15, .12, .12, .8); const hr = Math.max(0, P.hp / P.mhp); const hc = hr > .5 ? [.2, .7, .3] : hr > .25 ? [.8, .6, .1] : [.8, .15, .1];
  pQ(20 * hs, H - 50 * hs, 200 * hs * hr, 20 * hs, hc[0], hc[1], hc[2], .9);
  pQ(4 * hs, H - 45 * hs, 10 * hs, 3 * hs, .9, .2, .2, 1); pQ(6.5 * hs, H - 48 * hs, 3 * hs, 10 * hs, .9, .2, .2, 1);
  pQ(18 * hs, H - 28 * hs, 154 * hs, 16 * hs, .12, .12, .15, .8); pQ(20 * hs, H - 26 * hs, 150 * hs * (P.ammo / P.mammo), 12 * hs, .9, .7, .2, .9);
  const wiX = W - 120 * hs, wiY = H - 60 * hs; pQ(wiX, wiY, 100 * hs, 40 * hs, .08, .08, .1, .7);
  for (let i = 0; i < 3; i++) {
    const sx = wiX + 5 * hs + i * 32 * hs, ac = i === P.wi; pQ(sx, wiY + 5 * hs, 28 * hs, 30 * hs, ac ? .25 : .12, ac ? .25 : .12, ac ? .3 : .14, .9);
    if (i === 0) { pQ(sx + 8 * hs, wiY + 12 * hs, 12 * hs, 4 * hs, .6, .6, .65, 1); pQ(sx + 12 * hs, wiY + 16 * hs, 4 * hs, 10 * hs, .5, .5, .55, 1); }
    else if (i === 1) { pQ(sx + 4 * hs, wiY + 12 * hs, 20 * hs, 5 * hs, .6, .6, .65, 1); pQ(sx + 14 * hs, wiY + 17 * hs, 4 * hs, 8 * hs, .5, .5, .55, 1); }
    else pRQ(sx + 14 * hs, wiY + 18 * hs, 4 * hs, 20 * hs, -.3, .7, .7, .75, 1);
  }
  pQ(W - 120 * hs, 20 * hs, 100 * hs, 24 * hs, .08, .08, .1, .7); pQ(W - 114 * hs, 25 * hs, 12 * hs, 14 * hs, .8, .2, .15, 1); pQ(W - 112 * hs, 27 * hs, 3 * hs, 4 * hs, .1, .1, .1, 1); pQ(W - 107 * hs, 27 * hs, 3 * hs, 4 * hs, .1, .1, .1, 1);
  if (P.dc > 0) { pQ(20 * hs, H - 70 * hs, 50 * hs, 6 * hs, .1, .1, .15, .6); pQ(20 * hs, H - 70 * hs, 50 * hs * (1 - P.dc / .8), 6 * hs, .3, .5, 1, .8); }
  const cx = mouse.x, cy = mouse.y, cs = 10 * hs, ct = 2 * hs;
  pQ(cx - cs, cy - ct / 2, cs - 3 * hs, ct, 1, 1, 1, .7); pQ(cx + 3 * hs, cy - ct / 2, cs - 3 * hs, ct, 1, 1, 1, .7); pQ(cx - ct / 2, cy - cs, ct, cs - 3 * hs, 1, 1, 1, .7); pQ(cx - ct / 2, cy + 3 * hs, ct, cs - 3 * hs, 1, 1, 1, .7); pQ(cx - hs, cy - hs, 2 * hs, 2 * hs, 1, .3, .2, .9);

  if (showMM && curRoom) {
    const ms = 4 * hs, mp = 10 * hs, mx = W - LW * ms - mp, my = mp; pQ(mx - 4 * hs, my - 4 * hs, LW * ms + 8 * hs, LH * ms + 8 * hs, .03, .03, .05, .85);
    for (let ty = 0; ty < LH; ty++)for (let tx = 0; tx < LW; tx++) {
      const t = gT(tx, ty); if (!t) continue; let mr, mg, mb, ma;
      if (t === TW) { mr = .3; mg = .28; mb = .35; ma = .9; } else if (t === TF || t === TD) { mr = .15; mg = .14; mb = .18; ma = .7; }
      else if (t === TO) { mr = .35; mg = .33; mb = .4; ma = .9; } else if (t === TC) { mr = .4; mg = .3; mb = .15; ma = .9; }
      else if (t === TB) { mr = .45; mg = .2; mb = .08; ma = .9; } else continue; pQ(mx + tx * ms, my + ty * ms, ms, ms, mr, mg, mb, ma);
    }
    pQ(mx + curRoom.x * ms, my + curRoom.y * ms, curRoom.w * ms, curRoom.h * ms, .3, .4, .8, .15);
    for (const e of enemies) { if (!e.alive) continue; pQ(mx + e.x / T * ms - 1.5 * hs, my + e.y / T * ms - 1.5 * hs, 3 * hs, 3 * hs, e.st === 'chase' ? 1 : .7, .15, .1, .9); }
    pQ(mx + P.x / T * ms - 2 * hs, my + P.y / T * ms - 2 * hs, 4 * hs, 4 * hs, .3, .7, 1, 1);
    for (const p of pickups) { if (!p.active) continue; const c = p.type === 'ammo' ? [1, .8, .2] : [.2, 1, .3]; pQ(mx + p.x / T * ms - hs, my + p.y / T * ms - hs, 2 * hs, 2 * hs, c[0], c[1], c[2], .8); }
  }
  if (gOver) pQ(0, 0, W, H, .1, .02, .02, .7); if (gWon && !isLevelComplete) pQ(0, 0, W, H, .02, .08, .02, .6);
  endP();
  renderText();
}

const tc = document.createElement('canvas'); const ctx = tc.getContext('2d');
tc.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:1'; document.body.appendChild(tc);
function renderText() {
  tc.width = canvas.width; tc.height = canvas.height; ctx.clearRect(0, 0, tc.width, tc.height);
  const W = tc.width, H = tc.height, hs = Math.min(W, H) / 800; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(12 * hs)}px monospace`; ctx.fillStyle = '#ddd'; ctx.fillText(`${Math.max(0, Math.ceil(P.hp))}`, 24 * hs, H - 38 * hs);
  ctx.font = `${Math.round(10 * hs)}px monospace`; ctx.fillStyle = '#cca'; ctx.fillText(P.wpn === 'melee' ? 'MELEE' : `${P.ammo} ${P.wpn.toUpperCase()}`, 24 * hs, H - 15 * hs);
  ctx.font = `bold ${Math.round(12 * hs)}px monospace`; ctx.fillStyle = '#daa'; ctx.textAlign = 'right'; ctx.fillText(`${kills} / ${totE}`, W - 24 * hs, 34 * hs);
  if (curRoom) { ctx.font = `${Math.round(11 * hs)}px monospace`; ctx.fillStyle = 'rgba(180,190,220,0.7)'; ctx.textAlign = 'center'; ctx.fillText(curRoom.n, W / 2, 20 * hs); }
  ctx.font = `${Math.round(9 * hs)}px monospace`; ctx.fillStyle = 'rgba(150,150,170,0.5)'; ctx.textAlign = 'right'; ctx.fillText('1:Pistol  2:Shotgun  3:Melee', W - 24 * hs, H - 65 * hs);
  if (gt < 8) { const a = gt < 6 ? .7 : (8 - gt) / 2 * .7; ctx.font = `${Math.round(12 * hs)}px monospace`; ctx.fillStyle = `rgba(200,210,230,${a})`; ctx.textAlign = 'center'; ctx.fillText('WASD: Move | Mouse: Aim & Shoot | 1/2/3: Weapons | Shift: Dash', W / 2, H / 2 + 200 * hs); }
  if (showMM && curRoom) { const ms = 4 * hs, mp = 10 * hs; ctx.font = `bold ${Math.round(10 * hs)}px monospace`; ctx.fillStyle = 'rgba(180,190,220,0.7)'; ctx.textAlign = 'left'; ctx.fillText('MAP', W - LW * ms - mp, mp - 2); }
  if (!showMM) { ctx.font = `${Math.round(8 * hs)}px monospace`; ctx.fillStyle = 'rgba(150,150,170,0.5)'; ctx.textAlign = 'right'; ctx.fillText('ENTER ROOM FOR MAP', W - 22 * hs, 30 * hs); }
  if (P.dc > 0) { ctx.font = `${Math.round(8 * hs)}px monospace`; ctx.fillStyle = 'rgba(120,160,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText('DASH', 24 * hs, H - 80 * hs); }
  if (gOver) {
    ctx.font = `bold ${Math.round(48 * hs)}px monospace`; ctx.fillStyle = '#e82020'; ctx.textAlign = 'center'; ctx.fillText('YOU DIED', W / 2, H / 2 - 10 * hs);
    ctx.font = `${Math.round(16 * hs)}px monospace`; ctx.fillStyle = '#ccc'; ctx.fillText(`Kills: ${kills} / ${totE}`, W / 2, H / 2 + 40 * hs); ctx.fillText('Refresh to retry', W / 2, H / 2 + 65 * hs);
  }
  ctx.textAlign = 'left';
}

function loop(now) { const dt = Math.min((now - lastT) / 1000, .05); lastT = now; update(dt); render(); requestAnimationFrame(loop); }

// Initialize the game
(async () => {
  await loadTilesetConfig();
  await loadLevel('levels/level1.json');
  requestAnimationFrame(loop);
})();

