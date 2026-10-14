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

/** Did the player cross gateY between the previous and current frame? */
export function gateCrossed(prevY: number, newY: number, gateY: number): boolean {
  return prevY < gateY && newY >= gateY;
}

/** Was the player inside the gate opening when crossing? */
export function gatePassed(playerX: number, centerX: number, halfWidth: number): boolean {
  return Math.abs(playerX - centerX) <= halfWidth;
}
