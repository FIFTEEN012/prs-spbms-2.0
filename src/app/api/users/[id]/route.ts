import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

const ROLE_VALUES = [
  "SUPER_ADMIN",
  "EXECUTIVE",
  "DEPT_HEAD",
  "TEACHER",
  "FINANCE",
  "PROCUREMENT",
  "COMMITTEE",
] as const satisfies readonly Role[];

function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_VALUES.includes(value as Role);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
    const { username, password, fullName, email, phone, role, departmentId, isActive } = await req.json();

    if (!username?.trim() || !fullName?.trim() || !role) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" }, { status: 400 });
    }
    if (!isValidRole(role)) {
      return NextResponse.json({ error: "บทบาทผู้ใช้งานไม่ถูกต้อง" }, { status: 400 });
    }

    const normalizedEmail = email?.trim() || null;
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
    }

    const normUsername = username.trim().toLowerCase();

    // Check unique username excluding self
    const existing = await prisma.user.findFirst({
      where: { username: normUsername, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: `ชื่อผู้ใช้ ${username} มีอยู่แล้วในระบบ` }, { status: 400 });
    }

    if (normalizedEmail) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: normalizedEmail, NOT: { id } },
      });
      if (existingEmail) {
        return NextResponse.json({ error: `อีเมล ${normalizedEmail} มีอยู่แล้วในระบบ` }, { status: 400 });
      }
    }

    // Safety checks for self-update
    const isSelf = session.user.id === id;
    if (isSelf) {
      if (role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "ไม่สามารถเปลี่ยนบทบาทของตัวเองได้" }, { status: 400 });
      }
      if (isActive === false) {
        return NextResponse.json({ error: "ไม่สามารถปิดใช้งานบัญชีของตัวเองได้" }, { status: 400 });
      }
    }

    const dataToUpdate: any = {
      username: normUsername,
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      role,
      departmentId: departmentId || null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };

    if (password && password.trim() !== "") {
      dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityName: "User",
        entityId: updated.id,
      },
    });

    const userWithoutPassword = { ...updated } as any;
    delete userWithoutPassword.passwordHash;
    return NextResponse.json(userWithoutPassword);
  } catch (e: any) {
    console.error("Update User Error:", e);
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
    const isSelf = session.user.id === id;
    if (isSelf) {
      return NextResponse.json({ error: "ไม่สามารถลบบัญชีของตัวเองได้" }, { status: 400 });
    }

    // Check project links (e.g. projects where this user is responsible)
    const projectCount = await prisma.project.count({
      where: { responsibleUserId: id },
    });
    if (projectCount > 0) {
      return NextResponse.json({ error: "ไม่สามารถลบผู้ใช้นี้ได้เนื่องจากเป็นผู้รับผิดชอบโครงการที่อยู่ในระบบ" }, { status: 400 });
    }

    const deleted = await prisma.user.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entityName: "User",
        entityId: deleted.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Delete User Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบข้อมูล: " + e.message }, { status: 500 });
  }
}
