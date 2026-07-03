import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { z } from "zod";
import { getProjectList } from "@/lib/project-list-service";

const ProjectSchema = z.object({
  academicYearId: z.string().min(1),
  projectCode: z.string().min(1),
  projectName: z.string().min(1),
  strategyId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  fundSourceId: z.string().optional().nullable(),
  responsibleUserId: z.string().optional().nullable(),
  rationale: z.string().optional(),
  objectives: z.string().optional(),
  quantitativeTarget: z.string().optional(),
  qualitativeTarget: z.string().optional(),
  indicators: z.string().optional(),
  method: z.string().optional(),
  expectedOutcome: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetRequested: z.union([z.string(), z.number()]).optional(),
  activities: z.array(z.object({
    name: z.string().trim().min(1),
    fundingAllocations: z.array(z.object({
      walletId: z.string().min(1),
      amount: z.coerce.number().positive(),
    })).min(1),
  })).optional(),
});

const nullableId = (v: any) => (v && v !== "" ? v : null);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const result = await getProjectList(session.user, new URL(req.url).searchParams);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user?.role, "project.create")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = ProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const d = parsed.data;

  // Enforce department restriction for non-admins
  const targetDeptId = nullableId(d.departmentId);
  if (session?.user?.role !== "SUPER_ADMIN") {
    if (targetDeptId !== session?.user?.departmentId) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์สร้างโครงการในฝ่ายอื่น" }, { status: 403 });
    }
  }

  try {
    const project = await prisma.$transaction(async (db) => {
      const walletIds = [...new Set((d.activities ?? []).flatMap((activity) => activity.fundingAllocations.map((funding) => funding.walletId)))];
      const wallets = walletIds.length ? await db.budgetWallet.findMany({
        where: { id: { in: walletIds }, budgetPlan: { academicYearId: d.academicYearId, status: "LOCKED" } },
      }) : [];
      if (wallets.length !== walletIds.length) throw new Error("INVALID_WALLET");
      if (session?.user?.role !== "SUPER_ADMIN" && wallets.some((wallet) => wallet.departmentId && wallet.departmentId !== targetDeptId)) {
        throw new Error("WALLET_DEPARTMENT_MISMATCH");
      }
      const fundingTotal = (d.activities ?? []).reduce((sum, activity) => sum + activity.fundingAllocations.reduce((lineSum, funding) => lineSum + funding.amount, 0), 0);
      const created = await db.project.create({
        data: {
        academicYearId: d.academicYearId,
        projectCode: d.projectCode,
        projectName: d.projectName,
        strategyId: nullableId(d.strategyId),
        departmentId: nullableId(d.departmentId),
        fundSourceId: nullableId(d.fundSourceId),
        responsibleUserId: nullableId(d.responsibleUserId) ?? session!.user.id,
        rationale: d.rationale,
        objectives: d.objectives,
        quantitativeTarget: d.quantitativeTarget,
        qualitativeTarget: d.qualitativeTarget,
        indicators: d.indicators,
        method: d.method,
        expectedOutcome: d.expectedOutcome,
        startDate: d.startDate ? new Date(d.startDate) : null,
        endDate: d.endDate ? new Date(d.endDate) : null,
        budgetRequested: fundingTotal > 0 ? fundingTotal : d.budgetRequested ? Number(d.budgetRequested) : 0,
        status: "DRAFT",
        },
      });
      for (const activity of d.activities ?? []) {
        const createdActivity = await db.projectActivity.create({ data: { projectId: created.id, name: activity.name, budget: activity.fundingAllocations.reduce((sum, funding) => sum + funding.amount, 0) } });
        await db.activityFundingAllocation.createMany({ data: activity.fundingAllocations.map((funding) => ({ activityId: createdActivity.id, walletId: funding.walletId, requestedAmount: funding.amount })) });
      }
      await db.auditLog.create({
        data: {
          userId: session!.user.id,
          action: "CREATE",
          entityName: "Project",
          entityId: created.id,
          metadata: { fundingTotal },
        },
      });
      return created;
    });
    return NextResponse.json(project);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "รหัสโครงการนี้มีอยู่แล้ว" }, { status: 400 });
    }
    if (e.message === "INVALID_WALLET") return NextResponse.json({ error: "กระเป๋าไม่อยู่ในแผนที่ล็อกของปีการศึกษานี้" }, { status: 400 });
    if (e.message === "WALLET_DEPARTMENT_MISMATCH") return NextResponse.json({ error: "ไม่สามารถใช้กระเป๋าของกลุ่มบริหารอื่น" }, { status: 403 });
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
