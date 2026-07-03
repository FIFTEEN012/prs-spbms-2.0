import "server-only";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { BudgetActor, BudgetDomainError } from "@/lib/budget-plan-service";

export async function getBudgetActor(): Promise<BudgetActor | null> {
  const session = await getServerSession(authOptions);
  return session?.user
    ? {
        id: session.user.id,
        role: session.user.role,
        departmentId: session.user.departmentId,
      }
    : null;
}

export function budgetRouteError(error: unknown) {
  if (error instanceof BudgetDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
}
