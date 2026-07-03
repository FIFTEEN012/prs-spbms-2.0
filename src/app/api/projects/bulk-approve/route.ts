import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canActOnProject } from "@/lib/authorization";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });
  }

  try {
    const { projectIds } = await req.json();
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: "ไม่พบรายการโครงการที่เลือก" }, { status: 400 });
    }

    const uid = session.user.id;

    // Fetch all specified projects
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
    });

    if (projects.length === 0) {
      return NextResponse.json({ error: "ไม่พบโครงการที่สามารถดำเนินการได้" }, { status: 400 });
    }

    let approvedCount = 0;

    // Run bulk approvals in a transaction with timeout options
    await prisma.$transaction(async (tx) => {
      // Fetch user lists for notifications
      const execs = await tx.user.findMany({
        where: { role: "EXECUTIVE", isActive: true },
        select: { id: true },
      });
      const execUserIds = execs.map((u) => u.id);

      for (const project of projects) {
        // Case 1: DEPT_HEAD / SUPER_ADMIN reviewing a SUBMITTED project
        if (project.status === "SUBMITTED" && canActOnProject(session.user, project, "dept_approve")) {
          // Update status
          await tx.project.update({
            where: { id: project.id },
            data: { status: "REVIEWED" },
          });

          // Create approval step
          await tx.approval.create({
            data: {
              projectId: project.id,
              approverId: uid,
              stepOrder: 1,
              status: "APPROVED",
              comment: "อนุมัติทั้งหมด (Bulk Approved)",
              approvedAt: new Date(),
            },
          });

          // Audit log
          await tx.auditLog.create({
            data: {
              userId: uid,
              action: "REVIEW_APPROVE",
              entityName: "Project",
              entityId: project.id,
              metadata: { bulk: true },
            },
          });

          // Notify executives
          if (execUserIds.length > 0) {
            await tx.notification.createMany({
              data: execUserIds.map((userId) => ({
                userId,
                title: "มีโครงการรอผู้บริหารอนุมัติ (กลุ่ม)",
                message: project.projectName,
              })),
            });
          }

          approvedCount++;
        }
        // Case 2: EXECUTIVE / SUPER_ADMIN approving a REVIEWED project
        else if (project.status === "REVIEWED" && canActOnProject(session.user, project, "executive_approve")) {
          const approved = Number(project.budgetRequested);

          // Update status and budgetApproved
          await tx.project.update({
            where: { id: project.id },
            data: { status: "APPROVED", budgetApproved: approved },
          });

          // Create approval step
          await tx.approval.create({
            data: {
              projectId: project.id,
              approverId: uid,
              stepOrder: 2,
              status: "APPROVED",
              comment: "อนุมัติทั้งหมด (Bulk Approved)",
              approvedAt: new Date(),
            },
          });

          // Create budget allocation transaction
          await tx.budgetTransaction.create({
            data: {
              projectId: project.id,
              transactionType: "ALLOCATE",
              amount: approved,
              description: "งบประมาณที่อนุมัติเริ่มต้น (อนุมัติกลุ่ม)",
            },
          });

          // Audit log
          await tx.auditLog.create({
            data: {
              userId: uid,
              action: "APPROVE",
              entityName: "Project",
              entityId: project.id,
              metadata: { bulk: true },
            },
          });

          // Notify responsible user
          if (project.responsibleUserId) {
            await tx.notification.create({
              data: {
                userId: project.responsibleUserId,
                title: "โครงการได้รับอนุมัติ (กลุ่ม)",
                message: project.projectName,
              },
            });
          }

          approvedCount++;
        }
      }
    }, {
      maxWait: 30000,
      timeout: 30000,
    });

    return NextResponse.json({ success: true, count: approvedCount });
  } catch (e: any) {
    console.error("Bulk Approval Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในระบบ: " + e.message }, { status: 500 });
  }
}
