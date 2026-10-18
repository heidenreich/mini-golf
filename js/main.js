'use strict';

const STEP = 1 / 120;            // fixed physics timestep
const MAX_DRAG = 160;            // drag distance (world px) for full power
const MAX_STROKES = 8;           // pick up after this many

// ---- Saved progress -------------------------------------------------------

const SAVE_KEY = 'minigolf.v1';

function loadSave() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { /* private mode etc. */ }
  return { unlocked: data.unlocked || [], best: data.best || {}, sound: data.sound !== false };
}

const save = loadSave();
if (new URLSearchParams(location.search).has('unlock')) save.unlocked = COURSES.map(c => c.id);

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

const isUnlocked = course => !course.bonus || save.unlocked.includes(course.id);
const coursePar = course => course.holes.reduce((a, h) => a + h.par, 0);

// ---- State ----------------------------------------------------------------

const game = {
  courseIndex: 0,
  holeIndex: 0,
  scores: [],
  strokes: 0,
  ball: { x: 0, y: 0, vx: 0, vy: 0 },
  lastRest: { x: 0, y: 0 },
  state: 'menu',                 // menu | aim | rolling | sinking | done
  paused: false,
  t: 0,
  stillTime: 0,
  sinkT: 0,
  sinkFrom: null,
  drag: null,
};

const course = () => COURSES[game.courseIndex];
const hole = () => course().holes[game.holeIndex];
const theme = () => THEMES[course().theme];
const total = () => game.scores.reduce((a, s) => a + s, 0);

function setTheme(name) {
  document.body.className = `theme-${name}`;
}

function startCourse(index) {
  game.courseIndex = index;
  game.scores = [];
  setTheme(course().theme);
  startHole(0);
}

function startHole(index) {
  game.holeIndex = index;
  game.strokes = 0;
  const [x, y] = hole().start;
  Object.assign(game.ball, { x, y, vx: 0, vy: 0 });
  game.lastRest = { x, y };
  game.state = 'aim';
  game.paused = false;
  game.stillTime = 0;
  game.drag = null;
  hideOverlay();
  updateHud();
  toast(`Hole ${index + 1} · ${hole().name} · Par ${hole().par}`);
}

// ---- Physics step ---------------------------------------------------------

function step(dt) {
  if (game.paused || game.state === 'menu') return;
  game.t += dt;
  const b = game.ball;
  const h = hole();

  if (game.state === 'sinking') {
    game.sinkT = Math.min(1, game.sinkT + dt / 0.3);
    b.x = game.sinkFrom.x + (h.cup[0] - game.sinkFrom.x) * game.sinkT;
    b.y = game.sinkFrom.y + (h.cup[1] - game.sinkFrom.y) * game.sinkT;
    if (game.sinkT >= 1) finishHole(false);
    return;
  }
  if (game.state === 'done') return;

  // Surface forces
  const zone = zoneAt(h, b.x, b.y);
  const surface = SURFACES[zone && SURFACES[zone.type] ? zone.type : 'grass'];
  if (zone && zone.type === 'slope') {
    b.vx += zone.ax * dt;
    b.vy += zone.ay * dt;
  }
  let speed = Math.hypot(b.vx, b.vy);
  if (speed > 0) {
    const ns = Math.max(0, speed * Math.exp(-surface.k * dt) - surface.decel * dt);
    b.vx *= ns / speed;
    b.vy *= ns / speed;
    speed = ns;
  }

  // Move in sub-steps of at most half a ball radius so fast shots can't
  // tunnel through walls.
  const segs = boundarySegments(h).concat(spinnerSegments(h, game.t));
  const movers = moverStates(h, game.t);
  const n = Math.max(1, Math.ceil((speed * dt) / (BALL_R * 0.5)));
  let impact = 0;
  for (let i = 0; i < n; i++) {
    b.x += (b.vx * dt) / n;
    b.y += (b.vy * dt) / n;
    impact = Math.max(impact, collideMovers(b, movers), collideSegments(b, segs), collideSegments(b, segs));
    if (game.state === 'rolling' && checkCup(dt / n)) return;
  }
  if (impact > 60) sfx.wall(impact);
  speed = Math.hypot(b.vx, b.vy);

  if (game.state === 'aim') {
    // At rest. Only a knock from a moving obstacle gets it rolling again.
    if (speed > 30) {
      game.state = 'rolling';
      game.drag = null;
    } else {
      b.vx = b.vy = 0;
    }
    return;
  }

  const after = zoneAt(h, b.x, b.y);
  if (after && after.type === 'water') {
    sfx.splash();
    game.strokes++;
    Object.assign(b, { x: game.lastRest.x, y: game.lastRest.y, vx: 0, vy: 0 });
    game.state = 'aim';
    updateHud();
    toast('Water hazard · +1 stroke');
    if (game.strokes >= MAX_STROKES) finishHole(true);
    return;
  }

  if (speed < 10) {
    game.stillTime += dt;
    if (game.stillTime > 0.25) {
      b.vx = b.vy = 0;
      game.state = 'aim';
      game.lastRest = { x: b.x, y: b.y };
      if (game.strokes >= MAX_STROKES) finishHole(true);
    }
  } else {
    game.stillTime = 0;
  }
}

function checkCup(dt) {
  const b = game.ball;
  const [cx, cy] = hole().cup;
  const dx = cx - b.x, dy = cy - b.y;
  const d = Math.hypot(dx, dy);
  if (d >= CUP_R) return false;
  if (Math.hypot(b.vx, b.vy) < CUP_CAPTURE_SPEED) {
    game.state = 'sinking';
    game.sinkT = 0;
    game.sinkFrom = { x: b.x, y: b.y };
    b.vx = b.vy = 0;
    sfx.cup();
    burst(cx, cy);
    return true;
  }
  // Too fast: the lip curls the ball a little but it rolls on.
  if (d > 0.001) {
    b.vx += (dx / d) * 1800 * dt;
    b.vy += (dy / d) * 1800 * dt;
  }
  return false;
}

function shoot(dirX, dirY, power) {
  if (game.state !== 'aim' || game.paused) return;
  const len = Math.hypot(dirX, dirY) || 1;
  const p = Math.max(0, Math.min(1, power));
  game.ball.vx = (dirX / len) * p * MAX_SPEED;
  game.ball.vy = (dirY / len) * p * MAX_SPEED;
  game.lastRest = { x: game.ball.x, y: game.ball.y };
  game.strokes++;
  game.state = 'rolling';
  game.stillTime = 0;
  sfx.hit(p);
  updateHud();
}

// ---- Celebration particles ------------------------------------------------

const particles = [];

function burst(x, y) {
  const colors = theme().confetti;
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12,
      life: 1, color: colors[i % colors.length],
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.5 * dt;
    p.vy *= 1 - 2.5 * dt;
    p.rot += p.spin * dt;
    p.life -= dt / 1.2;
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
}

// ---- Scoring & screens ----------------------------------------------------

function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in one!';
  const diff = strokes - par;
  const names = { '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Double bogey' };
  return names[diff] || (diff > 0 ? `+${diff}` : `${diff}`);
}

function vsPar(score, par) {
  const diff = score - par;
  return diff === 0 ? 'Even par' : diff > 0 ? `${diff} over par` : `${-diff} under par`;
}

function finishHole(pickedUp) {
  game.state = 'done';
  game.drag = null;
  game.scores[game.holeIndex] = game.strokes;
  updateHud();
  const last = game.holeIndex === course().holes.length - 1;
  const title = pickedUp ? 'Picked up' : scoreName(game.strokes, hole().par);
  const word = game.strokes === 1 ? 'stroke' : 'strokes';
  showOverlay(
    `<h2>${title}</h2>` +
    `<p>${game.strokes} ${word} on a par ${hole().par}</p>` +
    `<div class="actions"><button data-action="${last ? 'finish' : 'next'}">${last ? 'See scorecard' : 'Next hole'}</button></div>`
  );
}

function finishCourse() {
  const c = course();
  const score = total();
  const prevBest = save.best[c.id];
  const newBest = prevBest === undefined || score < prevBest;
  if (newBest) save.best[c.id] = score;
  const unlocks = COURSES.filter(o => o.bonus && !save.unlocked.includes(o.id) && o.id !== c.id);
  unlocks.forEach(o => save.unlocked.push(o.id));
  writeSave();

  showOverlay(
    `<h2>Round complete</h2>` +
    `<p>${c.name} · ${vsPar(score, coursePar(c))}${newBest ? ' · New best!' : ''}</p>` +
    scorecardTable(game.scores) +
    unlocks.map(o => `<p class="unlock">Unlocked: <b>${o.name}</b></p>`).join('') +
    `<div class="actions"><button data-action="replay">Play again</button>` +
    `<button data-action="courses" class="secondary">Courses</button></div>`
  );
}

function scorecardTable(scores) {
  const c = course();
  const rows = c.holes.map((h, i) =>
    `<tr><td>${i + 1}</td><td>${h.name}</td><td>${h.par}</td><td>${scores[i] ?? '–'}</td></tr>`
  ).join('');
  const played = scores.filter(s => s !== undefined);
  return `<table><thead><tr><th>#</th><th>Hole</th><th>Par</th><th>Score</th></tr></thead>` +
    `<tbody>${rows}</tbody>` +
    `<tfoot><tr><td></td><td>Total</td><td>${coursePar(c)}</td><td>${played.length ? total() : '–'}</td></tr></tfoot></table>`;
}

function showTitle() {
  game.state = 'menu';
  game.paused = false;
  game.courseIndex = 0;
  game.holeIndex = 0;
  game.scores = [];
  game.strokes = 0;
  game.ball.x = hole().start[0];
  game.ball.y = hole().start[1];
  setTheme(course().theme);
  updateHud();
  const cards = COURSES.map((c, i) => {
    const best = save.best[c.id];
    const meta = `${c.holes.length} holes · Par ${coursePar(c)}${best !== undefined ? ` · Best ${best}` : ''}`;
    if (!isUnlocked(c)) {
      return `<button class="course locked" disabled><span class="cname">🔒 ${c.name}</span>` +
        `<span class="cmeta">Bonus course: finish ${COURSES[0].name} to unlock</span></button>`;
    }
    return `<button class="course" data-action="course" data-index="${i}"><span class="cname">${c.name}${c.bonus ? ' <em>bonus</em>' : ''}</span>` +
      `<span class="cmeta">${meta}</span><span class="cblurb">${c.blurb}</span></button>`;
  }).join('');
  showOverlay(
    `<h1 class="logo">Mini Golf</h1>` +
    `<p>Pick a course</p>` +
    `<div class="courses">${cards}</div>` +
    `<label class="toggle"><input type="checkbox" data-action="sound"${save.sound ? ' checked' : ''}> Sound</label>`
  );
}

function showMenu() {
  if (game.state === 'menu' || game.state === 'done') return;
  game.paused = true;
  game.drag = null;
  showOverlay(
    `<h2>Paused</h2>` +
    `<p>${course().name} · Hole ${game.holeIndex + 1}</p>` +
    scorecardTable(game.scores) +
    `<div class="actions"><button data-action="resume">Resume</button>` +
    `<button data-action="restart" class="secondary">Restart hole</button>` +
    `<button data-action="courses" class="secondary">Courses</button></div>`
  );
}

const $ = id => document.getElementById(id);

function showOverlay(html) {
  $('card').innerHTML = html;
  $('overlay').classList.add('show');
  const first = $('card').querySelector('button:not([disabled])');
  if (first) first.focus();
}

function hideOverlay() {
  $('overlay').classList.remove('show');
}

$('card').addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  ensureAudio();
  switch (el.dataset.action) {
    case 'course': startCourse(Number(el.dataset.index)); break;
    case 'next': startHole(game.holeIndex + 1); break;
    case 'finish': finishCourse(); break;
    case 'replay': startCourse(game.courseIndex); break;
    case 'courses': showTitle(); break;
    case 'resume': game.paused = false; hideOverlay(); break;
    case 'restart': startHole(game.holeIndex); break;
  }
});

$('card').addEventListener('change', e => {
  if (e.target.dataset.action === 'sound') {
    save.sound = e.target.checked;
    writeSave();
  }
});

$('menu-btn').addEventListener('click', showMenu);

function updateHud() {
  $('hud-hole').textContent = game.holeIndex + 1;
  $('hud-holes').textContent = course().holes.length;
  $('hud-name').textContent = hole().name;
  $('hud-par').textContent = hole().par;
  $('hud-strokes').textContent = game.strokes;
  $('hud-total').textContent = total() + (game.state === 'done' ? 0 : game.strokes);
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---- Sound ----------------------------------------------------------------

let audio = null;
let lastWallSound = 0;

function ensureAudio() {
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  }
  if (audio.state === 'suspended') audio.resume();
}

function tone(freq, dur, type, vol, delay = 0) {
  if (!audio || !save.sound) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur);
}

const sfx = {
  hit: p => tone(160 + p * 120, 0.09, 'triangle', 0.3),
  wall: impact => {
    if (game.t - lastWallSound < 0.05) return;
    lastWallSound = game.t;
    tone(300, 0.05, 'square', 0.06 * Math.min(1, impact / 500));
  },
  cup: () => { tone(660, 0.12, 'sine', 0.2); tone(990, 0.25, 'sine', 0.2, 0.1); },
  splash: () => { tone(140, 0.35, 'sawtooth', 0.08); tone(90, 0.4, 'sine', 0.15); },
};

// ---- Input ----------------------------------------------------------------

const canvas = $('game');
const ctx = canvas.getContext('2d');

function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

function dragShot() {
  const d = game.drag;
  const dx = d.sx - d.x, dy = d.sy - d.y;
  const len = Math.hypot(dx, dy);
  return { dx, dy, len, power: Math.min(len, MAX_DRAG) / MAX_DRAG };
}

canvas.addEventListener('pointerdown', e => {
  ensureAudio();
  if (game.state !== 'aim' || game.paused) return;
  canvas.setPointerCapture(e.pointerId);
  const p = toWorld(e);
  game.drag = { sx: p.x, sy: p.y, x: p.x, y: p.y };
});

canvas.addEventListener('pointermove', e => {
  if (!game.drag) return;
  const p = toWorld(e);
  game.drag.x = p.x;
  game.drag.y = p.y;
});

canvas.addEventListener('pointerup', () => {
  if (!game.drag) return;
  const { dx, dy, power } = dragShot();
  game.drag = null;
  if (power > 0.04) shoot(dx, dy, power);
});

canvas.addEventListener('pointercancel', () => { game.drag = null; });

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (game.drag) game.drag = null;
    else if (game.paused) { game.paused = false; hideOverlay(); }
    else showMenu();
  }
  if ((e.key === 'r' || e.key === 'R') && (game.state === 'aim' || game.state === 'rolling') && !game.paused) {
    startHole(game.holeIndex);
  }
});

// ---- Rendering ------------------------------------------------------------

function resize() {
  const chrome = $('hud').offsetHeight + $('hint').offsetHeight + 44;
  const scale = Math.max(0.2, Math.min((innerWidth - 32) / W, (innerHeight - chrome) / H));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener('resize', resize);

function render() {
  const h = hole();
  const b = game.ball;
  const [cx, cy] = h.cup;
  let aim = null;
  if (game.drag && game.state === 'aim') {
    const { dx, dy, len, power } = dragShot();
    if (len > 0.5) aim = { ux: dx / len, uy: dy / len, power };
  }
  theme().draw(ctx, {
    hole: h,
    holeIndex: game.holeIndex,
    t: game.t,
    ball: {
      x: b.x, y: b.y,
      r: game.state === 'sinking' ? BALL_R * (1 - 0.6 * game.sinkT) : BALL_R,
      visible: game.state !== 'done' && game.state !== 'menu',
    },
    spinners: spinnerSegments(h, game.t),
    movers: moverStates(h, game.t),
    aim,
    flagAlpha: Math.max(0, Math.min(1, (Math.hypot(b.x - cx, b.y - cy) - 40) / 60)),
  });

  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-4, -2.5, 8, 5);
    ctx.restore();
  }

  if (aim) {
    const hue = 120 - aim.power * 120;   // green -> red
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath(); ctx.roundRect(W - 154, H - 34, 138, 16, 8); ctx.fill();
    ctx.fillStyle = `hsl(${hue}, 85%, 55%)`;
    ctx.beginPath(); ctx.roundRect(W - 150, H - 30, Math.max(8, 130 * aim.power), 8, 4); ctx.fill();
  }
}

// ---- Main loop ------------------------------------------------------------

let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  if (game.state === 'menu') game.t += dt;   // keep the title backdrop alive
  updateParticles(dt);
  render();
  requestAnimationFrame(frame);
}

resize();
showTitle();
requestAnimationFrame(frame);

// Handy for debugging from the console and for automated tests.
window.miniGolf = { game, COURSES, shoot, step, startCourse, startHole, save };
