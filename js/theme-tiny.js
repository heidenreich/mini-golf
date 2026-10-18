'use strict';

// Tiny World: each hole is a floating island with hedges, trees, a duck pond
// and the odd sheep.

(() => {
  const ROUND = '"Fredoka", system-ui, sans-serif';

  // Three kinds of tree, seen from above: a round leafy one, a pine and a bush.
  function tree(ctx, x, y, r, kind) {
    ctx.fillStyle = 'rgba(20, 60, 20, 0.3)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + 6, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    if (kind === 1) {
      for (const [rr, col, rot] of [[r * 1.05, '#245f2e', 0], [r * 0.72, '#2f7a38', 0.4], [r * 0.4, '#3f9146', 0.8]]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = rot + (i * Math.PI) / 8, q = i % 2 ? rr * 0.62 : rr;
          i ? ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
        }
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 2) {
      ctx.fillStyle = '#4a9a3f';
      for (const [dx, dy, q] of [[-0.45, 0.1, 0.6], [0.4, 0.2, 0.55], [0, -0.3, 0.62]]) { circle(ctx, x + dx * r, y + dy * r, q * r); ctx.fill(); }
      ctx.fillStyle = '#ff8fb1';
      for (const [dx, dy] of [[-0.5, 0], [0.35, 0.3], [0.1, -0.45]]) { circle(ctx, x + dx * r, y + dy * r, 1.8); ctx.fill(); }
    } else {
      ctx.fillStyle = '#3f8f3e';
      circle(ctx, x, y, r); ctx.fill();
      ctx.fillStyle = 'rgba(140, 220, 110, 0.55)';
      circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.5); ctx.fill();
    }
  }

  function rock(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(20, 60, 20, 0.25)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 3, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9a9a8c';
    blob(ctx, x, y, r, r * 0.75, x * 0.1, 0.12); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.25, r * 0.4, r * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
  }

  function flowers(ctx, x, y, seed) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = rand(seed + i) > 0.5 ? '#fff27a' : '#ffffff';
      circle(ctx, x + (rand(seed + i * 2) - 0.5) * 16, y + (rand(seed + i * 3) - 0.5) * 12, 2.2); ctx.fill();
    }
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

  // Zones draw in two passes: 'static' parts go into the cached layer once per
  // hole, 'dynamic' parts (ripples, ducks, sparkles, moving arrows) every frame.
  function drawZone(ctx, z, t, pass) {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    if (z.type === 'sand') {
      if (pass !== 'static') return;
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
      // Footprints wandering across
      ctx.fillStyle = 'rgba(160, 130, 70, 0.4)';
      for (let i = 0; i < 6; i++) {
        const f = (i + 0.5) / 6, side = i % 2 ? 5 : -5;
        const fx = z.x + z.w * (0.15 + 0.7 * f), fy = z.y + z.h * (0.8 - 0.6 * f) + side;
        ctx.beginPath(); ctx.ellipse(fx, fy, 4, 2.6, -0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // A rake left at the edge
      const rx = z.x + z.w * 0.92, ry = z.y + z.h * 0.25;
      ctx.strokeStyle = '#b07a45';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 34, ry - 26); ctx.stroke();
      ctx.strokeStyle = '#8c8c86';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(rx - 8, ry - 10); ctx.lineTo(rx + 8, ry + 10); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        const px = rx + i * 2.3, py = ry + i * 2.9;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 4, py + 3); ctx.stroke();
      }
    } else if (z.type === 'water') {
      if (pass === 'static') {
        blob(ctx, cx, cy, z.w / 2 + 4, z.h / 2 + 4, z.y * 0.01, 0.05);
        ctx.fillStyle = '#c9e7a8';
        ctx.fill();
        blob(ctx, cx, cy, z.w / 2 - 1, z.h / 2 - 1, z.y * 0.01, 0.05);
        ctx.fillStyle = '#4fa3d9';
        ctx.fill();
        return;
      }
      ctx.save();
      blob(ctx, cx, cy, z.w / 2 - 1, z.h / 2 - 1, z.y * 0.01, 0.05);
      ctx.clip();
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
      // Lily pads bob, and a couple of glints drift across the surface
      for (const [px, py, pr, ph] of [[0.2, -0.25, 8, 0], [-0.25, 0.3, 6, 1.7]]) {
        const lx = cx + z.w * px, ly = cy + z.h * py, sc = 1 + 0.06 * Math.sin(t * 1.3 + ph);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(Math.sin(t * 0.7 + ph) * 0.15);
        ctx.scale(sc, sc);
        ctx.fillStyle = '#4c9a3c';
        ctx.beginPath(); ctx.arc(0, 0, pr, 0.4, Math.PI * 2 - 0.2); ctx.lineTo(0, 0); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 2; i++) {
        const u = (t * 0.06 + i * 0.5) % 1;
        const gx = cx + (u - 0.5) * z.w * 0.8, gy = cy + Math.sin(u * 6 + i) * z.h * 0.18 - z.h * 0.05;
        ctx.globalAlpha = Math.sin(u * Math.PI) * (0.5 + 0.5 * Math.sin(t * 4 + i * 2));
        ctx.fillRect(gx - 5, gy - 0.8, 10, 1.6);
        ctx.fillRect(gx - 0.8, gy - 3, 1.6, 6);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 2; i++) {
        const a = t * 0.5 + i * Math.PI;
        duck(ctx, cx + Math.cos(a) * z.w * 0.25, cy + Math.sin(a) * z.h * 0.25, a + Math.PI / 2);
      }
      ctx.restore();
    } else if (z.type === 'ice') {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 16);
      if (pass === 'static') {
        ctx.fillStyle = '#d4f1ff';
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        for (let i = -z.h; i < z.w; i += 34) {
          ctx.beginPath();
          ctx.moveTo(z.x + i, z.y + z.h);
          ctx.lineTo(z.x + i + z.h * 0.5, z.y);
          ctx.stroke();
        }
      } else {
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) {
          const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 2.1);
          const sx = z.x + 15 + rand(i + z.x) * (z.w - 30), sy = z.y + 15 + rand(i + z.y) * (z.h - 30);
          ctx.globalAlpha = tw;
          ctx.fillRect(sx - 4, sy - 0.75, 8, 1.5);
          ctx.fillRect(sx - 0.75, sy - 4, 1.5, 8);
        }
      }
      ctx.restore();
    } else if (z.type === 'slope') {
      if (pass === 'static') {
        // Lit on the uphill side, shaded downhill, so the slope reads at a glance
        const a = Math.atan2(z.ay, z.ax), ux = Math.cos(a), uy = Math.sin(a);
        const ext = Math.abs(ux) * z.w / 2 + Math.abs(uy) * z.h / 2;
        const g = ctx.createLinearGradient(cx - ux * ext, cy - uy * ext, cx + ux * ext, cy + uy * ext);
        g.addColorStop(0, 'rgba(255, 255, 220, 0.2)');
        g.addColorStop(1, 'rgba(20, 70, 20, 0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(z.x, z.y, z.w, z.h);
        return;
      }
      // Keep the moving arrows clear of the hedges.
      const m = WALL_HALF + 4;
      ctx.save();
      ctx.beginPath(); ctx.rect(z.x + m, z.y + m, z.w - 2 * m, z.h - 2 * m); ctx.clip();
      const a = Math.atan2(z.ay, z.ax);
      const gap = 40, offset = (t * 25) % gap;
      const reach = Math.hypot(z.w, z.h) / 2 + gap;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
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
    ctx.fillStyle = '#8d5730';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 23, w, 44, 6); ctx.fill();
    ctx.fillStyle = 'rgba(90, 50, 20, 0.35)';
    ctx.fillRect(x - w / 2, y - 1, w, 2);
    ctx.fillStyle = '#fff4df';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 7);
    ctx.textAlign = 'left';
  }

  function drawBackdrop(ctx, v) {
    const t = v.t;
    const seed = v.holeIndex * 31 + 7;
    dropShadow(ctx, false);

    // Drifting clouds (the sky itself is the canvas's CSS background)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < 5; i++) {
      const speed = 8 + rand(seed + i) * 10;
      const x = ((rand(seed + i + 0.3) * W + t * speed) % (W + 240)) - 120;
      blob(ctx, x, 30 + rand(seed + i + 0.6) * 540, 60 + rand(i) * 30, 20, i, 0.2);
      ctx.fill();
    }
  }

  function drawStatic(ctx, v) {
    const { hole } = v;
    const seed = v.holeIndex * 31 + 7;
    dropShadow(ctx, false);
    ctx.lineJoin = 'round';

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
        const f = d / e.len, off = 22 + rand(k) * 6;
        const x = e.a[0] + (e.b[0] - e.a[0]) * f + e.nx * off, y = e.a[1] + (e.b[1] - e.a[1]) * f + e.ny * off;
        const pick = rand(k + 0.9);
        if (pick < 0.15) rock(ctx, x, y, 7 + rand(k + 0.3) * 4);
        else if (pick < 0.3) flowers(ctx, x, y, k);
        else tree(ctx, x, y, 13 + rand(k + 0.1) * 5, Math.floor(rand(k + 0.5) * 3));
      }
    }

    if (v.showLabel) sign(ctx, hole.label[0], hole.label[1], `${hole.name} · Par ${hole.par}`);

    // Mowed fairway and its zones
    ctx.save();
    tracePoly(ctx, hole.shape);
    ctx.fillStyle = '#8fd16f';
    ctx.fill();
    ctx.clip();
    // Mowing stripes run from the tee toward the cup
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.atan2(hole.cup[1] - hole.start[1], hole.cup[0] - hole.start[0]));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    for (let y = -720; y < 720; y += 64) ctx.fillRect(-900, y, 1800, 32);
    ctx.restore();
    // A lighter mown collar just inside the hedges
    tracePoly(ctx, hole.shape);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 56;
    ctx.stroke();
    (hole.zones || []).forEach(z => drawZone(ctx, z, 0, 'static'));
    // The hedges' shadow falls on the grass (light from the top left)
    ctx.strokeStyle = 'rgba(20, 60, 20, 0.2)';
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    tracePoly(ctx, hole.shape, 3, 5);
    ctx.stroke();
    for (const [x1, y1, x2, y2] of hole.walls || []) {
      ctx.beginPath(); ctx.moveTo(x1 + 3, y1 + 5); ctx.lineTo(x2 + 3, y2 + 5); ctx.stroke();
    }
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

    // Cup: a pale collar, then a hole shaded darker toward the near edge, with
    // the far inner wall catching the light so it reads as deep
    const [cx, cy] = hole.cup;
    ctx.fillStyle = '#eef8e4';
    circle(ctx, cx, cy, CUP_R + 3.5); ctx.fill();
    ctx.strokeStyle = 'rgba(50, 100, 35, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const g = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, CUP_R);
    g.addColorStop(0, '#05080a');
    g.addColorStop(0.75, '#1b2614');
    g.addColorStop(1, '#3d5230');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, CUP_R); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, CUP_R - 1.6, Math.PI * 0.08, Math.PI * 0.62); ctx.stroke();
  }

  function drawDynamic(ctx, v) {
    const { hole, t } = v;
    const [cx, cy] = hole.cup;
    ctx.lineJoin = 'round';
    (hole.zones || []).forEach(z => drawZone(ctx, z, t, 'dynamic'));

    if (v.flagAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = v.flagAlpha;
      ctx.translate(cx, cy);
      if (v.rotated) ctx.rotate(Math.PI / 2);   // keep the pin pointing up on screen
      ctx.strokeStyle = 'rgba(20, 60, 20, 0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(30, 22); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -52); ctx.stroke();
      // The flag ripples: two waves travelling out along the cloth
      const w1 = Math.sin(t * 5.5) * 4.5, w2 = Math.sin(t * 5.5 - 1.6) * 3.5;
      const tip = 30 + Math.sin(t * 2.7) * 2;
      ctx.fillStyle = '#e8413c';
      ctx.beginPath();
      ctx.moveTo(0, -53);
      ctx.bezierCurveTo(10, -53 + w1, 20, -50 + w2, tip, -45 + w2 * 0.5);
      ctx.bezierCurveTo(20, -39 + w2, 10, -37 + w1, 0, -35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.moveTo(0, -53);
      ctx.bezierCurveTo(10, -53 + w1, 14, -51 + w2, 16, -48 + w2 * 0.5);
      ctx.lineTo(16, -42 + w2 * 0.5);
      ctx.bezierCurveTo(10, -38 + w1, 6, -36, 0, -35);
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

    // Ball: trail, shadow, then a white ball whose dimples roll over the top
    // in the direction of travel, squashed briefly by hard hits
    const b = v.ball;
    if (b.visible) {
      drawBallTrail(ctx, b, '#ffffff');
      ctx.fillStyle = 'rgba(20, 60, 20, 0.3)';
      ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 4, b.r, b.r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ballTransform(ctx, b);
      ctx.fillStyle = '#ffffff';
      circle(ctx, 0, 0, b.r); ctx.fill();
      const ux = Math.cos(b.dir), uy = Math.sin(b.dir);
      ctx.fillStyle = 'rgba(30, 50, 40, 0.22)';
      for (let k = 0; k < 4; k++) {
        const ph = b.spin + k * 1.6, front = Math.sin(ph);
        if (front <= 0) continue;
        const along = -Math.cos(ph) * b.r * 0.62, side = (k % 2 ? 1 : -1) * b.r * (0.18 + 0.12 * k / 3);
        circle(ctx, ux * along - uy * side, uy * along + ux * side, b.r * 0.17 * front); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.lineWidth = 1;
      circle(ctx, 0, 0, b.r); ctx.stroke();
      ctx.restore();
    }

    // Aim: white dotted line
    if (v.aim) {
      const { x: tx, y: ty, ux, uy } = v.aim.end;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.setLineDash([2, 8]);
      tracePath(ctx, v.aim.path);
      ctx.stroke();
      ctx.setLineDash([]);
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
    transition: 'rise',
    banner: 'ribbon',
    // World top is screen left when the course is turned for portrait.
    background: rotated => `linear-gradient(${rotated ? 'to right' : 'to bottom'}, #7cc6f2, #d6f0ff)`,
    drawBackdrop,
    drawStatic,
    drawDynamic,
    confetti: ['#ff8fb1', '#fff27a', '#ffffff', '#8fd16f'],
    splash: ['#4fa3d9', '#bfe3f7', '#ffffff'],
    impact: { wall: ['#1f5f28', '#2f7a35', '#fff27a', '#ff8fb1'], sand: ['#b08f45', '#c9a85c', '#8a6d30'] },
    waterToast: 'Splash! +1 stroke',
    tips: {
      sand: 'Sand bunker: slows the ball right down',
      water: 'Pond: +1 stroke and the ball goes back',
      ice: 'Ice: the ball slides much further',
      slope: 'Hill: pushes the ball the way the arrows point',
      spinner: 'Windmill: time your shot between the sails',
      sheep: 'Sheep wander about and will bump your ball',
    },
  };
})();
