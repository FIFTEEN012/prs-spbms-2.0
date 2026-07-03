import { describe, expect, it } from "vitest";
import { parseApprovalQueueFilters } from "@/lib/approval-list-service";
import { parseProjectListFilters } from "@/lib/project-list-service";
import { parsePurchaseRequestListFilters } from "@/lib/purchase-request-list-service";
import { parseUserListFilters } from "@/lib/user-list-service";

describe("shared list filter parsing", () => {
  it("falls back to safe defaults for project filters", () => {
    const filters = parseProjectListFilters(
      new URLSearchParams({
        page: "-10",
        limit: "999",
        sortBy: "unknown",
        sortDir: "sideways",
        status: "INVALID",
      }),
    );

    expect(filters.page).toBe(1);
    expect(filters.limit).toBe(10);
    expect(filters.sortBy).toBe("createdAt");
    expect(filters.sortDir).toBe("desc");
    expect(filters.status).toBe("");
  });

  it("ignores invalid user role filters", () => {
    const filters = parseUserListFilters(
      new URLSearchParams({
        role: "HACKER",
        isActive: "maybe",
      }),
    );

    expect(filters.role).toBe("");
    expect(filters.isActive).toBe("");
  });

  it("restricts approval queue statuses to the supported workflow states", () => {
    const filters = parseApprovalQueueFilters(
      new URLSearchParams({
        status: "APPROVED",
      }),
    );

    expect(filters.status).toBe("");
    expect(filters.sortBy).toBe("updatedAt");
  });

  it("rejects malformed dates and negative amounts for purchase request filters", () => {
    const filters = parsePurchaseRequestListFilters(
      new URLSearchParams({
        dateFrom: "not-a-date",
        dateTo: "2026-13-99",
        minAmount: "-5",
        maxAmount: "bad",
        month: "2026-06",
        status: "APPROVED",
      }),
    );

    expect(filters.dateFrom).toBeUndefined();
    expect(filters.dateTo).toBeUndefined();
    expect(filters.minAmount).toBeUndefined();
    expect(filters.maxAmount).toBeUndefined();
    expect(filters.month).toBe("2026-06");
    expect(filters.status).toBe("APPROVED");
  });
});
