import { BudgetSourceEntryType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteBudgetSourceEntry,
  updateBudgetSourceEntry,
} from "@/lib/budget-plan-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";

const schema = z.object({
  entryType: z.nativeEnum(BudgetSourceEntryType),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1),
  documentNo: z.string().trim().optional().nullable(),
  entryDate: z.coerce.date().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id, entryId } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "ข้อมูลรายการแหล่งเงินไม่ถูกต้อง" }, { status: 400 });
    }
    return NextResponse.json(
      await updateBudgetSourceEntry({
        ...parsed.data,
        actor,
        budgetPlanId: id,
        entryId,
      }),
    );
  } catch (error) {
    return budgetRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id, entryId } = await params;
    return NextResponse.json(
      await deleteBudgetSourceEntry({
        actor,
        budgetPlanId: id,
        entryId,
      }),
    );
  } catch (error) {
    return budgetRouteError(error);
  }
}
