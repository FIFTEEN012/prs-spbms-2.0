export type BudgetTransactionKind =
  | "ALLOCATE"
  | "EXPENSE"
  | "REFUND"
  | "ADJUST";

export type BudgetTransactionSummaryInput = {
  transactionType: BudgetTransactionKind;
  amount: number | string | { toString(): string };
  count?: number;
};

export type ProjectBudgetSummary = {
  approved: number;
  grossSpent: number;
  refunded: number;
  netSpent: number;
  remaining: number;
  expenseCount: number;
  historyCount: number;
};

export function summarizeProjectBudget(
  approvedBudget: number | string | { toString(): string },
  transactions: BudgetTransactionSummaryInput[],
): ProjectBudgetSummary {
  const approved = Number(approvedBudget);
  let grossSpent = 0;
  let refunded = 0;
  let expenseCount = 0;
  let historyCount = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    const count = transaction.count ?? 1;
    historyCount += count;

    if (transaction.transactionType === "EXPENSE") {
      grossSpent += amount;
      expenseCount += count;
    } else if (transaction.transactionType === "REFUND") {
      refunded += amount;
    }
  }

  const netSpent = grossSpent - refunded;

  return {
    approved,
    grossSpent,
    refunded,
    netSpent,
    remaining: approved - netSpent,
    expenseCount,
    historyCount,
  };
}

export function addRunningBalances<
  T extends BudgetTransactionSummaryInput,
>(
  approvedBudget: number | string | { toString(): string },
  transactionsNewestFirst: readonly T[],
): Array<T & { balanceAfter: number }> {
  const summary = summarizeProjectBudget(
    approvedBudget,
    [...transactionsNewestFirst],
  );
  let balance = summary.remaining;

  return transactionsNewestFirst.map((transaction) => {
    const row = { ...transaction, balanceAfter: balance };
    const amount = Number(transaction.amount);

    if (transaction.transactionType === "EXPENSE") {
      balance += amount;
    } else if (transaction.transactionType === "REFUND") {
      balance -= amount;
    }

    return row;
  });
}

export function canApplyBudgetTransaction(
  summary: ProjectBudgetSummary,
  transactionType: BudgetTransactionKind,
  amount: number,
): boolean {
  return transactionType !== "EXPENSE" || amount <= summary.remaining;
}
