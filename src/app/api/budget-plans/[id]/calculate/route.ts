import { NextResponse } from "next/server";
import { calculateBudgetPlanPreview } from "@/lib/budget-plan-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const preview = await calculateBudgetPlanPreview(id);
    return NextResponse.json({
      sourceNets: preview.sourceNets,
      allocations: preview.allocations,
      grandTotal: preview.grandTotal,
    });
  } catch (error) {
    return budgetRouteError(error);
  }
}
