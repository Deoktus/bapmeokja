// 픽셀 아트 스프라이트. 모든 좌표는 '논리 픽셀' 단위이고, 캔버스를 SCALE배로 키워 보여 준다.
export const SCALE = 2;
export const STAGE_H = 80;
export const GROUND_Y = 64;

export const DUCK_W = 24;
export const DUCK_FEET_Y = 23;
export const BLOCK_SIZE = 16;
// 오리가 점프해서 머리가 블록 밑면에 닿는 높이
export const JUMP_HEIGHT = 9;
export const BLOCK_TOP = GROUND_Y - (DUCK_FEET_Y - 3) - JUMP_HEIGHT - BLOCK_SIZE;
export const ITEM_SIZE = 12;

const C = {
  yellow: '#f0c92e',
  yellowLight: '#ffe033',
  yellowShade: '#d9ae1e',
  orange: '#e4531b',
  orangeDark: '#c94a10',
  black: '#000000',
  gray: '#6b6762',
  grayDark: '#55524d',
  shirt: '#b8afa5',
  tie: '#30211f',
  blue: '#5ac8fa',
  white: '#ffffff',
  cloud: '#8e949c',
  spark: '#fff7a8',
  sparkGold: '#ffd23f',
  blockFill: '#f8b800',
  blockLight: '#ffe066',
  blockShade: '#c86400',
  blockEdge: '#7c3a00',
  usedFill: '#a0643c',
  usedLight: '#c08458',
  usedShade: '#7a4624',
  usedEdge: '#4a2a12',
};

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawMatrix(ctx, rows, palette, x, y) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx += 1) {
      const color = palette[row[dx]];
      if (color) rect(ctx, x + dx, y + dy, 1, 1, color);
    }
  });
}

// 각 줄은 12글자, 12줄
const BURGER = {
  palette: { o: '#5a2e0c', B: '#f5c870', b: '#e8a84a', s: '#fff3c4', l: '#5ec23c', c: '#ffd23f', m: '#7a3b1d' },
  rows: [
    '............',
    '...oooooo...',
    '..oBBBBBBo..',
    '.oBBsBBsBBo.',
    '.obbbbbbbbo.',
    '.ollllllllo.',
    '.occcccccco.',
    '.ommmmmmmmo.',
    '.obbbbbbbbo.',
    '..oooooooo..',
    '............',
    '............',
  ],
};

const BROCCOLI = {
  palette: { d: '#2a6b20', G: '#6bd04a', g: '#3e9b2f', t: '#b6dd8a' },
  rows: [
    '....dddd....',
    '..ddGGGGdd..',
    '.dGGgGGgGGd.',
    '.dgGGgGGGgd.',
    '.dGgGGgGgGd.',
    '..ddgGGgdd..',
    '....dttd....',
    '....dttd....',
    '....dttd....',
    '...ddttdd...',
    '............',
    '............',
  ],
};

const EGGPLANT = {
  palette: { d: '#3d1f55', p: '#7b3fa0', P: '#b27ad8', g: '#3e9b2f' },
  rows: [
    '.....dd.....',
    '....dggd....',
    '...dppppd...',
    '..dpPPpppd..',
    '..dpPpppppd.',
    '..dppppppppd',
    '..dppppppppd',
    '...dppppppd.',
    '....dppppd..',
    '.....dppd...',
    '......dd....',
    '............',
  ],
};

export const ITEMS = { burger: BURGER, broccoli: BROCCOLI, eggplant: EGGPLANT };

export function drawItem(ctx, item, x, y) {
  drawMatrix(ctx, item.rows, item.palette, x, y);
}

const QUESTION_MARK = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];

export function drawBlock(ctx, x, y, used) {
  const fill = used ? C.usedFill : C.blockFill;
  const light = used ? C.usedLight : C.blockLight;
  const shade = used ? C.usedShade : C.blockShade;
  const edge = used ? C.usedEdge : C.blockEdge;
  const last = BLOCK_SIZE - 1;

  rect(ctx, x, y, BLOCK_SIZE, BLOCK_SIZE, edge);
  rect(ctx, x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2, fill);
  rect(ctx, x + 1, y + 1, BLOCK_SIZE - 2, 1, light);
  rect(ctx, x + 1, y + 1, 1, BLOCK_SIZE - 2, light);
  rect(ctx, x + 1, y + last - 1, BLOCK_SIZE - 2, 1, shade);
  rect(ctx, x + last - 1, y + 1, 1, BLOCK_SIZE - 2, shade);
  for (const [cx, cy] of [[2, 2], [13, 2], [2, 13], [13, 13]]) rect(ctx, x + cx, y + cy, 1, 1, edge);

  if (!used) {
    QUESTION_MARK.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx += 1) {
        if (row[dx] === '#') {
          rect(ctx, x + 6 + dx, y + 5 + dy, 1, 1, edge);
        }
      }
    });
  }
}

// 오른쪽을 보는 오리를 그린다. 왼쪽을 볼 때는 x좌표를 좌우로 뒤집는다.
export function drawDuck(ctx, x, y, pose = {}) {
  const { facing = 1, frame = 0, stand = false, eyes = 'open', headDY = 0, bodyDY = 0, wingUp = false, sweat = false, droop = false } = pose;
  const r = (dx, dy, w, h, color) => rect(ctx, facing > 0 ? x + dx : x + DUCK_W - dx - w, y + dy, w, h, color);

  const bodyTop = 12 + bodyDY;
  const headTop = 3 + headDY;

  r(5, DUCK_FEET_Y, 12, 1, 'rgba(0, 0, 0, 0.25)');

  // 다리: frame이 짝수면 왼쪽, 홀수면 오른쪽 다리가 들린다 (stand면 둘 다 땅에 붙인다)
  for (const [legX, lifted] of [[7, !stand && frame % 2 === 0], [11, !stand && frame % 2 === 1]]) {
    const bottom = lifted ? 21 : 22;
    r(legX, bodyTop + 8, 2, Math.max(0, bottom - (bodyTop + 8)), C.orange);
    r(legX, bottom, 3, 1, C.orangeDark);
  }

  r(5, bodyTop, 10, 8, C.gray);
  r(5, bodyTop + 7, 10, 1, C.grayDark);
  r(8, bodyTop, 4, 4, C.shirt);
  r(9, bodyTop + 1, 2, 5, C.tie);
  if (wingUp) r(14, bodyTop - 4, 2, 5, C.grayDark);
  else r(13, bodyTop + 1, 2, 5, C.grayDark);

  r(5, headTop, 10, 9, C.yellow);
  r(5, headTop, 10, 1, C.yellowLight);
  r(5, headTop + 8, 10, 1, C.yellowShade);

  const eyeY = headTop + 3;
  if (eyes === 'happy') {
    r(11, eyeY + 1, 1, 1, C.black);
    r(12, eyeY, 1, 1, C.black);
    r(13, eyeY + 1, 1, 1, C.black);
  } else if (eyes === 'sad') {
    r(11, eyeY - 1, 1, 1, C.black);
    r(12, eyeY, 1, 1, C.black);
    r(11, eyeY + 1, 1, 1, C.black);
  } else if (eyes === 'meh') {
    r(11, eyeY, 3, 1, C.yellowShade);
    r(11, eyeY + 1, 3, 1, C.black);
  } else {
    r(12, eyeY, 2, 2, C.black);
  }

  const beakY = headTop + 4 + (droop ? 1 : 0);
  r(15, beakY, 4, 2, C.orange);
  r(15, beakY + 2, 3, 1, C.orangeDark);

  if (sweat) {
    r(14, headTop + 1, 1, 2, C.blue);
    r(14, headTop + 1, 1, 1, C.white);
  }
}

export function drawSpark(ctx, cx, cy, color = C.spark) {
  rect(ctx, cx - 1, cy, 3, 1, color);
  rect(ctx, cx, cy - 1, 1, 3, color);
}

export const SPARK_COLORS = [C.spark, C.sparkGold];

export function drawTear(ctx, x, y) {
  rect(ctx, x, y, 1, 2, C.blue);
}

// 좌절할 때 머리 위에 뜨는 먹구름과 빗방울
export function drawGloom(ctx, x, y, rainPhase) {
  rect(ctx, x + 2, y, 6, 1, C.cloud);
  rect(ctx, x, y + 1, 10, 2, C.cloud);
  rect(ctx, x + 1, y + 3, 8, 1, C.cloud);
  for (const dx of [2, 5, 8]) {
    const drop = (rainPhase + dx) % 4;
    rect(ctx, x + dx, y + 4 + drop, 1, 1, C.blue);
  }
}

// 억지로 하는 느낌: 말줄임표 말풍선 (dots는 1~3)
export function drawEllipsisBubble(ctx, x, y, dots) {
  rect(ctx, x, y, 13, 7, C.shirt);
  rect(ctx, x + 1, y + 1, 11, 5, C.white);
  for (let i = 0; i < dots; i += 1) rect(ctx, x + 3 + i * 3, y + 3, 1, 1, C.black);
}
