import { NextResponse } from "next/server";
import { z } from "zod";
import { updateBudgetPlanPercentages } from "@/lib/budget-plan-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";
import { validateWalletPercentages } from "@/lib/budget-wallets";

const walletCodes = ["RESERVE", "UTILITIES", "CENTRAL", "ACADEMIC", "BUDGET", "PERSONNEL", "GENERAL"] as const;
const percentagesSchema = z.object(Object.fromEntries(walletCodes.map((code) => [code, z.coerce.number().min(0).max(100)])) as Record<(typeof walletCodes)[number], z.ZodNumber>);
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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const body = z.object({
      formula: groupedFormulaSchema.optional(),
      percentages: percentagesSchema.optional(),
    }).parse(await request.json());
    const formula = body.formula ?? body.percentages;
    if (!formula) return NextResponse.json({ error: "กรุณาระบุสูตรจัดสรร" }, { status: 400 });
    try {
      validateWalletPercentages(formula);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "สูตรจัดสรรไม่ถูกต้อง" }, { status: 400 });
    }
    return NextResponse.json(await updateBudgetPlanPercentages({ actor, budgetPlanId: id, formula }));
  } catch (error) {
    return budgetRouteError(error);
  }
}
