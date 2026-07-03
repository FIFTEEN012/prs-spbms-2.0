import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

vi.mock("server-only", () => ({}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    budgetSourceEntry: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation((cb) => cb(mockPrisma));
  return { prisma: mockPrisma };
});

const params = Promise.resolve({ id: "plan-1", entryId: "entry-1" });

function mockFinanceSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: "finance-1", role: "FINANCE", departmentId: null },
  } as any);
}

function mockEntry(status = "DRAFT") {
  vi.mocked(prisma.budgetSourceEntry.findFirst).mockResolvedValue({
    id: "entry-1",
    sourceAccountId: "account-1",
    sourceAccount: {
      budgetPlanId: "plan-1",
      budgetPlan: { id: "plan-1", status },
      fundSource: { code: "GENERAL_SUBSIDY" },
    },
  } as any);
}

describe("Budget source entry item API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a source entry when the budget plan is DRAFT", async () => {
    mockFinanceSession();
    mockEntry();
    vi.mocked(prisma.budgetSourceEntry.update).mockResolvedValue({ id: "entry-1" } as any);

    const res = await PUT(
      new Request("http://localhost/api/budget-plans/plan-1/source-entries/entry-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType: "RECEIPT",
          amount: 1250.5,
          description: "Corrected amount",
          documentNo: "DOC-1",
          entryDate: "2026-06-23",
        }),
      }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(prisma.budgetSourceEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: {
        entryType: "RECEIPT",
        amount: 1250.5,
        description: "Corrected amount",
        documentNo: "DOC-1",
        entryDate: new Date("2026-06-23"),
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "finance-1",
        action: "BUDGET_SOURCE_ENTRY_UPDATE",
        entityName: "BudgetSourceEntry",
        entityId: "entry-1",
        metadata: { budgetPlanId: "plan-1", sourceCode: "GENERAL_SUBSIDY" },
      },
    });
  });

  it("deletes a source entry when the budget plan is DRAFT", async () => {
    mockFinanceSession();
    mockEntry();
    vi.mocked(prisma.budgetSourceEntry.delete).mockResolvedValue({ id: "entry-1" } as any);

    const res = await DELETE(
      new Request("http://localhost/api/budget-plans/plan-1/source-entries/entry-1", {
        method: "DELETE",
      }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(prisma.budgetSourceEntry.delete).toHaveBeenCalledWith({
      where: { id: "entry-1" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "finance-1",
        action: "BUDGET_SOURCE_ENTRY_DELETE",
        entityName: "BudgetSourceEntry",
        entityId: "entry-1",
        metadata: { budgetPlanId: "plan-1", sourceCode: "GENERAL_SUBSIDY" },
      },
    });
  });

  it("rejects updates when the budget plan is not DRAFT", async () => {
    mockFinanceSession();
    mockEntry("LOCKED");

    const res = await PUT(
      new Request("http://localhost/api/budget-plans/plan-1/source-entries/entry-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType: "RECEIPT",
          amount: 100,
          description: "Nope",
        }),
      }),
      { params },
    );

    expect(res.status).toBe(400);
    expect(prisma.budgetSourceEntry.update).not.toHaveBeenCalled();
  });

  it("rejects deletes when the source entry is outside the budget plan", async () => {
    mockFinanceSession();
    vi.mocked(prisma.budgetSourceEntry.findFirst).mockResolvedValue(null);

    const res = await DELETE(
      new Request("http://localhost/api/budget-plans/plan-1/source-entries/entry-1", {
        method: "DELETE",
      }),
      { params },
    );

    expect(res.status).toBe(404);
    expect(prisma.budgetSourceEntry.delete).not.toHaveBeenCalled();
  });

  it("rejects invalid update payloads", async () => {
    mockFinanceSession();

    const res = await PUT(
      new Request("http://localhost/api/budget-plans/plan-1/source-entries/entry-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType: "RECEIPT",
          amount: 0,
          description: "",
        }),
      }),
      { params },
    );

    expect(res.status).toBe(400);
    expect(prisma.budgetSourceEntry.update).not.toHaveBeenCalled();
  });
});
