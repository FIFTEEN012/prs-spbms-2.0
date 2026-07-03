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
    const { name, budgetAmount } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "กรุณาระบุชื่อแหล่งเงินงบประมาณ" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check unique
    const existing = await prisma.fundSource.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      return NextResponse.json({ error: `แหล่งเงินงบประมาณ ${trimmedName} มีอยู่แล้วในระบบ` }, { status: 400 });
    }

    const created = await prisma.fundSource.create({
      data: {
        name: trimmedName,
        budgetAmount: budgetAmount ? Number(budgetAmount) : 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityName: "FundSource",
        entityId: created.id,
      },
    });

    return NextResponse.json(created);
  } catch (e: any) {
    console.error("Create Fund Source Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + e.message }, { status: 500 });
  }
}
