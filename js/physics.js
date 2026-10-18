'use strict';

// ---- Tuning ---------------------------------------------------------------

const BALL_R = 7;
const CUP_R = 12;
const WALL_HALF = 7;             // collision half-thickness of every wall (walls are drawn ~14px)
const MAX_SPEED = 1300;          // px/s at full power
const POWER_CURVE = 1.5;         // speed = MAX_SPEED * power^curve: fine control low, full banks still possible
const CUP_CAPTURE_SPEED = 400;   // faster than this and the ball lips out
const RESTITUTION = 0.72;        // bounciness of walls and obstacles
const SOFT_IMPACT = 40;          // slower hits than this don't bounce (stops jitter against walls)

// k = proportional drag, decel = constant rolling resistance (px/s²)
const SURFACES = {
  grass: { k: 1.1, decel: 40 },
  sand:  { k: 4.5, decel: 220 },
  ice:   { k: 0.25, decel: 8 },
};

// ---- Geometry -------------------------------------------------------------

function isEllipseZone(z) {
  return z.type === 'water' || z.type === 'sand';
}

function zoneContains(z, x, y) {
  if (isEllipseZone(z)) {
    const dx = (x - (z.x + z.w / 2)) / (z.w / 2);
    const dy = (y - (z.y + z.h / 2)) / (z.h / 2);
    return dx * dx + dy * dy <= 1;
  }
  return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
}

function zoneAt(hole, x, y) {
  const zones = hole.zones || [];
  for (let i = zones.length - 1; i >= 0; i--) {
    if (zoneContains(zones[i], x, y)) return zones[i];
  }
  return null;
}

function insidePolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function boundarySegments(hole) {
  return wallSegments(hole).map(([[x1, y1], [x2, y2]]) => ({ x1, y1, x2, y2 }));
}

function spinnerSegments(hole, t) {
  return (hole.spinners || []).map(s => {
    const a = t * s.speed;
    const dx = Math.cos(a) * s.len, dy = Math.sin(a) * s.len;
    return { x1: s.x - dx, y1: s.y - dy, x2: s.x + dx, y2: s.y + dy, spin: s.speed, cx: s.x, cy: s.y };
  });
}

// Movers ease back and forth between their two points.
function moverState(m, t) {
  const w = (Math.PI * 2) / m.period;
  const a = w * t + m.phase;
  const f = 0.5 - 0.5 * Math.cos(a);
  const df = 0.5 * w * Math.sin(a);
  return {
    x: m.x1 + (m.x2 - m.x1) * f,
    y: m.y1 + (m.y2 - m.y1) * f,
    vx: (m.x2 - m.x1) * df,
    vy: (m.y2 - m.y1) * df,
    m,
  };
}

function moverStates(hole, t) {
  return (hole.movers || []).map(m => moverState(m, t));
}

// ---- Collisions -----------------------------------------------------------

// Pushes the ball out along normal (nx, ny) to distance R from point (cx, cy)
// and reflects its velocity relative to the surface velocity (svx, svy), so
// moving obstacles can knock a ball. Returns the impact speed.
function bounce(b, cx, cy, nx, ny, R, svx, svy) {
  b.x = cx + nx * R;
  b.y = cy + ny * R;
  const rvx = b.vx - svx, rvy = b.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const tvx = rvx - vn * nx, tvy = rvy - vn * ny;
  const e = -vn < SOFT_IMPACT ? 0 : RESTITUTION;
  b.vx = svx + tvx * 0.95 - vn * e * nx;
  b.vy = svy + tvy * 0.95 - vn * e * ny;
  return -vn;
}

function collideSegments(b, segs) {
  const R = BALL_R + WALL_HALF;
  let impact = 0;
  for (const s of segs) {
    const ex = s.x2 - s.x1, ey = s.y2 - s.y1;
    const len2 = ex * ex + ey * ey;
    let t = len2 ? ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = s.x1 + ex * t, cy = s.y1 + ey * t;
    const dx = b.x - cx, dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;

    let nx, ny;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = dx / d; ny = dy / d;
    } else {
      const l = Math.sqrt(len2) || 1;
      nx = -ey / l; ny = ex / l;
    }
    let svx = 0, svy = 0;
    if (s.spin) {
      svx = -s.spin * (cy - s.cy);
      svy = s.spin * (cx - s.cx);
    }
    impact = Math.max(impact, bounce(b, cx, cy, nx, ny, R, svx, svy));
  }
  return impact;
}

function collideMovers(b, movers) {
  let impact = 0;
  for (const s of movers) {
    const R = BALL_R + s.m.r;
    const dx = b.x - s.x, dy = b.y - s.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    const d = Math.sqrt(d2);
    const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
    impact = Math.max(impact, bounce(b, s.x, s.y, nx, ny, R, s.vx, s.vy));
  }
  return impact;
}
