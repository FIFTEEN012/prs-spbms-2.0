export type LedgerType =
  | "ALLOCATION"
  | "COMMITMENT"
  | "COMMITMENT_RELEASE"
  | "DISBURSEMENT"
  | "REFUND"
  | "ADJUSTMENT_INCREASE"
  | "ADJUSTMENT_DECREASE";

export type BalanceEntry = { type: LedgerType; amount: number };

export type ProjectBalance = {
  allocated: number;
  committed: number;
  disbursed: number;
  available: number;
};

export function calculateFundBalance(budgetAmount: number, entries: BalanceEntry[]): number {
  const allocated = entries.reduce((sum, entry) => {
    if (entry.type === "ALLOCATION" || entry.type === "ADJUSTMENT_INCREASE") return sum + entry.amount;
    if (entry.type === "ADJUSTMENT_DECREASE") return sum - entry.amount;
    return sum;
  }, 0);
  return budgetAmount - allocated;
}

export function calculateProjectBalance(entries: BalanceEntry[]): ProjectBalance {
  let allocated = 0;
  let committed = 0;
  let disbursed = 0;
  for (const entry of entries) {
    switch (entry.type) {
      case "ALLOCATION":
      case "ADJUSTMENT_INCREASE":
        allocated += entry.amount;
        break;
      case "ADJUSTMENT_DECREASE":
        allocated -= entry.amount;
        break;
      case "COMMITMENT":
        committed += entry.amount;
        break;
      case "COMMITMENT_RELEASE":
        committed -= entry.amount;
        break;
      case "DISBURSEMENT":
        disbursed += entry.amount;
        break;
      case "REFUND":
        disbursed -= entry.amount;
        break;
    }
  }
  return { allocated, committed, disbursed, available: allocated - committed - disbursed };
}
