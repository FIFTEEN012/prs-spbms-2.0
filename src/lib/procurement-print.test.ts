import { describe, expect, it } from "vitest";
import {
  MAX_PURCHASE_ITEMS,
  formatMemoBudgetAmount,
  getPurchaseItemCapacityError,
  getPurchasePrintRows,
} from "./procurement-print";

describe("procurement print item capacity", () => {
  it("accepts one item", () => {
    expect(getPurchaseItemCapacityError(1)).toBeNull();
  });

  it("accepts exactly twenty items", () => {
    expect(MAX_PURCHASE_ITEMS).toBe(20);
    expect(getPurchaseItemCapacityError(20)).toBeNull();
  });

  it("rejects the twenty-first item", () => {
    expect(getPurchaseItemCapacityError(21)).toBe(
      "บันทึกข้อความรองรับรายการพัสดุไม่เกิน 20 รายการ กรุณาแยกเป็นคำขอใหม่",
    );
  });
});

describe("procurement print rows", () => {
  it("pads a single item to twenty printable rows", () => {
    const rows = getPurchasePrintRows([{ id: "item-1" }]);

    expect(rows).toHaveLength(20);
    expect(rows[0]).toEqual({ id: "item-1" });
    expect(rows.slice(1).every((row) => row === null)).toBe(true);
  });

  it("keeps all twenty items without adding rows", () => {
    const items = Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}` }));

    expect(getPurchasePrintRows(items)).toEqual(items);
  });

  it("refuses to silently truncate more than twenty items", () => {
    const items = Array.from({ length: 21 }, (_, index) => ({ id: `item-${index}` }));

    expect(() => getPurchasePrintRows(items)).toThrow(
      "บันทึกข้อความรองรับรายการพัสดุไม่เกิน 20 รายการ กรุณาแยกเป็นคำขอใหม่",
    );
  });
});

describe("procurement memo budget amounts", () => {
  it("formats snapshot numbers for the printable memo", () => {
    expect(formatMemoBudgetAmount(1234.5)).toContain("1,234.50");
  });

  it("keeps dotted fallback when a snapshot amount is missing", () => {
    expect(formatMemoBudgetAmount(null, 5)).toBe(".....");
  });
});
