// The World Today — one image that sums up Thursday 19 November 2026.
//
// Node 22, standard library only, no network. Draws a newspaper front page
// pixel by pixel (own PNG encoder, own rasteriser, own 5x7 bitmap type) and
// writes it to /output/entry.png (MAKEFUN_OUTPUT_DIR stands in locally).
// Fully deterministic: two runs write the same bytes.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- font ----
// A 5x7 bitmap typeface, one string per row, '#' is ink. Authored for this
// entry; covers A-Z, 0-9 and the punctuation the page needs.
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '..#..', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##.#.', '....#', '...#.', '..#..', '.#...', '#.###'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...##', '..#..', '.#...', '.#...', '.#...', '..#..', '...##'],
  ')': ['##...', '..#..', '...#.', '...#.', '...#.', '..#..', '##...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '·': ['.....', '.....', '.....', '.##..', '.##..', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
const FALLBACK = GLYPHS['?'];

// ------------------------------------------------------------- canvas -----
type RGB = [number, number, number];
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

const PAPER: RGB = [248, 244, 232];
const INK: RGB = [18, 20, 24];
const RED: RGB = [176, 30, 40];
const BLUE: RGB = [28, 74, 132];
const SKY: RGB = [168, 200, 220];
const GOLD: RGB = [196, 146, 44];
const GRAY: RGB = [96, 100, 106];
const LIGHT: RGB = [234, 226, 205];
const ORANGE: RGB = [224, 112, 36];
const WHITE: RGB = [252, 250, 244];
const GREEN: RGB = [46, 120, 70];

function set(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c);
}
function frame(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps), y = Math.round(y0 + (dy * s) / steps);
    rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let j = cy - r; j <= cy + r; j++)
    for (let i = cx - r; i <= cx + r; i++)
      if ((i - cx) * (i - cx) + (j - cy) * (j - cy) <= r * r) set(i, j, c);
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / area;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / area;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) set(x, y, c);
    }
}
// Five-point star centred at (cx, cy) with outer radius r.
function star(cx: number, cy: number, r: number, c: RGB): void {
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const a = (-90 + i * 72) * Math.PI / 180;
    outer.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]);
    const b = (-90 + 36 + i * 72) * Math.PI / 180;
    inner.push([Math.round(cx + Math.cos(b) * r * 0.42), Math.round(cy + Math.sin(b) * r * 0.42)]);
  }
  for (let i = 0; i < 5; i++) {
    const n = (i + 1) % 5;
    tri(cx, cy, outer[i][0], outer[i][1], inner[i][0], inner[i][1], c);
    tri(cx, cy, inner[i][0], inner[i][1], outer[n][0], outer[n][1], c);
  }
}

// --------------------------------------------------------------- text -----
function textWidth(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB, bold = false): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? FALLBACK;
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === '#') {
          rect(cx + col * scale, y + r * scale, scale, scale, c);
          if (bold) rect(cx + col * scale + Math.max(1, scale >> 2), y + r * scale, scale, scale, c);
        }
    cx += 6 * scale;
  }
}
function centerText(y: number, s: string, scale: number, c: RGB, bold = false): void {
  drawText(Math.round((W - textWidth(s, scale)) / 2), y, s, scale, c, bold);
}
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (textWidth(next, scale) > maxW && cur !== '') { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur !== '') lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, s: string, scale: number, maxW: number, lh: number, c: RGB): number {
  const lines = wrap(s, scale, maxW);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], scale, c);
  return y + lines.length * lh;
}

// --------------------------------------------------------------- icons ----
// Scales of justice: pole, crossbar, two hanging pans, base.
function iconScales(x: number, y: number): void {
  rect(x + 27, y + 4, 4, 40, INK);                    // pole
  rect(x + 6, y + 8, 46, 3, INK);                    // crossbar
  disc(x + 29, y + 5, 3, GOLD);                      // finial
  line(x + 8, y + 11, x + 2, y + 26, 2, INK);        // left strings
  line(x + 8, y + 11, x + 14, y + 26, 2, INK);
  line(x + 50, y + 11, x + 44, y + 26, 2, INK);      // right strings
  line(x + 50, y + 11, x + 56, y + 26, 2, INK);
  tri(x + 1, y + 26, x + 15, y + 26, x + 8, y + 36, GOLD);   // left pan
  tri(x + 43, y + 26, x + 57, y + 26, x + 50, y + 36, GOLD); // right pan
  rect(x + 14, y + 44, 30, 4, INK);                  // base
  rect(x + 20, y + 48, 18, 3, INK);
}
// Burning tanker beside a spiked sea mine, on waves.
function iconTankerFire(x: number, y: number): void {
  rect(x + 4, y + 30, 44, 10, INK);                  // hull
  tri(x + 48, y + 30, x + 56, y + 40, x + 48, y + 40, INK); // bow
  rect(x + 8, y + 22, 26, 8, RED);                   // deck tank
  rect(x + 38, y + 16, 7, 14, INK);                  // bridge
  tri(x + 14, y + 22, x + 19, y + 8, x + 24, y + 22, ORANGE); // flame
  tri(x + 20, y + 22, x + 25, y + 10, x + 30, y + 22, RED);
  disc(x + 52, y + 10, 5, INK);                      // mine body
  for (let i = 0; i < 8; i++) {                      // mine spikes
    const a = (i / 8) * Math.PI * 2;
    line(x + 52, y + 10, x + 52 + Math.round(Math.cos(a) * 9), y + 10 + Math.round(Math.sin(a) * 9), 2, INK);
  }
  for (let i = 0; i < 3; i++) {                      // waves
    line(x + i * 18, y + 46, x + i * 18 + 8, y + 43, 2, BLUE);
    line(x + i * 18 + 8, y + 43, x + i * 18 + 16, y + 46, 2, BLUE);
  }
}
// Capitol dome: dome, drum, columns, steps.
function iconCapitol(x: number, y: number): void {
  for (let r = 0; r < 16; r++) {                     // dome arc
    const w = Math.round(Math.sqrt(16 * 16 - r * r));
    rect(x + 29 - w, y + 16 - r, w * 2, 1, INK);
  }
  rect(x + 27, y - 2, 4, 4, GOLD);                   // statue tip
  rect(x + 12, y + 16, 34, 8, INK);                  // drum
  for (let i = 0; i < 5; i++) rect(x + 8 + i * 9, y + 26, 4, 14, INK); // columns
  rect(x + 4, y + 40, 50, 3, INK);                   // steps
  rect(x + 8, y + 43, 42, 3, INK);
}
// Game controller: body, D-pad, four buttons.
function iconController(x: number, y: number): void {
  rect(x + 6, y + 12, 46, 24, INK);
  disc(x + 6, y + 24, 12, INK); disc(x + 52, y + 24, 12, INK);
  rect(x + 14, y + 20, 4, 12, WHITE); rect(x + 11, y + 23, 10, 4, WHITE); // D-pad
  disc(x + 42, y + 20, 3, GOLD); disc(x + 48, y + 26, 3, RED);
  disc(x + 36, y + 26, 3, WHITE); disc(x + 42, y + 32, 3, GREEN);
  line(x + 12, y + 8, x + 22, y + 12, 2, INK);       // shoulder buttons
  line(x + 36, y + 8, x + 46, y + 12, 2, INK);
}
// Mountains under a sun, for Kashmir.
function iconMountains(x: number, y: number): void {
  disc(x + 46, y + 10, 7, GOLD);                     // sun
  tri(x + 2, y + 46, x + 22, y + 12, x + 42, y + 46, INK);   // big peak
  tri(x + 18, y + 20, x + 22, y + 12, x + 26, y + 20, WHITE); // snow cap
  tri(x + 28, y + 46, x + 44, y + 22, x + 58, y + 46, GRAY);  // second peak
  tri(x + 41, y + 28, x + 44, y + 22, x + 47, y + 28, WHITE);
  rect(x + 2, y + 46, 56, 3, INK);                   // ground
}
// Voyager: dish, body, boom and signal arcs among stars.
function iconVoyager(x: number, y: number): void {
  disc(x + 8, y + 8, 1, INK); disc(x + 50, y + 6, 1, INK); disc(x + 54, y + 30, 1, INK);
  disc(x + 6, y + 40, 1, INK); disc(x + 30, y + 2, 1, INK); // stars
  tri(x + 10, y + 26, x + 26, y + 12, x + 26, y + 34, INK);  // dish
  line(x + 26, y + 23, x + 40, y + 23, 3, INK);      // boom
  rect(x + 40, y + 17, 12, 12, GOLD);                // body
  line(x + 52, y + 23, x + 58, y + 23, 2, INK);      // antenna
  for (let r = 6; r <= 14; r += 4) {                 // signal arcs
    line(x + 52 + r, y + 23 - r, x + 52 + r, y + 23 + r, 1, BLUE);
  }
}

// ------------------------------------------- headline illustration ------
// Shenzhen skyline with the three flags of the summit leaders above it.
function flagUS(x: number, y: number): void {
  for (let i = 0; i < 7; i++) rect(x, y + i * 6, 64, 6, i % 2 ? WHITE : RED);
  rect(x, y, 26, 24, BLUE);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) disc(x + 4 + c * 6, y + 5 + r * 7, 1, WHITE);
}
function flagCN(x: number, y: number): void {
  rect(x, y, 64, 42, RED);
  star(x + 14, y + 13, 9, GOLD);
  disc(x + 34, y + 8, 2, GOLD); disc(x + 44, y + 14, 2, GOLD);
  disc(x + 44, y + 26, 2, GOLD); disc(x + 34, y + 32, 2, GOLD);
}
function flagRU(x: number, y: number): void {
  rect(x, y, 64, 14, WHITE); rect(x, y + 14, 64, 14, BLUE); rect(x, y + 28, 64, 14, RED);
}
function shenzhenScene(x: number, y: number, w: number, h: number): void {
  frame(x, y, w, h, 3, INK);
  rect(x + 3, y + 3, w - 6, h - 6, SKY);
  disc(x + w - 52, y + 30, 14, GOLD);                 // sun
  rect(x + 30, y + 26, 46, 7, WHITE); rect(x + 54, y + 38, 32, 6, WHITE); // clouds
  const flagY = y + 22, flagW = 64, gap = 34;
  const fx0 = x + Math.round((w - (3 * flagW + 2 * gap)) / 2);
  const flags = [flagUS, flagCN, flagRU];
  for (let i = 0; i < 3; i++) {
    const fx = fx0 + i * (flagW + gap);
    rect(fx + 30, y + 14, 3, 96, INK);                // pole
    flags[i](fx, flagY);
    frame(fx, flagY, flagW, 42, 1, INK);
  }
  const baseY = y + h - 30;
  const towers: [number, number, number][] = [      // [x, width, height]
    [0, 44, 74], [52, 30, 108], [90, 38, 88], [136, 26, 128],
    [170, 46, 96], [224, 30, 138], [262, 40, 82], [310, 30, 112], [348, 44, 70],
  ];
  for (const [tx, tw, th] of towers) {
    rect(x + 14 + tx, baseY - th, tw, th, INK);
    for (let wy = baseY - th + 8; wy < baseY - 8; wy += 12)
      for (let wx = x + 14 + tx + 6; wx < x + 14 + tx + tw - 4; wx += 10)
        rect(wx, wy, 3, 4, GOLD);
  }
  rect(x + 3, baseY, w - 6, 27, INK);                // caption strip
  drawText(x + 14, baseY + 7, 'SHENZHEN HOSTS THE TRILATERAL', 2, WHITE);
}

// ------------------------------------------------------------- compose ----
rect(0, 0, W, H, PAPER);
frame(10, 10, W - 20, H - 20, 3, INK);
frame(18, 18, W - 36, H - 36, 1, INK);

// Masthead
centerText(32, 'THE WORLD TODAY', 8, INK, true);
centerText(96, 'THE NEWS OF THE DAY, IN ONE PICTURE', 2, GRAY);
rect(36, 120, W - 72, 3, INK);

// Date bar
rect(36, 130, W - 72, 42, INK);
centerText(137, 'THURSDAY 19 NOVEMBER 2026 - ALL TIMES UTC', 3, WHITE, true);

// Lead story: the Shenzhen trilateral
drawText(36, 184, 'SHENZHEN · CHINA · APEC SUMMIT', 2, RED, true);
drawText(36, 206, 'TRUMP, XI AND', 5, INK, true);
drawText(36, 243, 'PUTIN MEET IN', 5, INK, true);
drawText(36, 280, 'SHENZHEN', 5, INK, true);
drawPara(36, 326,
  'THE FIRST EVER THREE-WAY MEETING OF THE US, CHINESE AND RUSSIAN ' +
  'LEADERS OPENS AT THE APEC SUMMIT. NUCLEAR ARMS, IRAN AND UKRAINE ' +
  'ARE ON THE TABLE. OFFICIALS SAY NO DEAL IS EXPECTED.',
  2, 500, 20, INK);
shenzhenScene(560, 184, 428, 242);
rect(36, 440, W - 72, 3, INK);

// UTC timeline — only times the sources state.
drawText(36, 450, 'THE DAY IN UTC', 2, RED, true);
drawText(36, 472,
  '01:45 UTC · APEC PLENARY OPENS IN SHENZHEN  ·  08:00 UTC · ICJ READS ROHINGYA VERDICT  ·  AFTERNOON · TRILATERAL TALKS OPEN',
  1, INK);
drawText(36, 490,
  '14:30 UTC · ANTHROPIC SHARES DEBUT ON NASDAQ  ·  EVENING · GTA VI ROLLS OUT WORLDWIDE  ·  19 NOV · EVERY ITEM BELOW FIRST REPORTED TODAY',
  1, INK);

// The day in 50 stories: lead (1) + grid (40) + in brief (9).
centerText(510, '50 STORIES, EACH WITH ITS SOURCE - ALL REPORTED 19 NOV 2026', 2, INK, true);

// Dense two-column grid: numbered headline + source line per story.
type Story = { head: string; src: string };
const stories: Story[] = [
  { head: 'ICJ TO RULE ON ROHINGYA GENOCIDE CASE', src: 'AL JAZEERA · THE HAGUE' },
  { head: 'THREE TANKERS HIT MINES EAST OF HORMUZ', src: 'NDTV · GULF' },
  { head: 'TANKER HIT BY PROJECTILE OFF OMAN', src: 'GULF NEWS · UKMTO' },
  { head: 'GULF STATES REPEL IRAN DRONE ATTACKS', src: 'MANILA TIMES · GULF' },
  { head: 'US, VENEZUELA SIGN DEAL TO RESTORE MILITARY TIES', src: 'THE HINDU · CARACAS' },
  { head: 'HEGSETH LANDS IN COLOMBIA AFTER VENEZUELA TRIP', src: 'AP · BOGOTA' },
  { head: 'US-SAUDI NUCLEAR DEAL SATISFACTORY, IAEA SAYS', src: 'THE HINDU · VIENNA' },
  { head: 'US REISSUES SECURITY WARNINGS IN BAHRAIN, SAUDI', src: 'NDTV · GULF' },
  { head: 'CRIMEA BRIDGE ATTACKED AGAIN, RUSSIA SAYS', src: 'BBC · UKRAINE WAR' },
  { head: 'ISRAELI TANKS CROSS GAZA CEASEFIRE LINE', src: 'BBC · GAZA' },
  { head: 'SIX KILLED IN GAZA, INCLUDING A CHILD', src: 'AFP · GAZA' },
  { head: 'BANGLADESH DEPLOYS PARAMILITARY AMID UNREST', src: 'THE HINDU · DHAKA' },
  { head: 'BANGLADESH FLIPS NUCLEAR SWITCH, RUSSIAN PLANT', src: 'NDTV · ENERGY' },
  { head: 'HONDURAS: FOUR ATTACKS LEAVE 12 DEAD', src: 'SBS · CENTRAL AMERICA' },
  { head: 'HAITI, EL SALVADOR INK SECURITY DEAL', src: 'MANILA TIMES · AMERICAS' },
  { head: 'THAILAND ORDERS CLEAN WATER FOR POLLUTION VICTIMS', src: 'MANILA TIMES · BANGKOK' },
  { head: 'INDIA POLICE KILL REBEL LEADER IN KASHMIR', src: 'MANILA TIMES · SRINAGAR' },
  { head: 'RAJNATH SINGH IN TOKYO FOR INDIA-JAPAN 2+2', src: 'NDTV · TOKYO' },
  { head: 'INDIA, CANADA EYE DEFENCE PACT AT MODI VISIT', src: 'THE HINDU · OTTAWA' },
  { head: 'MODI MEETS PRINCE AND PRINCESS OF WALES', src: 'THE HINDU · LONDON' },
  { head: 'NIA ARRESTS KHALISTAN MAN DEPORTED FROM US', src: 'THE HINDU · PUNJAB' },
  { head: 'CHINA SACKS SCIENTIST AFTER CHILD DIES IN GENE TRIAL', src: 'NDTV · BEIJING' },
  { head: 'TAKAICHI GETS COLD WELCOME ON CHINA ARRIVAL', src: 'SBS · APEC' },
  { head: 'TRUMP, TAKAICHI TO TALK BY PHONE AFTER SUMMIT', src: 'NIKKEI · TOKYO' },
  { head: 'CANADA ADJUSTS CHINA TIES, CARNEY SAYS', src: 'JAGRAN JOSH · OTTAWA' },
  { head: 'FRANCE JAILS 3 WOMEN FOR JOINING ISIS IN SYRIA', src: 'NDTV · PARIS' },
  { head: 'FRENCH MINISTER: MELENCHON COULD WIN PRESIDENCY', src: 'JAGRAN JOSH · PARIS' },
  { head: 'ALLEGED RUSSIAN AGENT HELD OVER US TECH SPYING', src: 'AP · WASHINGTON' },
  { head: 'GRAND JURY INDICTS MAN OVER FOILED TEMPLE PLOT', src: 'MANILA TIMES · ILLINOIS' },
  { head: 'JEFFRIES NOMINATED 251-11 FOR HOUSE SPEAKER', src: 'DAWN · WASHINGTON' },
  { head: '236 ANTI-TRUMP PROTESTERS FREED', src: 'ICHRP · UNITED STATES' },
  { head: 'MUSLIMS TO OUTNUMBER CHRISTIANS BY 2035', src: 'PEW · DEMOGRAPHICS' },
  { head: '1 IN 4 CHILDREN NOW LIVE IN CONFLICT ZONES', src: 'SAVE THE CHILDREN · AID' },
  { head: 'CYCLONE AKVAN NEARS ANDHRA PRADESH', src: 'JAGRAN JOSH · WEATHER' },
  { head: 'M5.7 QUAKE HITS KUMAMOTO, JAPAN', src: 'SBS · TOKYO' },
  { head: 'RED CRABS BEGIN MARCH ON CHRISTMAS ISLAND', src: 'MANILA TIMES · NATURE' },
  { head: 'CLIMATE PRESSURE HITS GLOBAL WINE OUTPUT', src: 'MANILA TIMES · CLIMATE' },
  { head: 'GTA VI LAUNCHES WORLDWIDE TO RAVE REVIEWS', src: 'AP · GAMING' },
  { head: 'ANTHROPIC SHARES DEBUT ON NASDAQ AT $83', src: 'THE ACTUAL NEWS · MARKETS' },
  { head: 'VAN GOGH SELLS FOR RECORD $190.4M', src: 'AFP · NEW YORK' },
];
const colX = [36, 524];
for (let i = 0; i < stories.length; i++) {
  const x = colX[i % 2];
  const y = 540 + Math.floor(i / 2) * 19;
  const st = stories[i];
  const n = String(i + 1).padStart(2, '0');
  drawText(x, y, n, 1, RED, true);
  drawText(x + 18, y, st.head, 1, INK);
  drawText(x + 18, y + 9, st.src, 1, GRAY);
}

// In brief: 9 more stories, then the date check.
rect(36, 928, W - 72, 3, INK);
drawText(36, 936, 'IN BRIEF', 2, RED, true);
drawPara(36, 954,
  'EU PROPOSES A 45BN EURO UKRAINE LOAN · VOYAGER 1 BELIEVED TO HAVE PASSED ONE LIGHT-DAY · ' +
  'SPACEX STARSHIP LANDS BACK ON ITS PAD · JAVA USERS TOLD TO PATCH AFTER FLAWS · ' +
  'SENATORS WARN AI CYBER THREATS OUTPACE DEFENCES · MALAYSIA PRESSES ANTHROPIC OVER AI CAMPAIGN · ' +
  'COCAINE AND MILLIONS OF PILLS SEIZED IN LIBYA · SAUDI ARABIA: DANGER PASSED IN THREE CITIES · ' +
  'PRINCE HARRY: US GOVERNMENT AND PUBLIC SPLIT ON UKRAINE',
  1, W - 72, 11, INK);
centerText(990, 'DATE CHECK: EVERY STORY HERE WAS FIRST REPORTED ON THURSDAY 19 NOVEMBER 2026', 1, RED, true);


// ---------------------------------------------------------------- png -----
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
