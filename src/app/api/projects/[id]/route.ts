import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProject } from "@/lib/authorization";

const nullableId = (v: any) => (v && v !== "" ? v : null);

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  
  const existingProject = await prisma.project.findUnique({ where: { id } });
  if (!existingProject) {
    return NextResponse.json({ error: "ไม่พบโครงการ" }, { status: 404 });
  }

  if (!session?.user || !canEditProject(session.user, existingProject)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const d = await req.json();
  const project = await prisma.$transaction(async (db) => {
    const activities = Array.isArray(d.activities) ? d.activities : null;
    const walletIds = activities ? [...new Set(activities.flatMap((activity: any) => activity.fundingAllocations.map((funding: any) => funding.walletId)))] as string[] : [];
    const wallets = walletIds.length ? await db.budgetWallet.findMany({ where: { id: { in: walletIds }, budgetPlan: { academicYearId: existingProject.academicYearId, status: "LOCKED" } } }) : [];
    if (wallets.length !== walletIds.length) throw new Error("กระเป๋าไม่อยู่ในแผนที่ล็อกของปีการศึกษานี้");
    if (session.user.role !== "SUPER_ADMIN" && wallets.some((wallet) => wallet.departmentId && wallet.departmentId !== nullableId(d.departmentId))) throw new Error("ไม่สามารถใช้กระเป๋าของกลุ่มบริหารอื่น");
    const fundingTotal = activities?.reduce((sum: number, activity: any) => sum + activity.fundingAllocations.reduce((lineSum: number, funding: any) => lineSum + Number(funding.amount), 0), 0) ?? 0;
    const updated = await db.project.update({
      where: { id },
      data: {
      projectCode: d.projectCode,
      projectName: d.projectName,
      strategyId: nullableId(d.strategyId),
      departmentId: nullableId(d.departmentId),
      fundSourceId: nullableId(d.fundSourceId),
      responsibleUserId: nullableId(d.responsibleUserId),
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
      },
    });
    if (activities) {
      await db.projectActivity.deleteMany({ where: { projectId: id } });
      for (const activity of activities) {
        const createdActivity = await db.projectActivity.create({ data: { projectId: id, name: activity.name, budget: activity.fundingAllocations.reduce((sum: number, funding: any) => sum + Number(funding.amount), 0) } });
        await db.activityFundingAllocation.createMany({ data: activity.fundingAllocations.map((funding: any) => ({ activityId: createdActivity.id, walletId: funding.walletId, requestedAmount: Number(funding.amount) })) });
      }
    }
    await db.auditLog.create({ data: { userId: session.user.id, action: "UPDATE", entityName: "Project", entityId: id, metadata: { fundingTotal } } });
    return updated;
  });
  return NextResponse.json(project);
}
