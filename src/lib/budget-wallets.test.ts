import { describe, expect, it } from "vitest";
import {
  DEFAULT_WALLET_FORMULA,
  DEFAULT_WALLET_PERCENTAGES,
  calculateSourceNet,
  calculateWalletAllocations,
  calculateWalletAllocationPreview,
  calculateWalletBalance,
  deriveEffectiveWalletPercentages,
  normalizeWalletFormula,
  validateWalletPercentages,
} from "./budget-wallets";

describe("calculateWalletAllocations", () => {
  it("allocates the general subsidy from the default two-level formula", () => {
    const result = calculateWalletAllocations({
      generalSubsidyNet: 1_000_000,
      learnerActivityNet: 240_000,
      schoolIncomeNet: 75_000,
      formula: DEFAULT_WALLET_FORMULA,
    });

    expect(result).toEqual({
      RESERVE: 150_000,
      UTILITIES: 150_000,
      CENTRAL: 200_000,
      ACADEMIC: 200_000,
      BUDGET: 25_000,
      PERSONNEL: 100_000,
      GENERAL: 175_000,
      LEARNER_ACTIVITY: 240_000,
      SCHOOL_INCOME: 75_000,
    });
  });

  it("derives the original flat effective percentages from the default grouped formula", () => {
    expect(deriveEffectiveWalletPercentages(DEFAULT_WALLET_FORMULA)).toEqual(DEFAULT_WALLET_PERCENTAGES);
  });

  it("normalizes legacy flat percentage snapshots", () => {
    expect(deriveEffectiveWalletPercentages(normalizeWalletFormula(DEFAULT_WALLET_PERCENTAGES))).toEqual(DEFAULT_WALLET_PERCENTAGES);
  });

  it("places the final satang rounding remainder in the central wallet", () => {
    const result = calculateWalletAllocations({
      generalSubsidyNet: 100.01,
      learnerActivityNet: 0,
      schoolIncomeNet: 0,
      formula: DEFAULT_WALLET_FORMULA,
    });

    const formulaTotal =
      result.RESERVE +
      result.UTILITIES +
      result.CENTRAL +
      result.ACADEMIC +
      result.BUDGET +
      result.PERSONNEL +
      result.GENERAL;
    expect(formulaTotal).toBe(100.01);
  });

  it("rejects a percentage template that does not total 100 percent", () => {
    expect(() =>
      validateWalletPercentages({ ...DEFAULT_WALLET_FORMULA, qualityPercent: 40 }),
    ).toThrow("top-level");
  });

  it("rejects an operating subgroup that does not total 100 percent", () => {
    expect(() =>
      validateWalletPercentages({
        ...DEFAULT_WALLET_FORMULA,
        operating: { ...DEFAULT_WALLET_FORMULA.operating, CENTRAL: 39 },
      }),
    ).toThrow("operating");
  });

  it("rejects a quality subgroup that does not total 100 percent", () => {
    expect(() =>
      validateWalletPercentages({
        ...DEFAULT_WALLET_FORMULA,
        quality: { ...DEFAULT_WALLET_FORMULA.quality, GENERAL: 34 },
      }),
    ).toThrow("quality");
  });

  it("returns an invalid preview state instead of throwing when percentages are incomplete", () => {
    const result = calculateWalletAllocationPreview({
      generalSubsidyNet: 100_000,
      learnerActivityNet: 0,
      schoolIncomeNet: 0,
      formula: { ...DEFAULT_WALLET_FORMULA, operatingPercent: 40 },
    });

    expect(result).toEqual({
      allocations: null,
      error: "Wallet top-level percentages must total 100 percent (received 90)",
    });
  });
});

describe("calculateSourceNet", () => {
  it("calculates receipts, carry forward, deductions, returns, and corrections", () => {
    expect(
      calculateSourceNet([
        { entryType: "RECEIPT", amount: 1_000_000 },
        { entryType: "CARRY_FORWARD", amount: 100_000 },
        { entryType: "DEDUCTION", amount: 25_000 },
        { entryType: "RETURN", amount: 5_000 },
        { entryType: "CORRECTION_INCREASE", amount: 1_000 },
        { entryType: "CORRECTION_DECREASE", amount: 500 },
      ]),
    ).toBe(1_070_500);
  });
});

describe("calculateWalletBalance", () => {
  it("separates accounting balance from available balance", () => {
    expect(
      calculateWalletBalance([
        { entryType: "ALLOCATION", amount: 100_000 },
        { entryType: "COMMITMENT", amount: 60_000 },
        { entryType: "COMMITMENT_RELEASE", amount: 20_000 },
        { entryType: "DISBURSEMENT", amount: 20_000 },
        { entryType: "REFUND", amount: 5_000 },
        { entryType: "TRANSFER_IN", amount: 10_000 },
        { entryType: "TRANSFER_OUT", amount: 2_000 },
      ]),
    ).toEqual({
      allocated: 108_000,
      committed: 40_000,
      netDisbursed: 15_000,
      accountingBalance: 93_000,
      availableBalance: 53_000,
    });
  });
});
