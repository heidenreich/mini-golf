'use strict';

const STEP = 1 / 120;            // fixed physics timestep
const MAX_DRAG_PX = 140;         // finger/mouse travel (CSS px) for full power
const MAX_STROKES = 8;           // pick up after this many
const MIN_BALL_PX = 5.5;         // never draw the ball smaller than this radius on screen
const HOLED_PAUSE = 0.9;         // seconds of celebration before the hole card
const ACE_PAUSE = 1.9;           // a hole in one gets a longer moment
const TRANSITION = 0.9;          // seconds for one hole to hand over to the next
// The title screen's demo: two shots on hole 1, replayed exactly (the physics
// is deterministic): a bank off the angled corner, then a putt that drops.
const DEMO_SHOTS = [[4.4593, 0.98], [-0.8997, 0.22]];
const SPLASH_TIME = 0.6;         // seconds the splash plays before the ball returns

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---- Saved progress -------------------------------------------------------

const SAVE_KEY = 'minigolf.v1';

function loadSave() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { /* private mode etc. */ }
  if (!data || typeof data !== 'object') data = {};
  const strings = v => (Array.isArray(v) ? v.filter(s => typeof s === 'string') : []);
  const best = {};
  if (data.best && typeof data.best === 'object') {
    for (const [k, v] of Object.entries(data.best)) if (Number.isFinite(v)) best[k] = v;
  }
  return {
    unlocked: strings(data.unlocked),
    best,
    tips: strings(data.tips),
    sound: data.sound !== false,
  };
}

const save = loadSave();
if (new URLSearchParams(location.search).has('unlock')) save.unlocked = COURSES.map(c => c.id);

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

const isUnlocked = course => !course.bonus || save.unlocked.includes(course.id);
const coursePar = course => course.holes.reduce((a, h) => a + h.par, 0);
// Best scores are kept per course layout, so adding holes doesn't compare a
// 9-hole round with an old 4-hole best.
const bestKey = course => `${course.id}@${course.holes.length}`;

// ---- State ----------------------------------------------------------------

const game = {
  courseIndex: 0,
  holeIndex: 0,
  scores: [],
  strokes: 0,
  ball: { x: 0, y: 0, vx: 0, vy: 0 },
  lastRest: { x: 0, y: 0 },
  state: 'menu',                 // menu | aim | rolling | sinking | holed | splashing | done
  paused: false,
  t: 0,
  stillTime: 0,
  timer: 0,                      // time spent in sinking / holed / splashing
  sinkFrom: null,
  drag: null,
  kbAim: null,                   // keyboard aiming: { angle, power }
  spin: 0,                       // how far the ball has rolled (radians), for its dimples
  rollDir: 0,                    // direction it last rolled
  trail: [],                     // recent positions, for the fast-shot trail
  squash: null,                  // { t, ang, amt } of the last hard hit
  bubbles: {},                   // mover index -> time it was bumped
  lastFx: 0,
  demo: null,                    // title-screen demo: { shot, wait }
  trans: null,                   // hole-to-hole transition: { p, kind }
  ace: null,                     // { t } when a hole in one drops
};

const course = () => COURSES[game.courseIndex];
const hole = () => course().holes[game.holeIndex];
const theme = () => THEMES[course().theme];
const total = () => game.scores.reduce((a, s) => a + (s || 0), 0);

function setTheme(name) {
  document.body.classList.remove('theme-tiny', 'theme-desk');
  document.body.classList.add(`theme-${name}`);
  resize();
}

function startCourse(index) {
  game.courseIndex = index;
  game.holeIndex = 0;
  game.scores = [];
  game.demo = null;
  setTheme(course().theme);
  startHole(0);
}

function startHole(index, opts = {}) {
  // Moving on to the next hole: keep a picture of this one to animate away.
  game.trans = null;
  if (opts.transition && !reducedMotion.matches) {
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext('2d').drawImage(canvas, 0, 0);
    game.trans = { p: 0, kind: theme().transition || 'rise' };
  }
  game.holeIndex = index;
  game.strokes = 0;
  const [x, y] = hole().start;
  Object.assign(game.ball, { x, y, vx: 0, vy: 0 });
  game.lastRest = { x, y };
  game.state = 'aim';
  game.paused = false;
  game.stillTime = 0;
  game.drag = null;
  game.kbAim = null;
  game.trail = [];
  game.squash = null;
  game.bubbles = {};
  game.ace = null;
  particles.length = 0;
  document.body.classList.remove('menu');
  hideOverlay();
  updateHud();
  resize();

  // Tips first, so they land before the first shot.
  clearToasts();
  for (const tip of newTips()) toast(tip, 2600);
  if (!view.signShown) toast(`Hole ${index + 1} · ${hole().name} · Par ${hole().par}`, 1600);
}

// First time a player meets each kind of hazard or obstacle, explain it.
function newTips() {
  const h = hole();
  const tips = theme().tips;
  const keys = new Set();
  (h.zones || []).forEach(z => keys.add(z.type));
  if ((h.spinners || []).length) keys.add('spinner');
  (h.movers || []).forEach(m => keys.add(m.kind));
  const out = [];
  for (const key of keys) {
    const id = `${course().theme}:${key}`;
    if (!tips[key] || save.tips.includes(id)) continue;
    save.tips.push(id);
    out.push(tips[key]);
  }
  if (out.length) writeSave();
  return out;
}

// ---- Physics step ---------------------------------------------------------

function step(dt) {
  if (game.paused || game.state === 'menu') return;
  game.t += dt;
  if (game.demo) demoStep(dt);
  const b = game.ball;
  const h = hole();

  if (game.state === 'sinking') {
    game.timer = Math.min(1, game.timer + dt / 0.3);
    b.x = game.sinkFrom.x + (h.cup[0] - game.sinkFrom.x) * game.timer;
    b.y = game.sinkFrom.y + (h.cup[1] - game.sinkFrom.y) * game.timer;
    if (game.timer >= 1) {
      game.state = 'holed';
      game.timer = 0;
    }
    return;
  }
  if (game.state === 'holed') {
    game.timer += dt;
    if (game.demo) return;
    if (game.timer >= (game.ace ? ACE_PAUSE : HOLED_PAUSE)) finishHole(false);
    return;
  }
  if (game.state === 'splashing') {
    game.timer += dt;
    if (game.timer >= SPLASH_TIME) {
      Object.assign(b, { x: game.lastRest.x, y: game.lastRest.y, vx: 0, vy: 0 });
      game.state = 'aim';
      if (game.strokes >= MAX_STROKES) finishHole(true);
    }
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
  let impact = 0, wallHit = null;
  for (let i = 0; i < n; i++) {
    b.x += (b.vx * dt) / n;
    b.y += (b.vy * dt) / n;
    b.hit = null;
    const bump = collideMovers(b, movers);
    if (bump > 60) { sfx.bump(bump); bumped(b.hit, bump, movers); }
    b.hit = null;
    const wall = Math.max(collideSegments(b, segs), collideSegments(b, segs));
    if (wall > impact) { impact = wall; wallHit = b.hit; }
    if (game.state === 'rolling' && checkCup(dt / n)) return;
  }
  if (impact > 60) { sfx.wall(impact); hitWall(wallHit, impact); }
  const nowZone = zoneAt(h, b.x, b.y);
  const nowType = nowZone ? nowZone.type : 'grass';
  if (nowType === 'sand' && game.zoneType !== 'sand' && game.state === 'rolling') {
    sfx.sand();
    if (speed > 100) puff(b.x, b.y, theme().impact.sand, 'grain', 14, 40 + speed * 0.3, Math.atan2(b.vy, b.vx) + Math.PI, 2.2);
  }
  game.zoneType = nowType;
  speed = Math.hypot(b.vx, b.vy);
  // Rolling: dimples turn with distance travelled; keep a short trail
  game.spin += (speed * dt) / BALL_R;
  if (speed > 5) game.rollDir = Math.atan2(b.vy, b.vx);
  game.trail.push({ x: b.x, y: b.y, v: speed });
  if (game.trail.length > 12) game.trail.shift();

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

  // Safety net: if the ball ever ends up outside the course, put it back.
  if (!insidePolygon(h.shape, b.x, b.y)) {
    Object.assign(b, { x: game.lastRest.x, y: game.lastRest.y, vx: 0, vy: 0 });
    game.state = 'aim';
    toast('Out of bounds: back you go', 1800, true);
    return;
  }

  const after = zoneAt(h, b.x, b.y);
  if (after && after.type === 'water') {
    sfx.splash();
    splash(b.x, b.y);
    game.strokes++;
    b.vx = b.vy = 0;
    game.state = 'splashing';
    game.timer = 0;
    updateHud();
    toast(theme().waterToast, 1800, true);
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
    game.timer = 0;
    game.sinkFrom = { x: b.x, y: b.y };
    b.vx = b.vy = 0;
    sfx.cup();
    burst(cx, cy);
    if (game.strokes === 1 && !game.demo) {
      game.ace = { t: game.t };
      burst(cx, cy);
      sfx.fanfare();
    }
    return true;
  }
  // Too fast: the lip curls the ball a little but it rolls on.
  if (d > 0.001) {
    b.vx += (dx / d) * 1800 * dt;
    b.vy += (dy / d) * 1800 * dt;
  }
  return false;
}

// Title demo: aim for a moment (the line and ring grow), take the next shot,
// and start over from the tee a little after the ball drops.
function demoStep(dt) {
  const d = game.demo;
  if (game.state === 'holed') {
    if (game.timer > 1.6) demoReset();
    return;
  }
  if (game.state !== 'aim') return;
  d.wait += dt;
  if (d.wait >= 1.5) {
    const [a, p] = DEMO_SHOTS[d.shot % DEMO_SHOTS.length];
    d.shot++;
    d.wait = 0;
    shoot(Math.cos(a), Math.sin(a), p);
  }
}

function demoReset() {
  const [x, y] = hole().start;
  Object.assign(game.ball, { x, y, vx: 0, vy: 0 });
  game.state = 'aim';
  game.strokes = 0;
  game.trail = [];
  game.demo = { shot: 0, wait: 0 };
}

function demoAim() {
  const d = game.demo;
  if (!d || game.state !== 'aim' || d.wait < 0.5) return null;
  const [a, p] = DEMO_SHOTS[d.shot % DEMO_SHOTS.length];
  return { ux: Math.cos(a), uy: Math.sin(a), power: p * Math.min(1, (d.wait - 0.5) / 0.8) };
}

function shoot(dirX, dirY, power) {
  if (game.state !== 'aim' || game.paused) return;
  const len = Math.hypot(dirX, dirY) || 1;
  const p = Math.max(0, Math.min(1, power));
  const speed = Math.pow(p, POWER_CURVE) * MAX_SPEED;
  game.ball.vx = (dirX / len) * speed;
  game.ball.vy = (dirY / len) * speed;
  game.lastRest = { x: game.ball.x, y: game.ball.y };
  game.strokes++;
  game.state = 'rolling';
  game.stillTime = 0;
  game.kbAim = null;
  sfx.hit(p);
  updateHud();
  if (game.strokes === MAX_STROKES - 2) toast(`2 strokes left: the ball is picked up after ${MAX_STROKES}`, 2400, true);
}

// ---- Particles ------------------------------------------------------------

const particles = [];

function burst(x, y) {
  const colors = theme().confetti;
  for (let i = 0; i < 32; i++) {
    const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 240;
    particles.push({
      kind: 'bit', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12,
      life: 1, decay: 1 / 1.6, size: 1, color: colors[i % colors.length],
    });
  }
}

// A small burst of debris from a point: leaves off hedges, sand grains, desk bits.
function puff(x, y, colors, kind, count, speed, dir, spread) {
  for (let i = 0; i < count; i++) {
    const a = dir + (Math.random() - 0.5) * spread, s = speed * (0.4 + Math.random() * 0.8);
    particles.push({
      kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      rot: Math.random() * 6, spin: (Math.random() - 0.5) * 14,
      life: 1, decay: kind === 'grain' ? 1 / 0.6 : 1 / 0.7, size: 1, color: colors[i % colors.length],
    });
  }
}

function hitWall(hit, impact) {
  if (!hit || impact < 120 || game.t - game.lastFx < 0.06) return;
  game.lastFx = game.t;
  const amt = Math.min(1, impact / 700);
  game.squash = { t: game.t, ang: Math.atan2(hit.ny, hit.nx), amt };
  puff(hit.x, hit.y, theme().impact.wall, 'leaf', Math.round(3 + amt * 7), 60 + impact * 0.18, Math.atan2(hit.ny, hit.nx), 2.2);
  particles.push({ kind: 'flash', x: hit.x, y: hit.y, vx: 0, vy: 0, rot: 0, spin: 0, life: 1, decay: 1 / 0.22, size: 0, color: '#ffffff' });
}

function bumped(hit, impact, movers) {
  if (!hit) return;
  game.squash = { t: game.t, ang: Math.atan2(hit.ny, hit.nx), amt: Math.min(1, impact / 600) };
  const m = movers[hit.mover];
  if (m && m.m.kind === 'sheep') game.bubbles[hit.mover] = game.t;
}

function splash(x, y) {
  const colors = theme().splash;
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120;
    particles.push({
      kind: 'drop', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      rot: 0, spin: 0, life: 1, decay: 1 / 0.7, size: 2 + Math.random() * 2.5, color: colors[i % colors.length],
    });
  }
  for (let i = 0; i < 2; i++) {
    particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, rot: 0, spin: 0, life: 1 + i * 0.3, decay: 1 / 0.8, size: 0, color: colors[0] });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.5 * dt;
    p.vy *= 1 - 2.5 * dt;
    p.rot += p.spin * dt;
    p.life -= dt * p.decay;
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
}

function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, Math.min(1, p.life));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = ctx.strokeStyle = p.color;
    if (p.kind === 'bit') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-4, -2.5, 8, 5);
    } else if (p.kind === 'drop') {
      circle(ctx, p.x, p.y, p.size); ctx.fill();
    } else if (p.kind === 'leaf') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'grain') {
      circle(ctx, p.x, p.y, 2.3); ctx.fill();
    } else if (p.kind === 'flash') {
      ctx.lineWidth = 2;
      circle(ctx, p.x, p.y, 3 + (1 - a) * 9); ctx.stroke();
    } else {
      ctx.lineWidth = 2.5;
      circle(ctx, p.x, p.y, 8 + (1 - a) * 30); ctx.stroke();
    }
    ctx.restore();
  }
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
  return diff === 0 ? 'even par' : diff > 0 ? `${diff} over par` : `${-diff} under par`;
}

const cap = s => s[0].toUpperCase() + s.slice(1);

function finishHole(pickedUp) {
  if (game.demo) { demoReset(); return; }
  game.state = 'done';
  game.drag = null;
  game.kbAim = null;
  clearToasts();
  game.scores[game.holeIndex] = game.strokes;
  updateHud();
  const c = course();
  const last = game.holeIndex === c.holes.length - 1;
  const title = pickedUp ? 'Picked up' : scoreName(game.strokes, hole().par);
  if (pickedUp) sfx.pickup();
  const word = game.strokes === 1 ? 'stroke' : 'strokes';
  const playedPar = c.holes.slice(0, game.holeIndex + 1).reduce((a, h) => a + h.par, 0);
  const holesWord = game.holeIndex === 0 ? '1 hole' : `${game.holeIndex + 1} holes`;
  showOverlay(
    `<h2>${title}</h2>` +
    `<p>${game.strokes} ${word} on a par ${hole().par}</p>` +
    `<p class="round">Round: <b>${cap(vsPar(total(), playedPar))}</b> after ${holesWord}</p>` +
    `<div class="actions"><button data-action="${last ? 'finish' : 'next'}">${last ? 'See scorecard' : 'Next hole'}</button></div>`
  );
}

function finishCourse() {
  clearToasts();
  const c = course();
  const score = total();
  const prevBest = save.best[bestKey(c)];
  const newBest = prevBest === undefined || score < prevBest;
  if (newBest) { save.best[bestKey(c)] = score; sfx.fanfare(); }
  const unlocks = COURSES.filter(o => o.bonus && !save.unlocked.includes(o.id) && o.id !== c.id);
  unlocks.forEach(o => save.unlocked.push(o.id));
  writeSave();

  showOverlay(
    `<h2>Round complete</h2>` +
    `<p>${c.name} · ${cap(vsPar(score, coursePar(c)))}${newBest ? ' · New best!' : ''}</p>` +
    scorecardTable(game.scores) +
    unlocks.map(o => `<p class="unlock">Unlocked: <b>${o.name}</b></p>`).join('') +
    `<div class="actions"><button data-action="replay">Play again</button>` +
    `<button data-action="courses" class="secondary">Courses</button></div>`
  );
}

// Golf-style marks: circle under par, square over par.
function scoreCell(score, par) {
  if (score === undefined) return '–';
  const cls = score < par ? 'under' : score > par ? 'over' : 'even';
  return `<span class="mark ${cls}">${score}</span>`;
}

function scorecardTable(scores) {
  const c = course();
  const rows = c.holes.map((h, i) =>
    `<tr><td>${i + 1}</td><td>${h.name}</td><td>${h.par}</td><td>${scoreCell(scores[i], h.par)}</td></tr>`
  ).join('');
  const played = scores.filter(s => s !== undefined);
  return `<table><thead><tr><th>#</th><th>Hole</th><th>Par</th><th>Score</th></tr></thead>` +
    `<tbody>${rows}</tbody>` +
    `<tfoot><tr><td></td><td>Total</td><td>${coursePar(c)}</td><td>${played.length ? total() : '–'}</td></tr></tfoot></table>`;
}

function showTitle() {
  game.paused = false;
  game.courseIndex = 0;
  game.holeIndex = 0;
  game.scores = [];
  game.trans = null;
  game.ace = null;
  particles.length = 0;
  demoReset();   // the course plays itself behind the menu
  clearToasts();
  document.body.classList.add('menu');
  setTheme(course().theme);
  updateHud();
  const cards = COURSES.map((c, i) => {
    const best = save.best[bestKey(c)];
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
    soundToggle()
  );
}

function showMenu() {
  if (game.demo || game.state === 'menu' || game.state === 'done') return;
  game.paused = true;
  game.drag = null;
  showOverlay(
    `<h2>Paused</h2>` +
    `<p>${course().name} · Hole ${game.holeIndex + 1}</p>` +
    scorecardTable(game.scores) +
    `<div class="actions"><button data-action="resume">Resume</button>` +
    `<button data-action="restart" class="secondary">Restart hole</button>` +
    `<button data-action="leave" class="secondary">Courses</button></div>` +
    soundToggle()
  );
}

function confirmLeave() {
  showOverlay(
    `<h2>Leave this round?</h2>` +
    `<p>Your scores for this round won't be saved.</p>` +
    `<div class="actions"><button data-action="menu">Keep playing</button>` +
    `<button data-action="courses" class="secondary">Leave round</button></div>`
  );
}

function soundToggle() {
  return `<label class="toggle"><input type="checkbox" data-action="sound"${save.sound ? ' checked' : ''}> Sound</label>`;
}

function canRestart() {
  return !game.paused && !game.demo && !game.trans && (game.state === 'aim' || game.state === 'rolling');
}

const $ = id => document.getElementById(id);

function showOverlay(html) {
  $('card').innerHTML = html;
  $('overlay').classList.add('show');
  $('wrap').inert = true;   // keep focus and screen readers in the dialog
  document.body.classList.add('dialog');
  const first = $('card').querySelector('button:not([disabled])');
  if (first) first.focus({ preventScroll: true });
}

function hideOverlay() {
  $('overlay').classList.remove('show');
  $('wrap').inert = false;
  document.body.classList.remove('dialog');
}

$('card').addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  ensureAudio();
  switch (el.dataset.action) {
    case 'course': startCourse(Number(el.dataset.index)); break;
    case 'next': startHole(game.holeIndex + 1, { transition: true }); break;
    case 'finish': finishCourse(); break;
    case 'replay': startCourse(game.courseIndex); break;
    case 'courses': showTitle(); break;
    case 'leave': confirmLeave(); break;
    case 'menu': game.paused = false; showMenu(); break;
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
$('restart-btn').addEventListener('click', () => { if (canRestart()) startHole(game.holeIndex); });

function updateHud() {
  $('hud-hole').textContent = game.holeIndex + 1;
  $('hud-holes').textContent = course().holes.length;
  $('hud-name').textContent = hole().name;
  $('hud-par').textContent = hole().par;
  $('hud-strokes').textContent = game.strokes;
  $('hud-total').textContent = total() + (game.state === 'done' ? 0 : game.strokes);
  canvas.setAttribute('aria-label', `${course().name}, hole ${game.holeIndex + 1} of ${course().holes.length}: ${hole().name}, par ${hole().par}. ` +
    `Strokes ${game.strokes}. Drag back and release to putt, or use the arrow keys and Space.`);
}

// Toasts queue up and sit at the top of the course.
const toastQueue = [];
let toastTimer = null;

function toast(msg, ms = 1800, now = false) {
  if (game.demo) return;
  if (now) clearToasts();
  toastQueue.push({ msg, ms });
  if (!toastTimer) nextToast();
}

function nextToast() {
  const el = $('toast');
  const item = toastQueue.shift();
  if (!item) {
    toastTimer = null;
    el.classList.remove('show');
    return;
  }
  el.textContent = item.msg;
  positionToast();
  el.classList.add('show');
  toastTimer = setTimeout(nextToast, item.ms);
}

function clearToasts() {
  toastQueue.length = 0;
  clearTimeout(toastTimer);
  toastTimer = null;
  $('toast').classList.remove('show');
}

function positionToast() {
  const r = canvas.getBoundingClientRect();
  const el = $('toast');
  el.style.top = `${r.top + 12}px`;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.maxWidth = `${Math.max(200, r.width - 24)}px`;
}

// ---- Sound ----------------------------------------------------------------

let audio = null;
let lastWallSound = 0;

function ensureAudio() {
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  }
  // iOS can leave the context 'suspended' or 'interrupted' (e.g. after a call).
  if (audio.state !== 'running') audio.resume().catch(() => {});
}

function tone(freq, dur, type, vol, delay = 0) {
  if (!audio || !save.sound || game.demo) return;   // the title demo plays silently
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
  cup: () => { tone(660, 0.12, 'sine', 0.2); tone(990, 0.25, 'sine', 0.2, 0.1); tone(1320, 0.3, 'sine', 0.12, 0.22); },
  splash: () => { tone(140, 0.35, 'sawtooth', 0.08); tone(90, 0.4, 'sine', 0.15); },
  bump: impact => {
    if (game.t - lastWallSound < 0.12) return;
    lastWallSound = game.t;
    if (course().theme === 'tiny') { tone(520, 0.09, 'sawtooth', 0.06); tone(470, 0.14, 'sawtooth', 0.05, 0.08); }   // baa
    else tone(110, 0.08, 'triangle', 0.25 * Math.min(1, impact / 400));                                                 // thud
  },
  sand: () => tone(200, 0.12, 'triangle', 0.08),
  pickup: () => { tone(330, 0.15, 'sine', 0.15); tone(247, 0.3, 'sine', 0.15, 0.14); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.15, 0.4 + i * 0.12)),
};

// ---- View: scaling and portrait rotation ----------------------------------
// The world is always 900x600. When the screen is taller than it is wide and
// a sideways course would be bigger, the whole world is drawn rotated 90°
// (world left edge at the bottom of the screen).

const canvas = $('game');
const ctx = canvas.getContext('2d');
const view = { rotated: false, scale: 1, dpr: 1, signShown: false, shift: null };
const snap = document.createElement('canvas');   // the last hole, while it animates away

function resize() {
  const wrap = $('wrap');
  const hud = $('hud');
  const hint = $('hint');
  const ws = getComputedStyle(wrap);
  const gap = parseFloat(ws.rowGap) || 10;
  const padX = parseFloat(ws.paddingLeft) + parseFloat(ws.paddingRight);
  const padY = parseFloat(ws.paddingTop) + parseFloat(ws.paddingBottom);
  let availW = wrap.clientWidth - padX, availH = wrap.clientHeight - padY;   // inside the safe area
  const hintH = hint.offsetParent ? hint.offsetHeight + gap : 0;
  if (ws.flexDirection === 'row') {
    availW -= hud.offsetWidth + gap;
    availH -= hintH;
  } else {
    availH -= hud.offsetHeight + gap + hintH;
  }

  const wide = Math.min(availW / W, availH / H);
  const tall = Math.min(availW / H, availH / W);
  view.rotated = tall > wide * 1.1;
  view.scale = Math.max(0.2, view.rotated ? tall : wide);
  view.dpr = window.devicePixelRatio || 1;
  view.signShown = !view.rotated && !!(!game.demo && hole().label);

  const cssW = (view.rotated ? H : W) * view.scale;
  const cssH = (view.rotated ? W : H) * view.scale;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * view.dpr);
  canvas.height = Math.round(cssH * view.dpr);
  layerKey = '';             // fonts or size changed: redraw the static layer
  const th = theme();
  canvas.style.background = th.background ? th.background(view.rotated) : '';
  pausedFrameDrawn = false;
  if (toastTimer) positionToast();
}

// view.shift is a screen-space move (device px) laid over the world: used to
// carry a hole in during a transition and to zoom on a hole in one.
function worldTransform(c = ctx, shifted = true) {
  const s = view.scale * view.dpr;
  const sh = shifted && c === ctx ? view.shift : null;
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (sh) c.setTransform(sh.s, 0, 0, sh.s, sh.x, sh.y);
  if (view.rotated) c.transform(0, -s, s, 0, 0, W * s);
  else c.transform(s, 0, 0, s, 0, 0);
}

function toWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  if (view.rotated) {
    const u = ((clientX - r.left) / r.width) * H;
    const v = ((clientY - r.top) / r.height) * W;
    return { x: W - v, y: u };
  }
  return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
}

function toScreen(x, y) {
  return view.rotated ? { x: y * view.scale, y: (W - x) * view.scale } : { x: x * view.scale, y: y * view.scale };
}

window.addEventListener('resize', resize);
// Canvas text only triggers font downloads when first drawn, so ask for the
// theme fonts up front and redraw the cached layer whenever one arrives.
if (document.fonts) {
  document.fonts.addEventListener?.('loadingdone', () => { layerKey = ''; pausedFrameDrawn = false; });
  Promise.all(['700 20px Fredoka', '700 20px Caveat'].map(f => document.fonts.load(f).catch(() => {})))
    .then(() => { layerKey = ''; pausedFrameDrawn = false; resize(); });
}

// ---- Input ----------------------------------------------------------------
// Power comes from how far the pointer travels on screen (CSS px), so it feels
// the same on a phone and a monitor; direction comes from the world. Only the
// pointer that started the drag counts, so a second finger or a palm can't
// fire a shot.

function dragShot() {
  const d = game.drag;
  const px = Math.hypot(d.cx - d.scx, d.cy - d.scy);
  const a = toWorld(d.scx, d.scy), b = toWorld(d.cx, d.cy);
  const dx = a.x - b.x, dy = a.y - b.y;
  const len = Math.hypot(dx, dy);
  return { dx, dy, len, power: Math.min(px, MAX_DRAG_PX) / MAX_DRAG_PX };
}

const ownsPointer = e => game.drag && e.pointerId === game.drag.id;

canvas.addEventListener('pointerdown', e => {
  ensureAudio();
  if (game.drag || !e.isPrimary || e.button > 0) return;
  if (game.state !== 'aim' || game.paused || game.demo || game.trans) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
  game.kbAim = null;
  game.drag = { id: e.pointerId, scx: e.clientX, scy: e.clientY, cx: e.clientX, cy: e.clientY };
});

canvas.addEventListener('pointermove', e => {
  if (!ownsPointer(e)) return;
  game.drag.cx = e.clientX;
  game.drag.cy = e.clientY;
});

canvas.addEventListener('pointerup', e => {
  if (!ownsPointer(e)) return;
  ensureAudio();
  const { dx, dy, power } = dragShot();
  game.drag = null;
  if (power > 0.04) shoot(dx, dy, power);
});

for (const type of ['pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, e => { if (ownsPointer(e)) game.drag = null; });
}

// Keyboard putting: arrows aim (Shift for fine steps), up/down set power,
// Space or Enter shoots.
const AIM_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'];

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (game.drag) game.drag = null;
    else if (game.kbAim) game.kbAim = null;
    else if (game.paused) { game.paused = false; hideOverlay(); }
    else showMenu();
    return;
  }
  if ($('overlay').classList.contains('show')) return;   // let buttons have the keys
  if ((e.key === 'r' || e.key === 'R') && canRestart()) { startHole(game.holeIndex); return; }
  if (!AIM_KEYS.includes(e.key) || game.state !== 'aim' || game.paused || game.drag || game.demo || game.trans) return;
  e.preventDefault();
  ensureAudio();
  const b = game.ball;
  if (!game.kbAim) {
    const [cx, cy] = hole().cup;
    game.kbAim = { angle: Math.atan2(cy - b.y, cx - b.x), power: 0.4 };
    if (e.key === ' ' || e.key === 'Enter') return;      // first press just shows the aim
  }
  const turn = ((e.shiftKey ? 1 : 4) * Math.PI) / 180;
  const k = game.kbAim;
  if (e.key === 'ArrowLeft') k.angle -= turn;
  if (e.key === 'ArrowRight') k.angle += turn;
  if (e.key === 'ArrowUp') k.power = Math.min(1, k.power + 0.05);
  if (e.key === 'ArrowDown') k.power = Math.max(0.05, k.power - 0.05);
  if (e.key === ' ' || e.key === 'Enter') shoot(Math.cos(k.angle), Math.sin(k.angle), k.power);
});

// ---- Rendering ------------------------------------------------------------
// Everything that never moves during a hole is drawn once into an offscreen
// layer; each frame copies it and draws only the moving parts on top.

const layer = document.createElement('canvas');
const layerCtx = layer.getContext('2d');
let layerKey = '';

function viewState() {
  const h = hole();
  const b = game.ball;
  const [cx, cy] = h.cup;
  let aim = null;
  if (game.drag && game.state === 'aim') {
    const { dx, dy, len, power } = dragShot();
    if (len > 0.5) aim = { ux: dx / len, uy: dy / len, power };
  } else if (game.kbAim && game.state === 'aim') {
    aim = { ux: Math.cos(game.kbAim.angle), uy: Math.sin(game.kbAim.angle), power: game.kbAim.power };
  } else {
    aim = demoAim();
  }
  if (aim) Object.assign(aim, aimPath(aim.ux, aim.uy, aim.power));
  let r = Math.max(BALL_R, MIN_BALL_PX / view.scale);
  if (game.state === 'sinking') r *= 1 - 0.6 * game.timer;
  return {
    hole: h,
    holeIndex: game.holeIndex,
    t: reducedMotion.matches ? 0 : game.t,   // decoration only; obstacles come pre-placed below
    rotated: view.rotated,
    showLabel: view.signShown,
    ball: {
      x: b.x, y: b.y, r, visible: ['aim', 'rolling', 'sinking'].includes(game.state),
      spin: game.spin, dir: game.rollDir, trail: trailPoints(), ...squashNow(),
    },
    spinners: spinnerSegments(h, game.t),
    movers: moverStates(h, game.t),
    aim,
    flagAlpha: Math.max(0, Math.min(1, (Math.hypot(b.x - cx, b.y - cy) - 40) / 60)),
  };
}

// The aim line follows the ball's first stretch of travel, so slopes bend it.
// Walls stop it: it shows the start of the roll, not where the ball ends up.
function aimPath(ux, uy, power) {
  const h = hole(), b = game.ball;
  const reach = 30 + power * 140;
  const speed = Math.max(300, Math.pow(power, POWER_CURVE) * MAX_SPEED);
  const segs = boundarySegments(h), R = BALL_R + WALL_HALF;
  let x = b.x, y = b.y, vx = ux * speed, vy = uy * speed, dist = 0;
  const path = [];
  for (let i = 0; i < 300 && dist < reach; i++) {
    const z = zoneAt(h, x, y);
    if (z && z.type === 'slope') { vx += z.ax / 120; vy += z.ay / 120; }
    const s = Math.hypot(vx, vy);
    x += vx / 120; y += vy / 120; dist += s / 120;
    if (segs.some(g => distToSegment(x, y, g) < R)) break;
    if (dist > 14) path.push([x, y]);
  }
  if (path.length < 2) path.push([b.x + ux * 16, b.y + uy * 16], [b.x + ux * 22, b.y + uy * 22]);
  const [x1, y1] = path[path.length - 2], [x2, y2] = path[path.length - 1];
  const l = Math.hypot(x2 - x1, y2 - y1) || 1;
  return { path, end: { x: x2, y: y2, ux: (x2 - x1) / l, uy: (y2 - y1) / l } };
}

function distToSegment(x, y, s) {
  const ex = s.x2 - s.x1, ey = s.y2 - s.y1, l2 = ex * ex + ey * ey;
  const t = l2 ? Math.max(0, Math.min(1, ((x - s.x1) * ex + (y - s.y1) * ey) / l2)) : 0;
  return Math.hypot(x - (s.x1 + ex * t), y - (s.y1 + ey * t));
}

// Ghost copies behind a fast ball: positions from a few steps ago.
function trailPoints() {
  const tr = game.trail, out = [];
  if (game.state !== 'rolling' || tr.length < 10) return out;
  const v = tr[tr.length - 1].v;
  const k = Math.max(0, Math.min(1, (v - 380) / 600));
  if (!k) return out;
  [3, 6, 9].forEach((back, i) => {
    const p = tr[tr.length - 1 - back];
    out.push({ x: p.x, y: p.y, a: k * [0.35, 0.2, 0.1][i], s: [0.9, 0.8, 0.7][i] });
  });
  return out;
}

function squashNow() {
  const s = game.squash;
  if (!s) return { squash: 0, squashAng: 0 };
  return { squash: s.amt * Math.max(0, 1 - (game.t - s.t) / 0.12), squashAng: s.ang };
}

function staticLayer(v) {
  const key = [game.courseIndex, game.holeIndex, canvas.width, canvas.height, view.rotated, view.signShown].join(':');
  if (key !== layerKey) {
    layer.width = canvas.width;
    layer.height = canvas.height;
    worldTransform(layerCtx);
    theme().drawStatic(layerCtx, v);
    layerKey = key;
  }
  return layer;
}

// A little "!" pops over a sheep when the ball bumps it (drawn upright on screen).
function drawBubbles(v) {
  const now = game.t;
  for (const [i, t0] of Object.entries(game.bubbles)) {
    const age = now - t0, m = v.movers[i];
    if (age > 0.8 || !m) continue;
    const p = toScreen(m.x, m.y);
    const pop = Math.min(1, age / 0.12), fade = 1 - Math.max(0, (age - 0.55) / 0.25);
    const sz = (16 + 6 * Math.sin(Math.min(1, age / 0.2) * Math.PI)) * pop;
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.globalAlpha = fade;
    const x = p.x, y = p.y - (m.m.r + 14) * view.scale - sz;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(x - sz * 0.55, y - sz * 0.6, sz * 1.1, sz * 1.2, sz * 0.35); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, y + sz * 0.55); ctx.lineTo(x, y + sz * 0.95); ctx.lineTo(x + 4, y + sz * 0.55); ctx.fill();
    ctx.fillStyle = '#c8322d';
    ctx.font = `800 ${Math.round(sz)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y + sz * 0.38);
    ctx.restore();
  }
}

// Where the old hole goes and where the new one comes from, by progress p.
// 'rise': the old island floats up and away as the next rises through the sky.
// 'slide': the old mat slides off the desk to the left as the next slides in.
function transitionShifts(tr) {
  const Wd = canvas.width, Hd = canvas.height, e = eio(tr.p);
  if (tr.kind === 'slide') {
    return { old: { s: 1, x: -Wd * e, y: 0, a: 1 }, now: { s: 1, x: Wd * (1 - e), y: 0 } };
  }
  const so = 1 - 0.4 * e, sn = 0.86 + 0.14 * e;
  return {
    old: { s: so, x: (Wd - Wd * so) / 2, y: (Hd - Hd * so) / 2 - Hd * 0.45 * e, a: 1 - e },
    now: { s: sn, x: (Wd - Wd * sn) / 2, y: (Hd - Hd * sn) / 2 + Hd * 0.75 * (1 - e) },
  };
}

const eio = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// A hole in one: zoom gently on the cup while the banner pops.
function aceShift() {
  if (!game.ace || game.state === 'done') return null;
  const k = eio(Math.min(1, (game.t - game.ace.t) / 0.6)) * 0.14;
  const p = toScreen(hole().cup[0], hole().cup[1]);
  const cx = p.x * view.dpr, cy = p.y * view.dpr, s = 1 + k;
  return { s, x: cx - cx * s, y: cy - cy * s };
}

// "Hole in one!" in the course's own style, upright on screen.
function drawAceBanner() {
  const age = game.t - game.ace.t - 0.15;
  if (age <= 0) return;
  const pop = Math.min(1, age / 0.35);
  const s = pop < 1 ? 1 + 0.7 * Math.sin(pop * Math.PI) * (1 - pop) + (pop - 1) * 0.3 * (1 - pop) : 1;
  const Wc = canvas.width / view.dpr, Hc = canvas.height / view.dpr;
  const size = Math.max(28, Math.min(64, Wc * 0.08));
  ctx.save();
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.translate(Wc / 2, Hc * 0.24);
  ctx.scale(s * pop, s * pop);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (theme().banner === 'stamp') {
    ctx.rotate(-0.12);
    ctx.font = `900 ${size}px "Courier New", ui-monospace, monospace`;
    const w = ctx.measureText('HOLE IN ONE!').width + size;
    ctx.strokeStyle = ctx.fillStyle = 'rgba(200, 30, 40, 0.9)';
    ctx.lineWidth = size * 0.1;
    ctx.strokeRect(-w / 2, -size * 0.8, w, size * 1.6);
    ctx.lineWidth = size * 0.035;
    ctx.strokeRect(-w / 2 + size * 0.16, -size * 0.64, w - size * 0.32, size * 1.28);
    ctx.fillText('HOLE IN ONE!', 0, size * 0.04);
  } else {
    ctx.font = `700 ${size}px "Fredoka", system-ui, sans-serif`;
    const w = ctx.measureText('Hole in one!').width + size * 1.4, hh = size * 1.4;
    ctx.fillStyle = '#a8322e';
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sg * w * 0.42, -hh * 0.3); ctx.lineTo(sg * (w / 2 + size * 0.6), -hh * 0.3);
      ctx.lineTo(sg * (w / 2 + size * 0.35), hh * 0.15); ctx.lineTo(sg * (w / 2 + size * 0.6), hh * 0.6);
      ctx.lineTo(sg * w * 0.42, hh * 0.6); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#c8322d';
    ctx.beginPath(); ctx.roundRect(-w / 2, -hh / 2, w, hh, 8); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Hole in one!', 0, size * 0.06);
  }
  ctx.restore();
}

function render() {
  const v = viewState();
  const t = theme();
  const tr = game.trans;
  const sh = tr ? transitionShifts(tr) : null;
  if (t.background || tr) {
    // See-through sky (or a transition): clear and let the CSS background show.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  worldTransform(ctx, false);
  if (t.drawBackdrop) t.drawBackdrop(ctx, v);
  if (sh) {
    ctx.save();
    ctx.setTransform(sh.old.s, 0, 0, sh.old.s, sh.old.x, sh.old.y);
    ctx.globalAlpha = sh.old.a;
    ctx.drawImage(snap, 0, 0);
    ctx.restore();
  }
  view.shift = sh ? sh.now : aceShift();
  const img = staticLayer(v);
  const vs = view.shift;
  ctx.setTransform(vs ? vs.s : 1, 0, 0, vs ? vs.s : 1, vs ? vs.x : 0, vs ? vs.y : 0);
  ctx.drawImage(img, 0, 0);
  worldTransform();
  t.drawDynamic(ctx, v);
  drawParticles();
  view.shift = null;
  drawBubbles(v);
  if (game.ace) drawAceBanner();

  const { aim, ball: b } = v;
  if (aim) {
    const r = b.r;
    // Power ring around the ball (world space)...
    const hue = 120 - aim.power * 120;
    const color = `hsl(${hue}, 85%, 50%)`;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 5;
    circle(ctx, b.x, b.y, r + 9); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, aim.power));
    ctx.stroke();

    // ...and an upright percentage label next to it (screen space).
    const p = toScreen(b.x, b.y);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const label = `${Math.round(aim.power * 100)}%`;
    ctx.font = '700 13px system-ui, -apple-system, sans-serif';
    const tw = ctx.measureText(label).width + 12;
    const ly = p.y - (r + 9) * view.scale - 22 < 4 ? p.y + (r + 9) * view.scale + 6 : p.y - (r + 9) * view.scale - 22;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath(); ctx.roundRect(p.x - tw / 2, ly, tw, 18, 9); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, p.x, ly + 13);
    ctx.textAlign = 'left';
  }
}

// ---- Main loop ------------------------------------------------------------

let last = performance.now();
let acc = 0;
let pausedFrameDrawn = false;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  updateParticles(dt);
  if (game.trans && (game.trans.p += dt / TRANSITION) >= 1) game.trans = null;
  // While paused behind a menu nothing moves, so draw one frame and idle.
  if (game.paused && !particles.length) {
    if (!pausedFrameDrawn) { render(); pausedFrameDrawn = true; }
  } else {
    pausedFrameDrawn = false;
    render();
  }
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);

// Handy for debugging from the console and for automated tests.
window.miniGolf = { game, COURSES, shoot, step, render, updateParticles, aimPath, startCourse, startHole, save, view, toWorld };
