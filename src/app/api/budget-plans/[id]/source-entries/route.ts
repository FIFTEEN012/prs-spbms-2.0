import { BudgetSourceEntryType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addBudgetSourceEntry } from "@/lib/budget-plan-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";

const schema = z.object({
  sourceCode: z.enum(["GENERAL_SUBSIDY", "LEARNER_ACTIVITY", "SCHOOL_INCOME"]),
  entryType: z.nativeEnum(BudgetSourceEntryType),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1),
  documentNo: z.string().trim().optional().nullable(),
  entryDate: z.coerce.date().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const data = schema.parse(await request.json());
    return NextResponse.json(await addBudgetSourceEntry({ ...data, actor, budgetPlanId: id }), { status: 201 });
  } catch (error) {
    return budgetRouteError(error);
  }
}
