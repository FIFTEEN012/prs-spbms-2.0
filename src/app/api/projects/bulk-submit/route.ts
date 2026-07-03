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

    let submittedCount = 0;

    // Run bulk submissions in a transaction with timeout options
    await prisma.$transaction(async (tx) => {
      // Fetch DEPT_HEAD list for notifications
      const heads = await tx.user.findMany({
        where: { role: "DEPT_HEAD", isActive: true },
        select: { id: true },
      });
      const headUserIds = heads.map((u) => u.id);

      for (const project of projects) {
        if (project.status === "DRAFT" && canActOnProject(session.user, project, "submit")) {
          // Update status
          await tx.project.update({
            where: { id: project.id },
            data: { status: "SUBMITTED" },
          });

          // Audit log
          await tx.auditLog.create({
            data: {
              userId: uid,
              action: "SUBMIT",
              entityName: "Project",
              entityId: project.id,
              metadata: { bulk: true },
            },
          });

          // Notify heads
          if (headUserIds.length > 0) {
            await tx.notification.createMany({
              data: headUserIds.map((userId) => ({
                userId,
                title: "มีโครงการรอตรวจสอบ (กลุ่ม)",
                message: project.projectName,
              })),
            });
          }

          submittedCount++;
        }
      }
    }, {
      maxWait: 30000,
      timeout: 30000,
    });

    return NextResponse.json({ success: true, count: submittedCount });
  } catch (e: any) {
    console.error("Bulk Submit Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในระบบ: " + e.message }, { status: 500 });
  }
}
