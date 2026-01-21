export const SHIFT_TYPES = ["Morning", "Afternoon", "Evening", "Night"] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

const SHIFT_SET = new Set<string>(SHIFT_TYPES);

export const normalizeShift = (shift: string): ShiftType =>
  SHIFT_SET.has(shift) ? (shift as ShiftType) : SHIFT_TYPES[0];
