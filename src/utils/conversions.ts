// src/utils/conversions.ts
export const STAR_DISTANCE_SCALE = 0.4; // adjust for density, bigger => more spread

export function toCartesian(ra: number, dec: number, dist: number) {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const d = Math.max(0.1, dist) * STAR_DISTANCE_SCALE;
  const x = d * Math.cos(decRad) * Math.cos(raRad);
  const y = d * Math.sin(decRad);
  const z = d * Math.cos(decRad) * Math.sin(raRad);
  return [x, y, z];
}
