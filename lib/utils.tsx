import { type ClassValue, clsx } from "clsx";
import { DateTime } from "luxon";
import { twMerge } from "tailwind-merge";

export function getJhbTimestamp(): string {
  return DateTime.now()
    .setZone("Africa/Johannesburg")
    .toFormat("yyyy-MM-dd HH:mm:ss");
}

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

export const calculateCustomFields = (
  formState: any,
  vehicles: Fleet[],
  timestamp: string,
) => {
  const vehicle = vehicles.find((v) => v.id === formState.selectedVehicleId);
  if (!vehicle) throw new Error("Vehicle not found");

  const odometer = parseInt(formState.odometerValue);
  const today = new Date();

  const lastServiceKm = vehicle.lastServicekm ?? 0;
  const lastRotationKm = vehicle.lastRotationkm ?? 0;

  const lastServiceDate = vehicle.lastServicedate
    ? new Date(vehicle.lastServicedate)
    : null;

  // Service required: odometer > lastServiceKm + 12000 OR (if date exists) date > lastServiceDate + 334 days
  let serviceRequired = odometer > lastServiceKm + 11999;
  if (lastServiceDate) {
    serviceRequired =
      serviceRequired ||
      today > new Date(lastServiceDate.getTime() + 334 * 24 * 60 * 60 * 1000);
  }

  // Tyre rotation required: only if lastRotationKm exists and odometer exceeds it by 7000
  const tyreRotationRequired =
    lastRotationKm > 0 && odometer > lastRotationKm + 7000;

  // Review required (unchanged logic)
  const reviewRequired = formState.booleanQuestions.some((q: any) => {
    const question = q.question.toLowerCase();
    const value = q.value;
    if (question.includes("oil and coolant")) return !value;
    if (question.includes("full tank")) return !value;
    if (question.includes("seatbelt")) return !value;
    if (question.includes("handbrake")) return !value;
    if (
      question.includes("tyre") &&
      (question.includes("wear") || question.includes("tread"))
    )
      return !value;
    if (question.includes("spare tyre")) return !value;
    if (question.includes("number plate")) return !value;
    if (question.includes("license disc")) return !value;
    if (question.includes("leaks")) return value;
    if (question.includes("warning light")) return value;
    if (
      question.includes("headlights") ||
      question.includes("taillights") ||
      question.includes("fog lights") ||
      question.includes("indicators") ||
      question.includes("hazards")
    )
      return !value;
    if (question.includes("defrost") || question.includes("air condition"))
      return !value;
    if (question.includes("emergency kit")) return !value;
    if (question.includes("clean")) return !value;
    if (question.includes("windscreen wiper")) return !value;
    if (question.includes("service book")) return !value;
    return false;
  });

  return { serviceRequired, tyreRotationRequired, reviewRequired };
};

export function normalize(str: any): string {
  if (typeof str !== "string") return String(str);
  return str.trim().replace(/^"+|"+$/g, "");
}

export function getNextInspectionNumber(
  inspections: Inspection[] | undefined,
): number {
  return (inspections?.[0]?.inspectionNo ?? 0) + 1;
}
