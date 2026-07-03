import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createBudgetPlan } from "@/lib/budget-plan-service";
import { DEFAULT_WALLET_FORMULA } from "@/lib/budget-wallets";
import { getServerSession } from "next-auth";

vi.mock("server-only", () => ({}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    budgetPlan: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/budget-plan-service", () => ({
  BudgetDomainError: class BudgetDomainError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message);
    }
  },
  createBudgetPlan: vi.fn(),
}));

describe("Budget plans collection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "finance-1", role: "FINANCE", departmentId: null },
    } as any);
  });

  it("creates a budget plan with the grouped default formula when no formula is provided", async () => {
    vi.mocked(createBudgetPlan).mockResolvedValue({ id: "plan-1" } as any);

    const res = await POST(
      new Request("http://localhost/api/budget-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: "academic-1",
          fiscalYearId: "fiscal-1",
          name: "Annual plan",
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(createBudgetPlan).toHaveBeenCalledWith({
      actor: { id: "finance-1", role: "FINANCE", departmentId: null },
      academicYearId: "academic-1",
      fiscalYearId: "fiscal-1",
      name: "Annual plan",
      formula: DEFAULT_WALLET_FORMULA,
    });
  });
});
