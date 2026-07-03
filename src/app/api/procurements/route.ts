import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  const { projectId, itemName, quantity, unitPrice } = await req.json();
  const q = Number(quantity);
  const pPrice = Number(unitPrice);

  if (!projectId || !itemName?.trim() || isNaN(q) || q <= 0 || isNaN(pPrice) || pPrice <= 0) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) return NextResponse.json({ error: "ไม่พบโครงการ" }, { status: 404 });

  const role = session.user.role;
  const isDeptStaff =
    session.user.departmentId &&
    session.user.departmentId === project.departmentId &&
    (role === "TEACHER" || role === "DEPT_HEAD");

  if (!can(role, "procurement.record") && !isDeptStaff) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const item = await prisma.procurement.create({
    data: {
      projectId,
      itemName: itemName.trim(),
      quantity: q,
      unitPrice: pPrice,
      totalPrice: q * pPrice,
      status: "REQUESTED",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: "PROCUREMENT_RECORD",
      entityName: "Procurement",
      entityId: item.id,
    },
  });

  return NextResponse.json(item);
}
