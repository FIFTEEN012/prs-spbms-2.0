import { formatBaht } from "@/lib/utils";

export const MAX_PURCHASE_ITEMS = 20;

export const PURCHASE_ITEM_CAPACITY_ERROR =
  "บันทึกข้อความรองรับรายการพัสดุไม่เกิน 20 รายการ กรุณาแยกเป็นคำขอใหม่";

export function getPurchaseItemCapacityError(itemCount: number): string | null {
  return itemCount > MAX_PURCHASE_ITEMS ? PURCHASE_ITEM_CAPACITY_ERROR : null;
}

export function getPurchasePrintRows<T>(items: readonly T[]): Array<T | null> {
  const capacityError = getPurchaseItemCapacityError(items.length);
  if (capacityError) throw new Error(capacityError);

  return [
    ...items,
    ...Array.from({ length: MAX_PURCHASE_ITEMS - items.length }, () => null),
  ];
}

export function formatMemoBudgetAmount(
  value: unknown,
  fallbackDots = 20,
) {
  if (value === null || value === undefined) return ".".repeat(fallbackDots);
  const amount = Number(value);
  return Number.isFinite(amount) ? formatBaht(amount) : ".".repeat(fallbackDots);
}
