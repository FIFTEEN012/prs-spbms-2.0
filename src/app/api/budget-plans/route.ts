import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createBudgetPlan } from "@/lib/budget-plan-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";
import { DEFAULT_WALLET_FORMULA, validateWalletPercentages } from "@/lib/budget-wallets";

const groupedFormulaSchema = z.object({
  operatingPercent: z.coerce.number().min(0).max(100),
  qualityPercent: z.coerce.number().min(0).max(100),
  operating: z.object({
    RESERVE: z.coerce.number().min(0).max(100),
    UTILITIES: z.coerce.number().min(0).max(100),
    CENTRAL: z.coerce.number().min(0).max(100),
  }),
  quality: z.object({
    ACADEMIC: z.coerce.number().min(0).max(100),
    BUDGET: z.coerce.number().min(0).max(100),
    PERSONNEL: z.coerce.number().min(0).max(100),
    GENERAL: z.coerce.number().min(0).max(100),
  }),
});

const schema = z.object({
  academicYearId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  name: z.string().trim().min(1),
  formula: groupedFormulaSchema.optional(),
  percentages: z.record(z.number()).optional(),
});

export async function GET() {
  const actor = await getBudgetActor();
  if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const plans = await prisma.budgetPlan.findMany({
    include: { academicYear: true, fiscalYear: true, _count: { select: { wallets: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(plans);
}

export async function POST(request: Request) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const data = schema.parse(await request.json());
    const formula = data.formula ?? DEFAULT_WALLET_FORMULA;
    validateWalletPercentages(formula);
    const plan = await createBudgetPlan({ actor, academicYearId: data.academicYearId, fiscalYearId: data.fiscalYearId, name: data.name, formula });
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return budgetRouteError(error);
  }
}
