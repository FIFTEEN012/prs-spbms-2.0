import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const baht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

export function formatBaht(value: number | string | null | undefined) {
  if (value == null) return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return baht.format(n);
}

const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatThaiDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return thaiDate.format(new Date(date));
}
