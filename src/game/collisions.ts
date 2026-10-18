import type { Obstacle, Ramp } from './types.js';

/** Pure collision / crossing helpers. No side effects, fully testable. */

/** Circle-vs-circle collision. */
export function circlesCollide(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy < rr * rr;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Does a circle of radius `r` moving straight from `from` to `to` this frame
 * touch any obstacle on the way? Testing the whole move rather than where it
 * ends means a fast rider cannot skip past a tree between two frames.
 */
export function sweptHitsObstacle(from: Point, to: Point, r: number, obstacles: readonly Obstacle[]): boolean {
  const mx = to.x - from.x;
  const my = to.y - from.y;
  const len2 = mx * mx + my * my;
  return obstacles.some((ob) => {
    // Closest point of the move to the obstacle's centre.
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((ob.x - from.x) * mx + (ob.y - from.y) * my) / len2));
    return circlesCollide(from.x + t * mx, from.y + t * my, r, ob.x, ob.y, ob.r);
  });
}

/** Did the player cross gateY between the previous and current frame? */
export function gateCrossed(prevY: number, newY: number, gateY: number): boolean {
  return prevY < gateY && newY >= gateY;
}

/** Was the player inside the gate opening when crossing? */
export function gatePassed(playerX: number, centerX: number, halfWidth: number): boolean {
  return Math.abs(playerX - centerX) <= halfWidth;
}

/** Did the player ride over the ramp's lip this frame? */
export function rampHit(prevY: number, newY: number, playerX: number, ramp: Ramp): boolean {
  return gateCrossed(prevY, newY, ramp.y) && gatePassed(playerX, ramp.x, ramp.halfWidth);
}
