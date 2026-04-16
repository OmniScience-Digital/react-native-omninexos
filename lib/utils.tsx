import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// utils/copyright.ts
export const getCopyright = (
  companyName = "Massive Pty Ltd",
  startYear?: number,
): string => {
  const currentYear = new Date().getFullYear();
  const year =
    startYear && startYear !== currentYear
      ? `${startYear}–${currentYear}`
      : currentYear;
  return `© ${year} ${companyName}. All rights reserved.`;
};
