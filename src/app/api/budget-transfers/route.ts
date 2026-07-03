import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createBudgetTransfer } from "@/lib/budget-action-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";

const schema = z.object({
  budgetPlanId: z.string().min(1),
  fromWalletId: z.string().min(1),
  toWalletId: z.string().min(1),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(1),
});

export async function GET(request: Request) {
  const actor = await getBudgetActor();
  if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const planId = new URL(request.url).searchParams.get("budgetPlanId") ?? undefined;
  return NextResponse.json(await prisma.budgetTransferRequest.findMany({
    where: planId ? { budgetPlanId: planId } : undefined,
    include: { fromWallet: true, toWallet: true, createdBy: { select: { fullName: true } }, approver: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  }));
}

export async function POST(request: Request) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const data = schema.parse(await request.json());
    return NextResponse.json(await createBudgetTransfer({ ...data, actor }), { status: 201 });
  } catch (error) {
    return budgetRouteError(error);
  }
}
