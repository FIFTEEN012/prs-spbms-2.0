import { NextResponse } from "next/server";
import { z } from "zod";
import { buildLegacyBudgetMigrationPreview } from "@/lib/budget-migration-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";

export async function POST(request: Request) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { budgetPlanId } = z.object({ budgetPlanId: z.string().min(1) }).parse(await request.json());
    return NextResponse.json(await buildLegacyBudgetMigrationPreview({ actor, budgetPlanId }));
  } catch (error) {
    return budgetRouteError(error);
  }
}
