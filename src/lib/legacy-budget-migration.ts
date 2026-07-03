import { WalletCode } from "@/lib/budget-wallets";

const DEPARTMENT_WALLETS: Record<string, WalletCode> = {
  "กลุ่มบริหารวิชาการ": "ACADEMIC",
  "กลุ่มบริหารงบประมาณ": "BUDGET",
  "กลุ่มบริหารงานบุคคล": "PERSONNEL",
  "กลุ่มบริหารทั่วไป": "GENERAL",
};

export function resolveLegacyWalletCode(
  sourceCode: string | null | undefined,
  departmentName: string | null | undefined,
): WalletCode | null {
  if (sourceCode === "LEARNER_ACTIVITY") return "LEARNER_ACTIVITY";
  if (sourceCode === "SCHOOL_INCOME") return "SCHOOL_INCOME";
  if (sourceCode !== "GENERAL_SUBSIDY") return null;
  return departmentName ? DEPARTMENT_WALLETS[departmentName] ?? null : null;
}
