import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
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

    // Check unique constraint
    const existing = await prisma.academicYear.findUnique({
      where: { yearName: name },
    });
    if (existing) {
      return NextResponse.json({ error: `ปีการศึกษา ${name} มีอยู่แล้วในระบบ` }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      if (isAct) {
        // Set all other years to inactive
        await tx.academicYear.updateMany({
          data: { isActive: false },
        });
      }

      return tx.academicYear.create({
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
        action: "CREATE",
        entityName: "AcademicYear",
        entityId: created.id,
      },
    });

    return NextResponse.json(created);
  } catch (e: any) {
    console.error("Create Academic Year Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + e.message }, { status: 500 });
  }
}
