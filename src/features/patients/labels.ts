import type { TreatmentStatus } from "@/features/patients/schemas";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const treatmentStatusOptions: { value: TreatmentStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function sessionTypeLabel(type: "baseline" | "follow_up") {
  return type === "baseline" ? "Baseline" : "Follow-up";
}

export function sessionStatusLabel(status: "draft" | "completed" | "cancelled") {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  return "Draft";
}

export function treatmentStatusLabel(status: TreatmentStatus) {
  return treatmentStatusOptions.find((option) => option.value === status)?.label ?? "Planned";
}

export function formatChartDate(value: string | null) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  const month = MONTHS[Number(match[2]) - 1];
  if (!month) {
    return null;
  }

  return `${Number(match[3])} ${month} ${match[1]}`;
}
