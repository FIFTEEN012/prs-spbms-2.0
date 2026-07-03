import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  try {
    const { yearName, startDate, endDate, isActive } = await req.json();
    if (!yearName?.trim()) {
      return NextResponse.json({ error: "กรุณาระบุปีการศึกษา" }, { status: 400 });
    }

    const name = yearName.trim();
    const isAct = Boolean(isActive);

    // Check unique constraint excluding self
    const existing = await prisma.academicYear.findFirst({
      where: { yearName: name, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: `ปีการศึกษา ${name} มีอยู่แล้วในระบบ` }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (isAct) {
        // Set all other years to inactive
        await tx.academicYear.updateMany({
          where: { NOT: { id } },
          data: { isActive: false },
        });
      }

      return tx.academicYear.update({
        where: { id },
        data: {
          yearName: name,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          isActive: isAct,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityName: "AcademicYear",
        entityId: updated.id,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("Update Academic Year Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูล: " + e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  try {
    // Check if projects are linked
    const projectCount = await prisma.project.count({
      where: { academicYearId: id },
    });
    if (projectCount > 0) {
      return NextResponse.json({ error: "ไม่สามารถลบได้เนื่องจากมีโครงการเชื่อมโยงอยู่" }, { status: 400 });
    }

    const deleted = await prisma.academicYear.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entityName: "AcademicYear",
        entityId: deleted.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Delete Academic Year Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบข้อมูล: " + e.message }, { status: 500 });
  }
}
