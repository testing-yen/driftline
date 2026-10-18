/** Downhill scales the dev-only `?speedx=` URL param can pick, to compare the feel side by side on a phone. */
export const SPEEDX_CHOICES = [1, 2, 2.5, 3, 3.5] as const;

/** The downhill scale a URL query asks for, or null when it names none of SPEEDX_CHOICES. */
export function parseSpeedx(search: string): number | null {
  const asked = Number(new URLSearchParams(search).get('speedx'));
  return SPEEDX_CHOICES.find((k) => k === asked) ?? null;
}
