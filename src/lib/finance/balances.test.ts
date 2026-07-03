import { describe, expect, it } from "vitest";
import { calculateFundBalance, calculateProjectBalance } from "./balances";

describe("ledger balances", () => {
  it("calculates fiscal fund remaining from posted allocations only", () => {
    expect(calculateFundBalance(100_000, [{ type: "ALLOCATION", amount: 25_000 }, { type: "DISBURSEMENT", amount: 2_000 }])).toBe(75_000);
  });

  it("deducts commitments and disbursements while refunds restore available project budget", () => {
    expect(calculateProjectBalance([
      { type: "ALLOCATION", amount: 100_000 },
      { type: "COMMITMENT", amount: 30_000 },
      { type: "COMMITMENT_RELEASE", amount: 10_000 },
      { type: "DISBURSEMENT", amount: 15_000 },
      { type: "REFUND", amount: 5_000 },
      { type: "ADJUSTMENT_DECREASE", amount: 2_000 },
    ])).toEqual({
      allocated: 98_000,
      committed: 20_000,
      disbursed: 10_000,
      available: 68_000,
    });
  });
});
