import { z } from "zod";
import type { PeriodKey } from "./period";

const idList = z
  .string()
  .optional()
  .transform((s) =>
    s
      ? s
          .split(",")
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
          .slice(0, 200)
      : []
  );

const codeList = z
  .string()
  .optional()
  .transform((s) =>
    s
      ? s
          .split(",")
          .filter((c) => /^[a-z0-9_-]{1,30}$/.test(c))
          .slice(0, 20)
      : []
  );

const schema = z.object({
  p: z.enum(["month", "12m", "year"]).catch("month"),
  area: idList,
  loc: idList,
  pos: idList,
  ct: codeList,
});

export interface HeadcountFilters {
  p: PeriodKey;
  area: number[];
  loc: number[];
  pos: number[];
  ct: string[];
}

export function parseFilters(
  sp: Record<string, string | string[] | undefined>
): HeadcountFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return schema.parse({
    p: first(sp.p),
    area: first(sp.area),
    loc: first(sp.loc),
    pos: first(sp.pos),
    ct: first(sp.ct),
  });
}

export const hasActiveFilters = (f: HeadcountFilters) =>
  f.area.length + f.loc.length + f.pos.length + f.ct.length > 0;
