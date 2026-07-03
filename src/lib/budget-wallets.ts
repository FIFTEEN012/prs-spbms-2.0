export const FORMULA_WALLET_CODES = [
  "RESERVE",
  "UTILITIES",
  "CENTRAL",
  "ACADEMIC",
  "BUDGET",
  "PERSONNEL",
  "GENERAL",
] as const;

export const SPECIAL_WALLET_CODES = [
  "LEARNER_ACTIVITY",
  "SCHOOL_INCOME",
] as const;

export type FormulaWalletCode = (typeof FORMULA_WALLET_CODES)[number];
export type SpecialWalletCode = (typeof SPECIAL_WALLET_CODES)[number];
export type WalletCode = FormulaWalletCode | SpecialWalletCode;

export type OperatingWalletCode = "RESERVE" | "UTILITIES" | "CENTRAL";
export type QualityWalletCode = "ACADEMIC" | "BUDGET" | "PERSONNEL" | "GENERAL";
export type WalletPercentages = Record<FormulaWalletCode, number>;
export type WalletFormula = {
  operatingPercent: number;
  qualityPercent: number;
  operating: Record<OperatingWalletCode, number>;
  quality: Record<QualityWalletCode, number>;
};
export type WalletFormulaInput = WalletFormula | WalletPercentages;

export const DEFAULT_WALLET_PERCENTAGES: WalletPercentages = {
  RESERVE: 15,
  UTILITIES: 15,
  CENTRAL: 20,
  ACADEMIC: 20,
  BUDGET: 2.5,
  PERSONNEL: 10,
  GENERAL: 17.5,
};

export const DEFAULT_WALLET_FORMULA: WalletFormula = {
  operatingPercent: 50,
  qualityPercent: 50,
  operating: {
    RESERVE: 30,
    UTILITIES: 30,
    CENTRAL: 40,
  },
  quality: {
    ACADEMIC: 40,
    BUDGET: 5,
    PERSONNEL: 20,
    GENERAL: 35,
  },
};

export type SourceEntryType =
  | "RECEIPT"
  | "CARRY_FORWARD"
  | "DEDUCTION"
  | "RETURN"
  | "CORRECTION_INCREASE"
  | "CORRECTION_DECREASE";

export type WalletLedgerType =
  | "ALLOCATION"
  | "COMMITMENT"
  | "COMMITMENT_RELEASE"
  | "DISBURSEMENT"
  | "REFUND"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT_INCREASE"
  | "ADJUSTMENT_DECREASE";

type AmountValue = number | string | { toString(): string };

function toSatang(value: AmountValue): number {
  return Math.round(Number(value) * 100);
}

function fromSatang(value: number): number {
  return Number((value / 100).toFixed(2));
}

function assertTotal(label: string, total: number): void {
  if (Math.abs(total - 100) > 0.000001) {
    throw new Error(`Wallet ${label} percentages must total 100 percent (received ${total})`);
  }
}

function isGroupedFormula(value: WalletFormulaInput): value is WalletFormula {
  return (
    "operatingPercent" in value &&
    "qualityPercent" in value &&
    "operating" in value &&
    "quality" in value
  );
}

export function normalizeWalletFormula(input: WalletFormulaInput): WalletFormula {
  if (isGroupedFormula(input)) return input;
  validateFlatWalletPercentages(input);
  const operatingTotal = input.RESERVE + input.UTILITIES + input.CENTRAL;
  const qualityTotal = input.ACADEMIC + input.BUDGET + input.PERSONNEL + input.GENERAL;
  return {
    operatingPercent: operatingTotal,
    qualityPercent: qualityTotal,
    operating: {
      RESERVE: operatingTotal === 0 ? 0 : (input.RESERVE / operatingTotal) * 100,
      UTILITIES: operatingTotal === 0 ? 0 : (input.UTILITIES / operatingTotal) * 100,
      CENTRAL: operatingTotal === 0 ? 0 : (input.CENTRAL / operatingTotal) * 100,
    },
    quality: {
      ACADEMIC: qualityTotal === 0 ? 0 : (input.ACADEMIC / qualityTotal) * 100,
      BUDGET: qualityTotal === 0 ? 0 : (input.BUDGET / qualityTotal) * 100,
      PERSONNEL: qualityTotal === 0 ? 0 : (input.PERSONNEL / qualityTotal) * 100,
      GENERAL: qualityTotal === 0 ? 0 : (input.GENERAL / qualityTotal) * 100,
    },
  };
}

export function deriveEffectiveWalletPercentages(input: WalletFormulaInput): WalletPercentages {
  const formula = normalizeWalletFormula(input);
  validateWalletPercentages(formula);
  return {
    RESERVE: (formula.operatingPercent * formula.operating.RESERVE) / 100,
    UTILITIES: (formula.operatingPercent * formula.operating.UTILITIES) / 100,
    CENTRAL: (formula.operatingPercent * formula.operating.CENTRAL) / 100,
    ACADEMIC: (formula.qualityPercent * formula.quality.ACADEMIC) / 100,
    BUDGET: (formula.qualityPercent * formula.quality.BUDGET) / 100,
    PERSONNEL: (formula.qualityPercent * formula.quality.PERSONNEL) / 100,
    GENERAL: (formula.qualityPercent * formula.quality.GENERAL) / 100,
  };
}

function validateFlatWalletPercentages(percentages: WalletPercentages): void {
  const total = FORMULA_WALLET_CODES.reduce(
    (sum, code) => sum + percentages[code],
    0,
  );
  if (FORMULA_WALLET_CODES.some((code) => percentages[code] < 0)) {
    throw new Error("Wallet percentages cannot be negative");
  }
  assertTotal("flat", total);
}

export function validateWalletPercentages(
  input: WalletFormulaInput,
): void {
  if (!isGroupedFormula(input)) {
    validateFlatWalletPercentages(input);
    return;
  }
  const topLevelTotal = input.operatingPercent + input.qualityPercent;
  const operatingTotal = input.operating.RESERVE + input.operating.UTILITIES + input.operating.CENTRAL;
  const qualityTotal = input.quality.ACADEMIC + input.quality.BUDGET + input.quality.PERSONNEL + input.quality.GENERAL;
  const values = [
    input.operatingPercent,
    input.qualityPercent,
    ...Object.values(input.operating),
    ...Object.values(input.quality),
  ];
  if (values.some((value) => value < 0)) {
    throw new Error("Wallet percentages cannot be negative");
  }
  assertTotal("top-level", topLevelTotal);
  assertTotal("operating", operatingTotal);
  assertTotal("quality", qualityTotal);
}

export function calculateWalletAllocations(input: {
  generalSubsidyNet: AmountValue;
  learnerActivityNet: AmountValue;
  schoolIncomeNet: AmountValue;
  formula?: WalletFormulaInput;
  percentages?: WalletFormulaInput;
}): Record<WalletCode, number> {
  const percentages = deriveEffectiveWalletPercentages(input.formula ?? input.percentages ?? DEFAULT_WALLET_FORMULA);

  const baseSatang = toSatang(input.generalSubsidyNet);
  const allocations = {} as Record<FormulaWalletCode, number>;
  let allocatedSatang = 0;

  for (const code of FORMULA_WALLET_CODES) {
    const satang = Math.round((baseSatang * percentages[code]) / 100);
    allocations[code] = satang;
    allocatedSatang += satang;
  }

  allocations.CENTRAL += baseSatang - allocatedSatang;

  return {
    RESERVE: fromSatang(allocations.RESERVE),
    UTILITIES: fromSatang(allocations.UTILITIES),
    CENTRAL: fromSatang(allocations.CENTRAL),
    ACADEMIC: fromSatang(allocations.ACADEMIC),
    BUDGET: fromSatang(allocations.BUDGET),
    PERSONNEL: fromSatang(allocations.PERSONNEL),
    GENERAL: fromSatang(allocations.GENERAL),
    LEARNER_ACTIVITY: fromSatang(toSatang(input.learnerActivityNet)),
    SCHOOL_INCOME: fromSatang(toSatang(input.schoolIncomeNet)),
  };
}

export function calculateWalletAllocationPreview(input: {
  generalSubsidyNet: AmountValue;
  learnerActivityNet: AmountValue;
  schoolIncomeNet: AmountValue;
  formula?: WalletFormulaInput;
  percentages?: WalletFormulaInput;
}): {
  allocations: Record<WalletCode, number> | null;
  error: string | null;
} {
  try {
    return {
      allocations: calculateWalletAllocations(input),
      error: null,
    };
  } catch (cause) {
    return {
      allocations: null,
      error: cause instanceof Error ? cause.message : "Invalid wallet percentages",
    };
  }
}

export function calculateSourceNet(
  entries: Array<{ entryType: SourceEntryType; amount: AmountValue }>,
): number {
  const netSatang = entries.reduce((sum, entry) => {
    const amount = toSatang(entry.amount);
    switch (entry.entryType) {
      case "RECEIPT":
      case "CARRY_FORWARD":
      case "CORRECTION_INCREASE":
        return sum + amount;
      case "DEDUCTION":
      case "RETURN":
      case "CORRECTION_DECREASE":
        return sum - amount;
    }
  }, 0);
  return fromSatang(netSatang);
}

export function calculateWalletBalance(
  entries: Array<{ entryType: WalletLedgerType; amount: AmountValue }>,
) {
  let allocated = 0;
  let committed = 0;
  let netDisbursed = 0;

  for (const entry of entries) {
    const amount = toSatang(entry.amount);
    switch (entry.entryType) {
      case "ALLOCATION":
      case "TRANSFER_IN":
      case "ADJUSTMENT_INCREASE":
        allocated += amount;
        break;
      case "TRANSFER_OUT":
      case "ADJUSTMENT_DECREASE":
        allocated -= amount;
        break;
      case "COMMITMENT":
        committed += amount;
        break;
      case "COMMITMENT_RELEASE":
        committed -= amount;
        break;
      case "DISBURSEMENT":
        netDisbursed += amount;
        break;
      case "REFUND":
        netDisbursed -= amount;
        break;
    }
  }

  return {
    allocated: fromSatang(allocated),
    committed: fromSatang(committed),
    netDisbursed: fromSatang(netDisbursed),
    accountingBalance: fromSatang(allocated - netDisbursed),
    availableBalance: fromSatang(allocated - committed - netDisbursed),
  };
}
