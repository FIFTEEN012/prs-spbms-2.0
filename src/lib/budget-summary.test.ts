import { describe, expect, it } from "vitest";
import {
  addRunningBalances,
  canApplyBudgetTransaction,
  summarizeProjectBudget,
} from "./budget-summary";

describe("summarizeProjectBudget", () => {
  it("returns the full approved balance when there are no transactions", () => {
    expect(summarizeProjectBudget(100_000, [])).toEqual({
      approved: 100_000,
      grossSpent: 0,
      refunded: 0,
      netSpent: 0,
      remaining: 100_000,
      expenseCount: 0,
      historyCount: 0,
    });
  });

  it("subtracts expenses and restores refunds", () => {
    expect(
      summarizeProjectBudget(100_000, [
        { transactionType: "EXPENSE", amount: 30_000 },
        { transactionType: "EXPENSE", amount: 20_000 },
        { transactionType: "REFUND", amount: 5_000 },
      ]),
    ).toEqual({
      approved: 100_000,
      grossSpent: 50_000,
      refunded: 5_000,
      netSpent: 45_000,
      remaining: 55_000,
      expenseCount: 2,
      historyCount: 3,
    });
  });

  it("counts allocation and adjustment without applying them twice", () => {
    expect(
      summarizeProjectBudget(100_000, [
        { transactionType: "ALLOCATE", amount: 100_000 },
        { transactionType: "ADJUST", amount: 10_000 },
        { transactionType: "EXPENSE", amount: 25_000 },
      ]),
    ).toMatchObject({
      grossSpent: 25_000,
      netSpent: 25_000,
      remaining: 75_000,
      expenseCount: 1,
      historyCount: 3,
    });
  });

  it("preserves negative remaining balances from legacy overspending", () => {
    expect(
      summarizeProjectBudget(10_000, [
        { transactionType: "EXPENSE", amount: 12_000 },
      ]).remaining,
    ).toBe(-2_000);
  });
});

describe("addRunningBalances", () => {
  it("calculates balance after each newest-first history row", () => {
    const rows = addRunningBalances(100_000, [
      { id: "expense-2", transactionType: "EXPENSE", amount: 10_000 },
      { id: "refund-1", transactionType: "REFUND", amount: 5_000 },
      { id: "expense-1", transactionType: "EXPENSE", amount: 30_000 },
      { id: "allocation", transactionType: "ALLOCATE", amount: 100_000 },
    ]);

    expect(rows.map((row) => [row.id, row.balanceAfter])).toEqual([
      ["expense-2", 65_000],
      ["refund-1", 75_000],
      ["expense-1", 70_000],
      ["allocation", 100_000],
    ]);
  });
});

describe("canApplyBudgetTransaction", () => {
  it("rejects only expenses that exceed the current remaining balance", () => {
    const summary = summarizeProjectBudget(100_000, [
      { transactionType: "EXPENSE", amount: 80_000 },
    ]);

    expect(canApplyBudgetTransaction(summary, "EXPENSE", 20_000)).toBe(true);
    expect(canApplyBudgetTransaction(summary, "EXPENSE", 20_001)).toBe(false);
    expect(canApplyBudgetTransaction(summary, "REFUND", 25_000)).toBe(true);
  });
});
