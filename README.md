# Mini Golf

A top-down 2D mini golf game in plain HTML canvas: no dependencies, no build step.

**Play:** https://heidenreich.github.io/mini-golf/

## Courses

**Tiny World** (main course, 9 holes, par 25): floating islands with hedges, trees, ponds, ice, windmills and wandering sheep.

| # | Hole | Par | What's on it |
|---|------|-----|--------------|
| 1 | Meadow Dogleg | 2 | Bank shots off an angled corner |
| 2 | Duck Pond | 3 | Pond (+1 stroke, ball returns) and two sand bunkers |
| 3 | Rolling Hills | 2 | Two hills pushing opposite ways |
| 4 | Zigzag Brook | 3 | Step-shaped fairway with a brook at the turn |
| 5 | Windmill Hill | 3 | Ice, windmill sails to time, and a hill that pushes sideways |
| 6 | Ice Rink | 2 | Slide across the ice into a hedge pocket |
| 7 | Narrow Bridge | 3 | A strip of grass between two ponds, then a sheep |
| 8 | Windmill Twins | 3 | Two windmills turning opposite ways |
| 9 | Sheep Crossing | 4 | Hedge maze with two wandering sheep that bump your ball |

**Desk Course** (bonus, 6 holes, par 19): mini golf on a messy desk. Unlocked by finishing Tiny World.

| # | Hole | Par | What's on it |
|---|------|-----|--------------|
| 1 | Coffee Break | 3 | Pencil and eraser walls, eraser shavings (sand) and an ink blot (water) |
| 2 | Ruler Run | 3 | Pencil slalom with a slick plastic sleeve |
| 3 | Pen Spin | 3 | Two spinning pens and a plastic sleeve |
| 4 | Ink Spill | 3 | Three ink blots and a spinning pen guarding the mug |
| 5 | Desk Fan | 3 | A fan blowing across the top and a sliding tape roll |
| 6 | Deadline | 4 | Around the U, through the fan's breeze, past a pen |

Best scores (per course layout), unlocks and which tips you've seen are saved in your browser. Add `?unlock` to the URL to unlock every course.

## Controls

- **Drag back** from anywhere on the course and release to putt. Full power is a thumb-length pull (140px on larger screens, down to about 110px on phones, so it fits above the screen edge); you can start the drag anywhere, not just at the ball; a ring and a percentage around the ball show the power. Power is curved, so the first half of the drag gives fine control for short putts.
- **Keyboard:** arrow keys aim (Shift for fine steps), up/down set power, Space or Enter putts.
- **☰ / Esc** opens the menu with the scorecard, restart and course select. **↻ / R** restarts the current hole.
- Works with mouse or touch. On a phone held upright the course turns 90° to fill the screen; held sideways, the scoreboard moves to a side rail.
- The first time you meet each hazard or obstacle, a tip explains what it does.
- The aim line follows the start of the roll, so it bends gently on hills; it stops at walls rather than predicting bounces.
- The title screen plays a short demo on hole 1 behind the menu.
- The ball is picked up after 8 strokes on a hole (you get a warning at 6).

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
```

## Code

| File | What it does |
|------|--------------|
| `js/courses.js` | Every course and hole, as plain data |
| `js/physics.js` | Tuning constants, zones, collisions with walls, spinners and moving obstacles |
| `js/main.js` | Game state, physics step, input, screens, saving, sound and the main loop |
| `js/theme-tiny.js` | Draws Tiny World |
| `js/theme-desk.js` | Draws Desk Course |
| `js/draw.js` | Small canvas helpers shared by the themes |
| `css/style.css` | Layout plus the HUD and menu styles for each theme |

How the physics works:

- **Timestep:** fixed at 120 Hz. Each step is split into sub-steps no longer than half a ball radius, so fast shots can't pass through walls.
- **Walls and obstacles:** walls are line segments. Spinners and movers add their own surface velocity, so they can knock a ball that's sitting still.
- **Surfaces:** each has a proportional drag and a constant rolling resistance. Slopes (and the desk fan) add a steady push.
- **Soft impacts:** hits slower than `SOFT_IMPACT` don't bounce, so a ball pushed against a wall settles instead of jittering.
- **Cup:** the ball only drops if it's moving slower than `CUP_CAPTURE_SPEED`. Faster balls curl around the lip.

Themes only draw; the game logic never depends on them. A theme registers itself in `THEMES` (declared in `js/draw.js`, where the full contract is documented) with:

- `drawStatic(ctx, view)`: everything that doesn't move during a hole, drawn once into a cached layer
- `drawDynamic(ctx, view)`: drawn every frame on top (flag, obstacles, ball, aim, animated zone details)
- optional `drawBackdrop(ctx, view)` and `background(rotated)` for anything under the course
- `confetti`, `splash`, `waterToast` and `tips`

A new look means a new `theme-*.js` file plus a CSS block.

Difficulty was tuned with a simulated player that aims and judges power imperfectly (about ±3–6° and ±8–15%): careful players finish a little under par, casual players a little over.

`window.miniGolf` exposes the game state plus `shoot`, `step`, `startCourse` and `startHole` for debugging and automated tests.
