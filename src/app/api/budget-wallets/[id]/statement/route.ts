import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateWalletBalance } from "@/lib/budget-wallets";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";
import { canViewBudgetWallet } from "@/lib/authorization";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const wallet = await prisma.budgetWallet.findUnique({
      where: { id },
      include: {
        ledgerEntries: { include: { postedBy: { select: { fullName: true } } }, orderBy: { postedAt: "desc" } },
        fundingAllocations: { include: { activity: { include: { project: true } } } },
      },
    });
    if (!wallet) return NextResponse.json({ error: "ไม่พบกระเป๋า" }, { status: 404 });
    if (!canViewBudgetWallet(actor, wallet)) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    return NextResponse.json({
      ...wallet,
      balance: calculateWalletBalance(wallet.ledgerEntries),
    });
  } catch (error) {
    return budgetRouteError(error);
  }
}
