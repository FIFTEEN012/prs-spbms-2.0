import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateWalletBalance } from "@/lib/budget-wallets";
import { canViewBudgetWallet } from "@/lib/authorization";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";
import type { WalletLedgerEntryType } from "@prisma/client";

export async function GET() {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const plan = await prisma.budgetPlan.findFirst({
      where: { status: "LOCKED" },
      include: {
        academicYear: true,
        fiscalYear: true,
        wallets: {
          include: { ledgerEntries: true },
          orderBy: { code: "asc" },
        },
      },
      orderBy: [{ lockedAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (!plan) {
      return NextResponse.json({
        plan: null,
        updatedAt: new Date().toISOString(),
        wallets: [],
      });
    }

    const wallets = plan.wallets
      .filter((wallet) => canViewBudgetWallet(actor, wallet))
      .map((wallet) => {
        const balance = calculateWalletBalance(
          wallet.ledgerEntries.map((entry) => ({
            entryType: entry.entryType as WalletLedgerEntryType,
            amount: entry.amount,
          })),
        );

        return {
          id: wallet.id,
          code: wallet.code,
          name: wallet.name,
          percentage: wallet.percentage == null ? null : Number(wallet.percentage),
          spendMode: wallet.spendMode,
          balance,
        };
      });

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        status: plan.status,
        academicYearName: plan.academicYear.yearName,
        fiscalYearName: plan.fiscalYear.yearName,
      },
      updatedAt: new Date().toISOString(),
      wallets,
    });
  } catch (error) {
    return budgetRouteError(error);
  }
}
