import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPurchaseRequestList } from "@/lib/purchase-request-list-service";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchaseRequest: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    projectActivity: {
      findMany: vi.fn(),
    },
  },
}));

describe("getPurchaseRequestList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns procurement ledger fields and current activity remaining", async () => {
    vi.mocked(prisma.purchaseRequest.count).mockResolvedValue(1);
    vi.mocked(prisma.purchaseRequest.findMany)
      .mockResolvedValueOnce([
        {
          id: "request-1",
          projectId: "project-1",
          activityId: "activity-1",
          documentDate: new Date("2026-06-22T00:00:00.000Z"),
          documentNo: "PR-001",
          subject: "ซื้อกระดาษ",
          category: "SUPPLIES",
          categoryDetails: null,
          fundSourceId: "fund-1",
          budgetWalletId: "wallet-1",
          actionPlanPage: "12",
          isNotInPlan: false,
          necessityDetails: null,
          committee: [],
          borrowedFrom: [],
          requestedAmount: 300,
          allocatedBudget: 1000,
          previousBalance: 800,
          remainingBalance: 500,
          status: "PENDING",
          project: {
            id: "project-1",
            projectCode: "P001",
            projectName: "โครงการห้องเรียน",
            department: { name: "วิชาการ" },
          },
          activity: { id: "activity-1", name: "กิจกรรมอบรม", budget: 1000 },
          fundSource: { id: "fund-1", name: "เงินอุดหนุน" },
          budgetWallet: { id: "wallet-1", code: "ACADEMIC", name: "วิชาการ" },
          items: [
            { id: "item-1", itemName: "กระดาษ", quantity: 1, unitPrice: 100, totalPrice: 100, remarks: null },
            { id: "item-2", itemName: "หมึก", quantity: 1, unitPrice: 100, totalPrice: 100, remarks: null },
            { id: "item-3", itemName: "แฟ้ม", quantity: 1, unitPrice: 100, totalPrice: 100, remarks: null },
          ],
          createdBy: { fullName: "ครูผู้ขอ" },
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          id: "request-1",
          projectId: "project-1",
          activityId: "activity-1",
          requestedAmount: 300,
          borrowedFrom: [],
        },
        {
          id: "request-2",
          projectId: "project-1",
          activityId: "activity-1",
          requestedAmount: 200,
          borrowedFrom: [],
        },
      ] as any);
    vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
      { id: "activity-1", projectId: "project-1", budget: 1000 },
    ] as any);

    const result = await getPurchaseRequestList(new URLSearchParams(), {
      role: "SUPER_ADMIN",
    });

    expect(result.data[0]).toMatchObject({
      id: "request-1",
      itemCount: 3,
      itemSummary: "กระดาษ, หมึก +1",
      canInlineEdit: true,
      allocatedBudget: 1000,
      previousBalance: 800,
      remainingBalance: 500,
      activityCurrentRemaining: 500,
      project: {
        projectCode: "P001",
        departmentName: "วิชาการ",
      },
      activity: {
        name: "กิจกรรมอบรม",
        budget: 1000,
      },
    });
  });
});
