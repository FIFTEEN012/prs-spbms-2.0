import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProject } from "@/lib/authorization";

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

    // Filter projects that the user has permission to delete (using edit permission as rule)
    const allowedProjects = projects.filter((project) => {
      if (session.user.role === "SUPER_ADMIN") return true;
      // Teachers and Department Heads can only delete DRAFT projects that belong to their department/responsibility
      return canEditProject(session.user, project);
    });

    if (allowedProjects.length === 0) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์ลบโครงการที่เลือกทั้งหมด" }, { status: 403 });
    }

    const allowedIds = allowedProjects.map((p) => p.id);

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete the projects (cascading relations are handled by DB schema onDelete: Cascade)
      await tx.project.deleteMany({
        where: { id: { in: allowedIds } },
      });

      // Log audit records
      for (const p of allowedProjects) {
        await tx.auditLog.create({
          data: {
            userId: uid,
            action: "DELETE",
            entityName: "Project",
            entityId: p.id,
            metadata: { bulk: true, projectCode: p.projectCode, projectName: p.projectName },
          },
        });
      }
    }, {
      maxWait: 30000,
      timeout: 30000,
    });

    return NextResponse.json({ success: true, count: allowedIds.length });
  } catch (e: any) {
    console.error("Bulk Delete Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในระบบ: " + e.message }, { status: 500 });
  }
}
