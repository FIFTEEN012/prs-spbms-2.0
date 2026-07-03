import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmLegacyBudgetMigration } from "@/lib/budget-migration-service";
import { budgetRouteError, getBudgetActor } from "@/lib/budget-route-utils";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getBudgetActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const { reason, mappings, covers } = z.object({
      reason: z.string().trim().min(1),
      mappings: z.record(z.string(), z.string()).optional(),
      covers: z.record(z.string(), z.string()).optional(),
    }).parse(await request.json());
    return NextResponse.json(await confirmLegacyBudgetMigration({
      actor,
      migrationRunId: id,
      reason,
      mappings: mappings as any,
      covers: covers as any,
    }));
  } catch (error) {
    return budgetRouteError(error);
  }
}
