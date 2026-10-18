# Mini Golf

A top-down 2D mini golf game in plain HTML canvas: no dependencies, no build step.

**Play:** https://heidenreich.github.io/mini-golf/

## Courses

**Tiny World** (main course, 4 holes, par 12): floating islands with hedges, trees, a duck pond and wandering sheep.

| # | Hole | Par | What's on it |
|---|------|-----|--------------|
| 1 | Meadow Dogleg | 2 | Bank shots off an angled corner |
| 2 | Duck Pond | 3 | Pond (+1 stroke, ball returns) and two sand bunkers |
| 3 | Sheep Crossing | 4 | Hedge maze with two sheep that knock your ball around |
| 4 | Windmill Hill | 3 | Ice, windmill sails to time, and a hill that pushes sideways |

**Desk Course** (bonus, 3 holes, par 10): mini golf on a messy desk. Unlocked by finishing Tiny World.

| # | Hole | Par | What's on it |
|---|------|-----|--------------|
| 1 | Coffee Break | 3 | Pencil walls, a coffee spill (sand) and an ink blot (water) |
| 2 | Pen Spin | 3 | Two spinning pens and a slick plastic sleeve |
| 3 | Desk Fan | 4 | A fan blowing across the top and a rolling tape roll |

Best scores and unlocks are saved in your browser. Add `?unlock` to the URL to unlock every course.

## Controls

- **Drag back** from anywhere on the course and release to putt. Longer drag = more power.
- **☰ / Esc** opens the menu with the scorecard, restart and course select.
- **R** restarts the current hole.
- Works with mouse or touch. On a phone, turning it sideways gives a bigger course.

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
- **Cup:** the ball only drops if it's moving slower than `CUP_CAPTURE_SPEED`. Faster balls curl around the lip.

Themes only draw; the game logic never depends on them. A theme is an object in `THEMES` with a `draw(ctx, view)` function and a list of confetti colors, so a new look means a new `theme-*.js` file plus a CSS block.

`window.miniGolf` exposes the game state plus `shoot`, `step`, `startCourse` and `startHole` for debugging and automated tests.
