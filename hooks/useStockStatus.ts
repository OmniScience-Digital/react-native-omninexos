// src/hooks/useStockStatus.ts
export type StockStatus = "ok" | "low" | "out";

export const getStockStatus = (
  current: number,
  minimum: number,
): StockStatus => {
  if (current === 0) return "out";
  if (current < minimum) return "low";
  return "ok";
};
