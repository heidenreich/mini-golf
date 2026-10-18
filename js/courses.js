'use strict';

// Each hole is plain data:
//   shape     outline of the fairway; its edges become the boundary walls
//   walls     extra wall segments [x1, y1, x2, y2]
//   zones     sand / water (ellipses) and ice / slope (rectangles);
//             slopes push the ball with ax, ay (px/s²)
//   spinners  rotating bars: len = half-length, speed = rad/s (negative spins
//             the other way)
//   movers    round obstacles that glide between two points and back
//   label     where the theme draws the hole's sign or sticky note

const COURSES = [
  {
    id: 'tiny',
    name: 'Tiny World',
    theme: 'tiny',
    blurb: 'Floating islands, hedges, a duck pond and some wandering sheep.',
    holes: [
      {
        name: 'Meadow Dogleg',
        par: 2,
        shape: [[100, 180], [180, 100], [820, 100], [820, 280], [300, 280], [300, 520], [100, 520]],
        start: [200, 450],
        cup: [740, 190],
        label: [560, 410],
      },
      {
        name: 'Duck Pond',
        par: 3,
        shape: [[80, 120], [820, 120], [820, 480], [80, 480]],
        start: [160, 200],
        cup: [740, 200],
        zones: [
          { type: 'water', x: 400, y: 100, w: 110, h: 270 },
          { type: 'sand', x: 395, y: 420, w: 120, h: 90 },
          { type: 'sand', x: 610, y: 250, w: 120, h: 110 },
        ],
      },
      {
        name: 'Windmill Hill',
        par: 3,
        shape: [[80, 200], [820, 200], [820, 400], [80, 400]],
        start: [130, 300],
        cup: [765, 300],
        zones: [
          { type: 'ice', x: 190, y: 200, w: 150, h: 200 },
          { type: 'slope', x: 590, y: 200, w: 110, h: 200, ax: 0, ay: 220 },
        ],
        spinners: [{ x: 450, y: 300, len: 76, speed: 1.4 }],
        label: [450, 505],
      },
      {
        name: 'Sheep Crossing',
        par: 4,
        shape: [[80, 120], [820, 120], [820, 480], [80, 480]],
        walls: [[330, 120, 330, 310], [570, 290, 570, 480]],
        start: [200, 420],
        cup: [700, 420],
        zones: [{ type: 'sand', x: 630, y: 140, w: 130, h: 70 }],
        movers: [
          { kind: 'sheep', x1: 450, y1: 170, x2: 450, y2: 430, r: 13, period: 7, phase: 0 },
          { kind: 'sheep', x1: 785, y1: 160, x2: 785, y2: 440, r: 13, period: 7, phase: 1.7 },
        ],
      },
    ],
  },
  {
    id: 'desk',
    name: 'Desk Course',
    theme: 'desk',
    bonus: true,
    blurb: 'Rulers, pencils, ink blots and a desk fan.',
    holes: [
      {
        name: 'Coffee Break',
        par: 3,
        shape: [[80, 140], [820, 140], [820, 460], [80, 460]],
        walls: [[300, 140, 300, 330], [540, 270, 540, 460], [655, 140, 655, 200]],
        start: [160, 380],
        cup: [740, 220],
        zones: [
          { type: 'sand', x: 360, y: 350, w: 120, h: 100 },
          { type: 'water', x: 640, y: 345, w: 110, h: 95 },
        ],
        label: [640, 482],
      },
      {
        name: 'Pen Spin',
        par: 3,
        shape: [[100, 300], [220, 180], [860, 180], [860, 420], [220, 420]],
        start: [170, 300],
        cup: [790, 300],
        zones: [{ type: 'ice', x: 480, y: 180, w: 40, h: 240 }],
        spinners: [
          { x: 380, y: 300, len: 100, speed: 1.3 },
          { x: 620, y: 300, len: 100, speed: -1.7 },
        ],
        label: [60, 455],
      },
      {
        name: 'Desk Fan',
        par: 3,
        shape: [[100, 100], [800, 100], [800, 500], [560, 500], [560, 260], [340, 260], [340, 500], [100, 500]],
        start: [220, 440],
        cup: [680, 440],
        zones: [
          { type: 'slope', x: 340, y: 100, w: 220, h: 160, ax: 0, ay: 260 },
          { type: 'sand', x: 590, y: 280, w: 120, h: 70 },
        ],
        movers: [{ kind: 'tape', x1: 600, y1: 385, x2: 760, y2: 385, r: 16, period: 4.5, phase: 0 }],
        label: [385, 330],
      },
    ],
  },
];
