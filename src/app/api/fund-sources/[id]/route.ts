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
    const { name, budgetAmount } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "กรุณาระบุชื่อแหล่งเงินงบประมาณ" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check unique excluding self
    const existing = await prisma.fundSource.findFirst({
      where: { name: trimmedName, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: `แหล่งเงินงบประมาณ ${trimmedName} มีอยู่แล้วในระบบ` }, { status: 400 });
    }

    const updated = await prisma.fundSource.update({
      where: { id },
      data: {
        name: trimmedName,
        budgetAmount: budgetAmount !== undefined ? Number(budgetAmount) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityName: "FundSource",
        entityId: updated.id,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("Update Fund Source Error:", e);
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
      where: { fundSourceId: id },
    });
    if (projectCount > 0) {
      return NextResponse.json({ error: "ไม่สามารถลบได้เนื่องจากมีโครงการเชื่อมโยงอยู่" }, { status: 400 });
    }

    const deleted = await prisma.fundSource.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entityName: "FundSource",
        entityId: deleted.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Delete Fund Source Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบข้อมูล: " + e.message }, { status: 500 });
  }
}
