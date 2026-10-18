'use strict';

// Tiny World: each hole is a floating island with hedges, trees, a duck pond
// and the odd sheep.

const THEMES = {};

(() => {
  const ROUND = '"Fredoka", system-ui, sans-serif';

  function tree(ctx, x, y, r, dark) {
    ctx.fillStyle = 'rgba(20, 60, 20, 0.3)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + 6, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark ? '#2f7d3a' : '#3f8f3e';
    circle(ctx, x, y, r); ctx.fill();
    ctx.fillStyle = 'rgba(140, 220, 110, 0.55)';
    circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.5); ctx.fill();
  }

  function sheep(ctx, x, y, facing) {
    ctx.fillStyle = 'rgba(20, 60, 20, 0.25)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 5, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbfbf7';
    for (const [dx, dy] of [[-6, -4], [0, -6], [6, -4], [-6, 4], [0, 6], [6, 4], [0, 0]]) {
      circle(ctx, x + dx, y + dy, 6.5); ctx.fill();
    }
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(x + facing * 14, y, 5.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    circle(ctx, x + facing * 16, y - 1.5, 1.2); ctx.fill();
  }

  function duck(ctx, x, y, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3c8f4a';
    circle(ctx, 6, 0, 3.2); ctx.fill();
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(8.5, -1, 3, 2);
    ctx.restore();
  }

  function drawZone(ctx, z, t) {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    if (z.type === 'sand') {
      blob(ctx, cx, cy, z.w / 2, z.h / 2, z.x * 0.01, 0.06);
      ctx.fillStyle = '#efdca4';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(190, 160, 90, 0.6)';
      ctx.lineWidth = 1.2;
      for (let r = 20; r < z.w + z.h; r += 7) {
        ctx.beginPath(); ctx.arc(cx, z.y + z.h + 30, r, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
      ctx.restore();
    } else if (z.type === 'water') {
      blob(ctx, cx, cy, z.w / 2 + 4, z.h / 2 + 4, z.y * 0.01, 0.05);
      ctx.fillStyle = '#c9e7a8';
      ctx.fill();
      blob(ctx, cx, cy, z.w / 2 - 1, z.h / 2 - 1, z.y * 0.01, 0.05);
      ctx.fillStyle = '#4fa3d9';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.4 + i / 3) % 1;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.ellipse(cx - z.w * 0.15, cy + z.h * 0.2, 4 + p * 16, 2 + p * 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#4c9a3c';
      ctx.beginPath();
      ctx.arc(cx + z.w * 0.2, cy - z.h * 0.25, 8, 0.4, Math.PI * 2 - 0.2);
      ctx.lineTo(cx + z.w * 0.2, cy - z.h * 0.25);
      ctx.fill();
      for (let i = 0; i < 2; i++) {
        const a = t * 0.5 + i * Math.PI;
        duck(ctx, cx + Math.cos(a) * z.w * 0.25, cy + Math.sin(a) * z.h * 0.25, a + Math.PI / 2);
      }
    } else if (z.type === 'ice') {
      ctx.fillStyle = '#d4f1ff';
      ctx.save();
      ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 16); ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      for (let i = -z.h; i < z.w; i += 34) {
        ctx.beginPath();
        ctx.moveTo(z.x + i, z.y + z.h);
        ctx.lineTo(z.x + i + z.h * 0.5, z.y);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 2.1);
        const sx = z.x + 15 + rand(i + z.x) * (z.w - 30), sy = z.y + 15 + rand(i + z.y) * (z.h - 30);
        ctx.globalAlpha = tw;
        ctx.fillRect(sx - 4, sy - 0.75, 8, 1.5);
        ctx.fillRect(sx - 0.75, sy - 4, 1.5, 8);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (z.type === 'slope') {
      ctx.fillStyle = 'rgba(40, 110, 40, 0.28)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.save();
      ctx.beginPath(); ctx.rect(z.x, z.y, z.w, z.h); ctx.clip();
      const a = Math.atan2(z.ay, z.ax);
      const gap = 40, offset = (t * 25) % gap;
      const reach = Math.hypot(z.w, z.h) / 2 + gap;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let d = -reach + offset; d < reach; d += gap) {
        for (let s = -reach; s < reach; s += 36) {
          ctx.save();
          ctx.translate(cx + Math.cos(a) * d - Math.sin(a) * s, cy + Math.sin(a) * d + Math.cos(a) * s);
          ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(4, 0); ctx.lineTo(-6, 8); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  function hedge(ctx, a, b, seed) {
    ctx.strokeStyle = '#2f7a35';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0, i = 0; d <= len; d += 11, i++) {
      const x = a[0] + ((b[0] - a[0]) * d) / len, y = a[1] + ((b[1] - a[1]) * d) / len;
      ctx.fillStyle = i % 2 ? '#3a8c3f' : '#34843a';
      circle(ctx, x, y - 1, 7.5); ctx.fill();
      const r = rand(seed + i);
      if (r > 0.86) {
        ctx.fillStyle = r > 0.93 ? '#ff8fb1' : '#fff27a';
        circle(ctx, x + 2, y - 3, 2); ctx.fill();
      }
    }
  }

  function sign(ctx, x, y, text) {
    ctx.fillStyle = '#7b4f2e';
    blob(ctx, x, y + 58, 70, 13, 6, 0.15); ctx.fill();
    ctx.fillStyle = '#5aa64a';
    blob(ctx, x, y + 48, 70, 11, 6, 0.15); ctx.fill();
    ctx.fillStyle = '#7a4a26';
    ctx.fillRect(x - 4, y + 12, 8, 38);
    ctx.font = `700 20px ${ROUND}`;
    const w = Math.max(150, ctx.measureText(text).width + 30);
    ctx.fillStyle = '#b67b46';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 23, w, 44, 6); ctx.fill();
    ctx.fillStyle = 'rgba(90, 50, 20, 0.35)';
    ctx.fillRect(x - w / 2, y - 1, w, 2);
    ctx.fillStyle = '#fff4df';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 7);
    ctx.textAlign = 'left';
  }

  function draw(ctx, v) {
    const { hole, t } = v;
    const seed = v.holeIndex * 31 + 7;
    dropShadow(ctx, false);
    ctx.lineJoin = 'round';

    // Sky and drifting clouds
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#7cc6f2');
    sky.addColorStop(1, '#d6f0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < 5; i++) {
      const speed = 8 + rand(seed + i) * 10;
      const x = ((rand(seed + i + 0.3) * W + t * speed) % (W + 240)) - 120;
      blob(ctx, x, 30 + rand(seed + i + 0.6) * 540, 60 + rand(i) * 30, 20, i, 0.2);
      ctx.fill();
    }

    // Island: dirt underside, then the grass top
    tracePoly(ctx, hole.shape, 0, 30);
    ctx.fillStyle = ctx.strokeStyle = '#7b4f2e';
    ctx.lineWidth = 70;
    ctx.fill(); ctx.stroke();
    tracePoly(ctx, hole.shape, 0, 18);
    ctx.fillStyle = ctx.strokeStyle = '#94643b';
    ctx.lineWidth = 72;
    ctx.fill(); ctx.stroke();
    tracePoly(ctx, hole.shape);
    ctx.fillStyle = ctx.strokeStyle = '#5aa64a';
    ctx.lineWidth = 70;
    ctx.fill(); ctx.stroke();

    // Trees around the rim
    let k = seed;
    for (const e of outwardEdges(hole.shape)) {
      for (let d = 40; d < e.len - 30; d += 95) {
        k++;
        if (rand(k + 0.9) < 0.3) continue;
        const f = d / e.len, off = 22 + rand(k) * 6;
        tree(ctx, e.a[0] + (e.b[0] - e.a[0]) * f + e.nx * off,
                  e.a[1] + (e.b[1] - e.a[1]) * f + e.ny * off, 13 + rand(k + 0.1) * 5, k % 2);
      }
    }

    if (hole.label) sign(ctx, hole.label[0], hole.label[1], `${hole.name} · Par ${hole.par}`);

    // Mowed fairway and its zones
    ctx.save();
    tracePoly(ctx, hole.shape);
    ctx.fillStyle = '#8fd16f';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 0; x < W; x += 40) {
      for (let y = 0; y < H; y += 40) if (((x + y) / 40) % 2 === 0) ctx.fillRect(x, y, 40, 40);
    }
    (hole.zones || []).forEach(z => drawZone(ctx, z, t));
    ctx.restore();

    // Tee box
    const [sx, sy] = hole.start;
    ctx.fillStyle = '#7cc95a';
    ctx.fillRect(sx - 22, sy - 12, 44, 24);
    ctx.fillStyle = '#ffffff';
    circle(ctx, sx - 16, sy, 3); ctx.fill();
    circle(ctx, sx + 16, sy, 3); ctx.fill();

    // Hedges
    wallSegments(hole).forEach(([a, b], i) => hedge(ctx, a, b, seed + i * 100));

    // Cup and pin flag
    const [cx, cy] = hole.cup;
    ctx.fillStyle = '#e9f6dc';
    circle(ctx, cx, cy, CUP_R + 2); ctx.fill();
    ctx.fillStyle = '#2a3b20';
    circle(ctx, cx, cy, CUP_R); ctx.fill();
    if (v.flagAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = v.flagAlpha;
      ctx.strokeStyle = 'rgba(20, 60, 20, 0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 30, cy + 22); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 52); ctx.stroke();
      const wave = Math.sin(t * 4) * 3;
      ctx.fillStyle = '#e8413c';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 52);
      ctx.quadraticCurveTo(cx + 14, cy - 50 + wave, cx + 28, cy - 44);
      ctx.quadraticCurveTo(cx + 14, cy - 38 - wave, cx, cy - 36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Sheep
    for (const s of v.movers) sheep(ctx, s.x, s.y, s.vx + s.vy * 0.01 >= 0 ? 1 : -1);

    // Windmills: two lattice sails around a little tower roof
    for (const s of v.spinners) {
      ctx.fillStyle = 'rgba(20, 60, 20, 0.25)';
      circle(ctx, s.cx + 5, s.cy + 7, 18); ctx.fill();
      along(ctx, [s.x1, s.y1], [s.x2, s.y2], len => {
        for (const [from, to] of [[0, len / 2 - 14], [len / 2 + 14, len]]) {
          ctx.fillStyle = 'rgba(255, 252, 240, 0.92)';
          ctx.fillRect(from, -8, to - from, 16);
          ctx.strokeStyle = '#7a4a26';
          ctx.lineWidth = 2;
          ctx.strokeRect(from, -8, to - from, 16);
          ctx.lineWidth = 1;
          for (let x = from + 9; x < to; x += 9) {
            ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x, 8); ctx.stroke();
          }
          ctx.beginPath(); ctx.moveTo(from, 0); ctx.lineTo(to, 0); ctx.stroke();
        }
      });
      ctx.fillStyle = '#c0533a';
      circle(ctx, s.cx, s.cy, 15); ctx.fill();
      ctx.strokeStyle = 'rgba(80, 20, 10, 0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(s.cx, s.cy);
        ctx.lineTo(s.cx + Math.cos(a) * 15, s.cy + Math.sin(a) * 15);
        ctx.stroke();
      }
      ctx.fillStyle = '#5a3a20';
      circle(ctx, s.cx, s.cy, 4); ctx.fill();
    }

    // Ball
    const b = v.ball;
    if (b.visible) {
      ctx.fillStyle = 'rgba(20, 60, 20, 0.3)';
      ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 4, b.r, b.r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      circle(ctx, b.x, b.y, b.r); ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Aim: white dotted line
    if (v.aim) {
      const { ux, uy, power } = v.aim;
      const reach = 30 + power * 140;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.moveTo(b.x + ux * 14, b.y + uy * 14);
      ctx.lineTo(b.x + ux * reach, b.y + uy * reach);
      ctx.stroke();
      ctx.setLineDash([]);
      const tx = b.x + ux * reach, ty = b.y + uy * reach;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(tx + ux * 9, ty + uy * 9);
      ctx.lineTo(tx - ux * 8 - uy * 8, ty - uy * 8 + ux * 8);
      ctx.lineTo(tx - ux * 8 + uy * 8, ty - uy * 8 - ux * 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  THEMES.tiny = {
    draw,
    confetti: ['#ff8fb1', '#fff27a', '#ffffff', '#8fd16f'],
  };
})();
