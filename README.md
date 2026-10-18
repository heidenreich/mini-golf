# Mini Golf

A top-down 2D mini golf prototype in a single HTML file: plain canvas, no dependencies, no build step.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
```

- **Drag back** from anywhere on the course and release to putt. Longer drag = more power.
- **Esc** cancels a shot, **R** restarts the current hole.
- Works with mouse or touch.

## Course

| # | Hole | Par | What it shows |
|---|------|-----|---------------|
| 1 | Dogleg | 2 | Wall bounces, including an angled bank off the corner |
| 2 | Sand Trap | 3 | Water hazard (+1 stroke, ball returns) and sand that kills speed |
| 3 | Windmill | 3 | Ice, a spinning bar that knocks the ball, and a slope that pushes it sideways |

You pick up after 8 strokes on a hole. A scorecard appears after hole 3.

## How it works

Everything lives in `index.html`:

- **Physics:** fixed 120 Hz timestep. Each step is split into sub-steps no longer than half a ball radius, so fast shots can't pass through walls.
- **Walls:** line segments. The ball reflects off the closest point with some energy loss. Spinning bars add their own surface velocity, so they can hit a ball that's sitting still.
- **Surfaces:** each one has a proportional drag (`k`) and a constant rolling resistance (`decel`). Slopes add a steady acceleration.
- **Cup:** the ball drops only if it's moving slower than `CUP_CAPTURE_SPEED`. Faster balls curl around the lip and keep rolling.
- **Holes:** plain data in the `HOLES` array (fairway outline, start, cup, par, zones, extra walls, spinners). Adding a hole is just adding an entry.

`window.miniGolf` exposes the game state plus `shoot`, `step` and `startHole` for debugging and automated tests.

## Ideas for next steps

- More holes and a level editor (click to place walls, export JSON)
- Moving blockers, bumpers, teleporters, one-way gates
- Local hot-seat multiplayer
- Shot replays, ghost ball of your best round
- A 3D version with Three.js
