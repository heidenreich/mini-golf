'use strict';

// Desk Course: mini golf on a messy desk. A cutting mat is the fairway,
// rulers and pencils are the walls, and the cup is a coffee mug.

(() => {
  const HAND = '"Caveat", "Comic Sans MS", cursive';

  function drawRuler(ctx, len) {
    ctx.fillStyle = '#f3d77a';
    ctx.fillRect(-8, -9, len + 16, 18);
    dropShadow(ctx, false);
    ctx.strokeStyle = '#a8842f';
    ctx.lineWidth = 1;
    ctx.strokeRect(-8, -9, len + 16, 18);
    ctx.strokeStyle = '#6b5418';
    ctx.fillStyle = '#6b5418';
    ctx.font = '7px system-ui, sans-serif';
    for (let x = 0; x <= len; x += 10) {
      const long = x % 50 === 0;
      ctx.beginPath();
      ctx.moveTo(x, -9);
      ctx.lineTo(x, -9 + (long ? 8 : 4));
      ctx.stroke();
      if (long && x > 0 && x < len) ctx.fillText(String(x / 10), x - 3, 6);
    }
  }

  function drawPencil(ctx, len) {
    const tip = 24, cap = 18;
    ctx.fillStyle = '#f6c343';
    ctx.fillRect(cap, -7, len - cap - tip, 14);
    dropShadow(ctx, false);
    ctx.fillStyle = '#fbd96b';
    ctx.fillRect(cap, -7, len - cap - tip, 4);
    ctx.fillStyle = '#d99f1f';
    ctx.fillRect(cap, 3, len - cap - tip, 4);
    ctx.fillStyle = '#b9bcc2';
    ctx.fillRect(cap - 8, -7, 8, 14);
    ctx.fillStyle = '#f08a9b';
    ctx.beginPath();
    ctx.roundRect(-4, -7, cap - 4, 14, [5, 0, 0, 5]);
    ctx.fill();
    ctx.fillStyle = '#e9c49a';
    ctx.beginPath();
    ctx.moveTo(len - tip, -7); ctx.lineTo(len, 0); ctx.lineTo(len - tip, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(len - 8, -2.4); ctx.lineTo(len, 0); ctx.lineTo(len - 8, 2.4);
    ctx.closePath();
    ctx.fill();
  }

  function drawEraser(ctx, len) {
    ctx.fillStyle = '#f49ac1';
    ctx.beginPath();
    ctx.roundRect(-6, -11, len + 12, 22, 5);
    ctx.fill();
    dropShadow(ctx, false);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(len * 0.3, -11, len * 0.45, 22);
    ctx.fillStyle = '#3b6fd8';
    ctx.font = `700 13px ${HAND}`;
    ctx.fillText('ERASE', len * 0.33, 4);
  }

  function paperclip(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = '#a7b0ba';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(-22, 8);
    ctx.arc(-22, 0, 8, Math.PI / 2, -Math.PI / 2);
    ctx.lineTo(26, -8);
    ctx.arc(26, -2, 6, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-16, 4);
    ctx.arc(-16, 0, 4, Math.PI / 2, -Math.PI / 2);
    ctx.lineTo(14, -4);
    ctx.stroke();
    ctx.restore();
  }

  function stickyNote(ctx, x, y, hole, index) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.06);
    dropShadow(ctx, true);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(0, 0, 140, 100);
    dropShadow(ctx, false);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, 140, 16);
    ctx.fillStyle = '#2a2118';
    ctx.font = `700 26px ${HAND}`;
    ctx.fillText(`Hole ${index + 1}`, 14, 42);
    ctx.font = `600 21px ${HAND}`;
    ctx.fillText(hole.name, 14, 66);
    ctx.fillText(`Par ${hole.par}`, 14, 88);
    ctx.restore();
  }

  function deskFan(ctx, x, y, angle, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    dropShadow(ctx, true);
    ctx.fillStyle = '#5b6573';
    ctx.fillRect(-34, -16, 18, 32);
    ctx.fillStyle = '#e9edf2';
    circle(ctx, 0, 0, 30); ctx.fill();
    dropShadow(ctx, false);
    ctx.fillStyle = '#9fb7d0';
    for (let i = 0; i < 3; i++) {
      const a = t * 18 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 13, Math.sin(a) * 13, 13, 6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(80, 90, 105, 0.7)';
    ctx.lineWidth = 1.2;
    for (let r = 10; r <= 28; r += 9) { circle(ctx, 0, 0, r); ctx.stroke(); }
    ctx.fillStyle = '#5b6573';
    circle(ctx, 0, 0, 5); ctx.fill();
    ctx.restore();
  }

  function drawZone(ctx, z, t) {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    if (z.type === 'sand') {
      // Pile of eraser shavings: dry, crumbly, slow
      blob(ctx, cx, cy, z.w / 2, z.h / 2, z.x * 0.013, 0.07);
      ctx.fillStyle = 'rgba(244, 170, 196, 0.45)';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.lineCap = 'round';
      const count = Math.round((z.w * z.h) / 70);
      for (let i = 0; i < count; i++) {
        const a = rand(z.x + i) * Math.PI * 2, d = Math.sqrt(rand(z.y + i * 1.3));
        const px = cx + Math.cos(a) * d * z.w / 2, py = cy + Math.sin(a) * d * z.h / 2;
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(150, 150, 160, 0.8)' : i % 2 ? '#f08ab0' : '#f7b8cf';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(px, py, 2.5 + rand(i) * 2, rand(i + 0.5) * 6, rand(i + 0.5) * 6 + 2.6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (z.type === 'water') {
      // Ink blot
      blob(ctx, cx, cy, z.w / 2, z.h / 2, z.y * 0.017, 0.07 + Math.sin(t * 2) * 0.01);
      ctx.fillStyle = '#16205a';
      ctx.fill();
      blob(ctx, cx - z.w * 0.12, cy - z.h * 0.15, z.w * 0.16, z.h * 0.09, 5, 0.1);
      ctx.fillStyle = 'rgba(140, 170, 255, 0.25)';
      ctx.fill();
      ctx.fillStyle = '#16205a';
      for (let i = 0; i < 4; i++) {
        const a = rand(z.x + i) * Math.PI * 2;
        circle(ctx, cx + Math.cos(a) * (z.w / 2 + 10), cy + Math.sin(a) * (z.h / 2 + 10), 2.5 + rand(i) * 2.5);
        ctx.fill();
      }
    } else if (z.type === 'ice') {
      // Slick plastic sleeve
      ctx.fillStyle = 'rgba(170, 210, 255, 0.35)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
      ctx.save();
      ctx.beginPath(); ctx.rect(z.x, z.y, z.w, z.h); ctx.clip();
      const shine = ((t * 60) % (z.h + 200)) - 100;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(z.x, z.y + shine);
      ctx.lineTo(z.x + z.w, z.y + shine - 40);
      ctx.lineTo(z.x + z.w, z.y + shine - 20);
      ctx.lineTo(z.x, z.y + shine + 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (z.type === 'slope') {
      // Breeze from the desk fan
      ctx.save();
      ctx.beginPath(); ctx.rect(z.x, z.y, z.w, z.h); ctx.clip();
      ctx.fillStyle = 'rgba(200, 230, 255, 0.10)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      const a = Math.atan2(z.ay, z.ax);
      const ux = Math.cos(a), uy = Math.sin(a);
      const reach = Math.hypot(z.w, z.h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const s = (rand(i + z.x) - 0.5) * reach;
        const d = ((t * 140 + rand(i + 0.5) * reach) % reach) - reach / 2;
        const px = cx + ux * d - uy * s, py = cy + uy * d + ux * s;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - ux * 26, py - uy * 26);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function draw(ctx, v) {
    const { hole, t } = v;
    const seed = v.holeIndex * 17 + 3;
    dropShadow(ctx, false);
    ctx.lineJoin = 'round';

    // Wooden desk
    ctx.fillStyle = '#b07a45';
    ctx.fillRect(0, 0, W, H);
    for (let y = 4; y < H; y += 9) {
      ctx.strokeStyle = `rgba(110, 66, 30, ${0.12 + ((y * 37) % 11) / 60})`;
      ctx.lineWidth = 1 + ((y * 13) % 3);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const wy = y + Math.sin(x * 0.006 + y * 0.3) * 4 + Math.sin(x * 0.02 + y) * 1.2;
        x ? ctx.lineTo(x, wy) : ctx.moveTo(x, wy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(70, 40, 15, 0.5)';
    ctx.fillRect(0, 199, W, 2);
    ctx.fillRect(0, 409, W, 2);

    // Clutter (the mat covers anything that lands under it)
    ctx.strokeStyle = 'rgba(90, 45, 15, 0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(60 + rand(seed) * 780, 40 + rand(seed + 1) * 520, 40, 0.3, Math.PI * 1.75); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      paperclip(ctx, 30 + rand(seed + i * 3) * 840, 25 + rand(seed + i * 3 + 1) * 550, rand(seed + i) * 3);
    }

    // Cutting mat fairway
    ctx.save();
    dropShadow(ctx, true);
    tracePoly(ctx, hole.shape);
    ctx.fillStyle = '#2f7d5b';
    ctx.fill();
    dropShadow(ctx, false);
    ctx.clip();
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 25) {
      ctx.strokeStyle = x % 125 === 0 ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 25) {
      ctx.strokeStyle = y % 125 === 0 ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    for (let d = -H; d < W; d += 125) {
      ctx.beginPath(); ctx.moveTo(d, H); ctx.lineTo(d + H, 0); ctx.stroke();
    }
    (hole.zones || []).forEach(z => drawZone(ctx, z, t));
    ctx.restore();

    if (v.showLabel) stickyNote(ctx, hole.label[0], hole.label[1], hole, v.holeIndex);

    // Masking-tape tee
    ctx.save();
    ctx.translate(hole.start[0], hole.start[1] + 22);   // beside the ball, not under it
    ctx.rotate(0.04);
    ctx.fillStyle = 'rgba(236, 222, 180, 0.9)';
    ctx.fillRect(-26, -9, 52, 18);
    ctx.fillStyle = '#7a3b1d';
    ctx.font = `700 15px ${HAND}`;
    ctx.fillText('TEE', -12, 5);
    ctx.restore();

    // Walls: short edges are erasers, the rest alternate rulers and pencils;
    // extra walls are pencils.
    const edgeCount = hole.shape.length;
    wallSegments(hole).forEach(([a, b], i) => {
      along(ctx, a, b, len => {
        dropShadow(ctx, true);
        if (i >= edgeCount) drawPencil(ctx, len);
        else if (len < 130) drawEraser(ctx, len);
        else if (i % 2) drawRuler(ctx, len);
        else drawPencil(ctx, len);
      });
    });
    dropShadow(ctx, false);

    // A desk fan sits upwind of each breeze zone
    for (const z of hole.zones || []) {
      if (z.type !== 'slope') continue;
      const a = Math.atan2(z.ay, z.ax);
      const ext = Math.abs(Math.cos(a)) * z.w / 2 + Math.abs(Math.sin(a)) * z.h / 2;
      deskFan(ctx, z.x + z.w / 2 - Math.cos(a) * (ext + 45), z.y + z.h / 2 - Math.sin(a) * (ext + 45), a, t);
    }

    // Coffee-mug cup with a toothpick flag
    const [cx, cy] = hole.cup;
    dropShadow(ctx, true);
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath(); ctx.roundRect(cx + 14, cy - 6, 16, 12, 6); ctx.fill();
    circle(ctx, cx, cy, 19); ctx.fill();
    dropShadow(ctx, false);
    ctx.fillStyle = '#2f7d5b';
    ctx.beginPath(); ctx.roundRect(cx + 19, cy - 2.5, 7, 5, 2.5); ctx.fill();
    ctx.fillStyle = '#3b200e';
    circle(ctx, cx, cy, 13); ctx.fill();
    ctx.fillStyle = 'rgba(255, 220, 180, 0.25)';
    ctx.beginPath(); ctx.ellipse(cx - 4, cy - 5, 5, 2.5, -0.5, 0, Math.PI * 2); ctx.fill();
    if (v.flagAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = v.flagAlpha;
      ctx.translate(cx, cy);
      if (v.rotated) ctx.rotate(Math.PI / 2);   // keep the flag upright on screen
      ctx.strokeStyle = '#d8b77f';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-2, -52); ctx.stroke();
      dropShadow(ctx, true);
      ctx.fillStyle = '#fbcfe8';
      ctx.fillRect(-1, -54, 30, 22);
      dropShadow(ctx, false);
      ctx.fillStyle = '#2a2118';
      ctx.font = `700 18px ${HAND}`;
      ctx.fillText(String(v.holeIndex + 1), 9, -37);
      ctx.restore();
    }

    // Rolls of tape
    for (const s of v.movers) {
      dropShadow(ctx, true);
      ctx.fillStyle = '#e8dcc0';
      circle(ctx, s.x, s.y, s.m.r); ctx.fill();
      dropShadow(ctx, false);
      ctx.strokeStyle = 'rgba(150, 130, 90, 0.5)';
      ctx.lineWidth = 1;
      for (let r = s.m.r - 3; r > s.m.r * 0.55; r -= 2.5) { circle(ctx, s.x, s.y, r); ctx.stroke(); }
      ctx.fillStyle = '#c99b5e';
      circle(ctx, s.x, s.y, s.m.r * 0.5); ctx.fill();
      ctx.fillStyle = '#2f7d5b';
      circle(ctx, s.x, s.y, s.m.r * 0.38); ctx.fill();
    }

    // Spinning pens on thumbtacks
    for (const s of v.spinners) {
      along(ctx, [s.x1, s.y1], [s.x2, s.y2], len => {
        dropShadow(ctx, true);
        ctx.fillStyle = '#2b59c3';
        ctx.beginPath(); ctx.roundRect(0, -6, len - 18, 12, [6, 0, 0, 6]); ctx.fill();
        dropShadow(ctx, false);
        ctx.fillStyle = '#e8edf5';
        ctx.beginPath();
        ctx.moveTo(len - 18, -5); ctx.lineTo(len - 2, -1.2); ctx.lineTo(len - 2, 1.2); ctx.lineTo(len - 18, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1b3f95';
        ctx.fillRect(6, -8, 26, 3);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(4, -4, len - 26, 2);
      });
      dropShadow(ctx, true);
      ctx.fillStyle = '#e23b3b';
      circle(ctx, s.cx, s.cy, 8); ctx.fill();
      dropShadow(ctx, false);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      circle(ctx, s.cx - 2.5, s.cy - 2.5, 2.5); ctx.fill();
    }

    // Crumpled paper ball
    const b = v.ball;
    if (b.visible) {
      dropShadow(ctx, true);
      blob(ctx, b.x, b.y, b.r + 1.5, b.r + 1.5, 3.3, 0.12);
      ctx.fillStyle = '#f6f4ee';
      ctx.fill();
      dropShadow(ctx, false);
      ctx.strokeStyle = 'rgba(50, 35, 20, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const k = b.r / 7;
      ctx.strokeStyle = 'rgba(120, 120, 120, 0.55)';
      ctx.lineWidth = 0.9;
      for (const [p, q, r, s] of [[-5, -2, 1, -5], [-1, 1, 5, 3], [-4, 4, 0, 1], [2, -4, 4, 0]]) {
        ctx.beginPath(); ctx.moveTo(b.x + p * k, b.y + q * k); ctx.lineTo(b.x + r * k, b.y + s * k); ctx.stroke();
      }
    }

    // Aim: a sketchy pencil arrow
    if (v.aim) {
      const { ux, uy, power } = v.aim;
      const reach = 30 + power * 140;
      ctx.strokeStyle = '#1f1f1f';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.moveTo(b.x + ux * 14, b.y + uy * 14);
      ctx.lineTo(b.x + ux * reach, b.y + uy * reach);
      ctx.stroke();
      ctx.setLineDash([]);
      const tx = b.x + ux * reach, ty = b.y + uy * reach;
      ctx.beginPath();
      ctx.moveTo(tx - ux * 12 - uy * 8, ty - uy * 12 + ux * 8);
      ctx.lineTo(tx + ux * 2, ty + uy * 2);
      ctx.lineTo(tx - ux * 12 + uy * 8, ty - uy * 12 - ux * 8);
      ctx.stroke();
    }
  }

  THEMES.desk = {
    draw,
    confetti: ['#fde68a', '#fbcfe8', '#bae6fd', '#ffffff', '#e23b3b'],
    splash: ['#16205a', '#3346a8', '#6b7fd8'],
    waterToast: 'Inked! +1 stroke',
    tips: {
      sand: 'Eraser shavings: slow the ball right down',
      water: 'Ink blot: +1 stroke and the ball goes back',
      ice: 'Plastic sleeve: super slippery',
      slope: 'Desk fan: blows the ball the way the streaks go',
      spinner: 'Spinning pens: time your shot',
      tape: 'The tape roll slides back and forth and bumps your ball',
    },
  };
})();
