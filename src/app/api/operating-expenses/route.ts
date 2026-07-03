import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOperatingExpense } from "@/lib/budget-action-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";

const schema = z.object({
  budgetPlanId: z.string().min(1),
  walletId: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1),
  documentNo: z.string().trim().optional().nullable(),
});

export async function GET(request: Request) {
  const actor = await getBudgetActor();
  if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const planId = new URL(request.url).searchParams.get("budgetPlanId") ?? undefined;
  return NextResponse.json(await prisma.operatingExpense.findMany({
    where: planId ? { budgetPlanId: planId } : undefined,
    include: { wallet: true, createdBy: { select: { fullName: true } }, approver: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  }));
}

export async function POST(request: Request) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const data = schema.parse(await request.json());
    return NextResponse.json(await createOperatingExpense({ ...data, actor }), { status: 201 });
  } catch (error) {
    return budgetRouteError(error);
  }
}
