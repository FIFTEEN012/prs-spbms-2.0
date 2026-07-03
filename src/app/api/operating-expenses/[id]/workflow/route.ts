import { NextResponse } from "next/server";
import { z } from "zod";
import { transitionOperatingExpense } from "@/lib/budget-action-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";

const schema = z.object({
  action: z.enum(["approve", "reject", "pay", "cancel"]),
  comment: z.string().trim().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const data = schema.parse(await request.json());
    return NextResponse.json(await transitionOperatingExpense({ ...data, actor, expenseId: id }));
  } catch (error) {
    return budgetRouteError(error);
  }
}
