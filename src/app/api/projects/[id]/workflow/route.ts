import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canActOnProject } from "@/lib/authorization";
import { BudgetDomainError, withSerializableRetry } from "@/lib/budget-plan-service";
import { calculateWalletBalance } from "@/lib/budget-wallets";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  const { action, comment, budget } = await req.json();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "ไม่พบโครงการ" }, { status: 404 });

  const uid = session.user.id;

  async function log(act: string) {
    await prisma.auditLog.create({
      data: { userId: uid, action: act, entityName: "Project", entityId: project!.id },
    });
  }

  async function notify(userIds: string[], title: string, message: string) {
    if (userIds.length === 0) return;
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, title, message })),
    });
  }

  switch (action) {
    case "submit": {
      if (!canActOnProject(session.user, project, "submit") || project.status !== "DRAFT") {
        return NextResponse.json({ error: "ไม่สามารถส่งได้" }, { status: 400 });
      }
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "SUBMITTED" },
      });
      await log("SUBMIT");
      const heads = await prisma.user.findMany({
        where: { role: "DEPT_HEAD", isActive: true },
        select: { id: true },
      });
      await notify(heads.map((u) => u.id), "มีโครงการรอตรวจสอบ", project.projectName);
      return NextResponse.json({ ok: true });
    }

    case "review_approve": {
      if (!canActOnProject(session.user, project, "dept_approve") || project.status !== "SUBMITTED") {
        return NextResponse.json({ error: "ไม่สามารถตรวจสอบได้" }, { status: 400 });
      }
      await prisma.$transaction([
        prisma.project.update({
          where: { id: project.id },
          data: { status: "REVIEWED" },
        }),
        prisma.approval.create({
          data: {
            projectId: project.id,
            approverId: uid,
            stepOrder: 1,
            status: "APPROVED",
            comment,
            approvedAt: new Date(),
          },
        }),
      ]);
      await log("REVIEW_APPROVE");
      const execs = await prisma.user.findMany({
        where: { role: "EXECUTIVE", isActive: true },
        select: { id: true },
      });
      await notify(execs.map((u) => u.id), "มีโครงการรอผู้บริหารอนุมัติ", project.projectName);
      return NextResponse.json({ ok: true });
    }

    case "approve": {
      if (!canActOnProject(session.user, project, "executive_approve") || project.status !== "REVIEWED") {
        return NextResponse.json({ error: "ไม่สามารถอนุมัติได้" }, { status: 400 });
      }
      try {
        await withSerializableRetry(async (db) => {
          const current = await db.project.findUnique({
            where: { id: project.id },
            include: {
              activities: {
                include: {
                  fundingAllocations: {
                    include: { wallet: { include: { ledgerEntries: true } } },
                  },
                },
              },
            },
          });
          if (!current || current.status !== "REVIEWED") throw new BudgetDomainError("สถานะโครงการถูกเปลี่ยนแล้ว", 409);
          const funding = current.activities.flatMap((activity) => activity.fundingAllocations);
          const approved = funding.length > 0
            ? funding.reduce((sum, allocation) => sum + Number(allocation.requestedAmount), 0)
            : Number(budget ?? current.budgetRequested);
          const remainingByWallet = new Map<string, number>();
          for (const allocation of funding) {
            const available = remainingByWallet.get(allocation.walletId) ?? calculateWalletBalance(allocation.wallet.ledgerEntries).availableBalance;
            const requested = Number(allocation.requestedAmount);
            if (requested > available) throw new BudgetDomainError(`กระเป๋า ${allocation.wallet.name} เหลือพร้อมใช้ ${available.toLocaleString()} บาท`, 400);
            remainingByWallet.set(allocation.walletId, available - requested);
          }
          for (const allocation of funding) {
            await db.activityFundingAllocation.update({ where: { id: allocation.id }, data: { approvedAmount: allocation.requestedAmount } });
            await db.walletLedgerEntry.create({
              data: {
                walletId: allocation.walletId,
                entryType: "COMMITMENT",
                amount: allocation.requestedAmount,
                description: `กันวงเงินโครงการ ${current.projectCode}`,
                referenceType: "PROJECT_ACTIVITY",
                referenceId: allocation.id,
                postedById: uid,
              },
            });
          }
          await db.project.update({ where: { id: current.id }, data: { status: "APPROVED", budgetApproved: approved } });
          await db.approval.create({ data: { projectId: current.id, approverId: uid, stepOrder: 2, status: "APPROVED", comment, approvedAt: new Date() } });
          await db.budgetTransaction.create({ data: { projectId: current.id, transactionType: "ALLOCATE", amount: approved, description: "งบประมาณที่อนุมัติเริ่มต้น" } });
          await db.auditLog.create({ data: { userId: uid, action: "APPROVE", entityName: "Project", entityId: current.id, metadata: { walletCommitments: funding.length, approved } } });
          if (current.responsibleUserId) await db.notification.create({ data: { userId: current.responsibleUserId, title: "โครงการได้รับอนุมัติ", message: current.projectName } });
        });
      } catch (error) {
        if (error instanceof BudgetDomainError) return NextResponse.json({ error: error.message }, { status: error.status });
        throw error;
      }
      return NextResponse.json({ ok: true });
    }

    case "reject": {
      if (!canActOnProject(session.user, project, "reject_to_draft")) {
        return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
      }
      await prisma.$transaction([
        prisma.project.update({
          where: { id: project.id },
          data: { status: "REJECTED" },
        }),
        prisma.approval.create({
          data: {
            projectId: project.id,
            approverId: uid,
            stepOrder: project.status === "SUBMITTED" ? 1 : 2,
            status: "REJECTED",
            comment,
            approvedAt: new Date(),
          },
        }),
      ]);
      await log("REJECT");
      if (project.responsibleUserId) {
        await notify([project.responsibleUserId], "โครงการถูกตีกลับ", project.projectName);
      }
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "ไม่รู้จัก action" }, { status: 400 });
}
