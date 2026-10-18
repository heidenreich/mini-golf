'use strict';

// Small canvas helpers shared by the themes.

const W = 900, H = 600;   // world size; the canvas scales to fit

const rand = n => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

function tracePoly(ctx, pts, dx = 0, dy = 0) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
  ctx.closePath();
}

// A wobbly closed shape around an ellipse. Keep wobble small (< 0.1) when
// the shape stands in for an ellipse-shaped physics zone.
function blob(ctx, cx, cy, rx, ry, seed, wobble) {
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    let k = 1;
    for (let h = 2; h <= 5; h++) k += (Math.sin(a * h + seed * h * 1.7) * wobble) / h;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// Runs fn(len) with the canvas rotated so a -> b lies along +x from 0 to len.
function along(ctx, a, b, fn) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  ctx.save();
  ctx.translate(a[0], a[1]);
  ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
  fn(len);
  ctx.restore();
}

function dropShadow(ctx, on, color = 'rgba(40, 20, 5, 0.4)', blur = 6, ox = 3, oy = 4) {
  ctx.shadowColor = on ? color : 'transparent';
  ctx.shadowBlur = on ? blur : 0;
  ctx.shadowOffsetX = on ? ox : 0;
  ctx.shadowOffsetY = on ? oy : 0;
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// Outward unit normal for each edge of a polygon, whichever way it winds.
function outwardEdges(shape) {
  let area = 0;
  shape.forEach(([x1, y1], i) => {
    const [x2, y2] = shape[(i + 1) % shape.length];
    area += x1 * y2 - x2 * y1;
  });
  const sign = area > 0 ? 1 : -1;
  return shape.map((a, i) => {
    const b = shape[(i + 1) % shape.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { a, b, len, nx: (sign * (b[1] - a[1])) / len, ny: (sign * -(b[0] - a[0])) / len };
  });
}

function wallSegments(hole) {
  const segs = outwardEdges(hole.shape).map(e => [e.a, e.b]);
  for (const [x1, y1, x2, y2] of hole.walls || []) segs.push([[x1, y1], [x2, y2]]);
  return segs;
}
