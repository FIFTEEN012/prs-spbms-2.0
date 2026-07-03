import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "./route";
import { updateBudgetPlanPercentages } from "@/lib/budget-plan-service";
import { DEFAULT_WALLET_FORMULA } from "@/lib/budget-wallets";
import { getServerSession } from "next-auth";

vi.mock("server-only", () => ({}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/budget-plan-service", () => ({
  BudgetDomainError: class BudgetDomainError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message);
    }
  },
  updateBudgetPlanPercentages: vi.fn(),
}));

const params = Promise.resolve({ id: "plan-1" });

describe("Budget plan item API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "finance-1", role: "FINANCE", departmentId: null },
    } as any);
  });

  it("updates a budget plan with a grouped formula", async () => {
    vi.mocked(updateBudgetPlanPercentages).mockResolvedValue({ id: "plan-1" } as any);

    const res = await PUT(
      new Request("http://localhost/api/budget-plans/plan-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula: DEFAULT_WALLET_FORMULA }),
      }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(updateBudgetPlanPercentages).toHaveBeenCalledWith({
      actor: { id: "finance-1", role: "FINANCE", departmentId: null },
      budgetPlanId: "plan-1",
      formula: DEFAULT_WALLET_FORMULA,
    });
  });

  it("rejects a grouped formula with an invalid total", async () => {
    const res = await PUT(
      new Request("http://localhost/api/budget-plans/plan-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formula: {
            ...DEFAULT_WALLET_FORMULA,
            qualityPercent: 40,
          },
        }),
      }),
      { params },
    );

    expect(res.status).toBe(400);
    expect(updateBudgetPlanPercentages).not.toHaveBeenCalled();
  });
});
