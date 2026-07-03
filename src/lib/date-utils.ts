export function parseThaiDateStr(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  if (cleaned === "") return null;

  // Check if it matches YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
  }

  // Check if it matches DD/MM/YYYY
  const parts = cleaned.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const year = parseInt(parts[2], 10);

    let targetYear = year;
    if (year > 2400) {
      targetYear -= 543; // Convert Buddhist year to Gregorian
    }

    const d = new Date(targetYear, month, day);
    if (isNaN(d.getTime())) return null;

    // Check if the reconstructed values match the parsed values (prevents overflow)
    if (d.getDate() !== day || d.getMonth() !== month || d.getFullYear() !== targetYear) {
      return null;
    }
    return d;
  }

  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}
