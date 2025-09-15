export interface Star {
  hip: number;
  ra: number;
  dec: number;
  vmag: number;
  plx?: number | null;
  bv?: number | null;
  sp_type?: string | null;
  dist_pc?: number | null;
  absmag?: number | null;
  temp_k?: number | null;
  name?: string | null; // new
}
