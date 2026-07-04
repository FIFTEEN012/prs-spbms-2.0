import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getUserList } from "@/lib/user-list-service";
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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const result = await getUserList(new URL(req.url).searchParams);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  try {
    const { username, password, fullName, email, phone, role, departmentId, isActive } = await req.json();

    if (!username?.trim() || !password?.trim() || !fullName?.trim() || !role) {
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

    // Check unique username
    const existing = await prisma.user.findUnique({
      where: { username: normUsername },
    });
    if (existing) {
      return NextResponse.json({ error: `ชื่อผู้ใช้ ${username} มีอยู่แล้วในระบบ` }, { status: 400 });
    }

    if (normalizedEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingEmail) {
        return NextResponse.json({ error: `อีเมล ${normalizedEmail} มีอยู่แล้วในระบบ` }, { status: 400 });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        username: normUsername,
        passwordHash,
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        role,
        departmentId: departmentId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityName: "User",
        entityId: created.id,
      },
    });

    // Don't return password hash
    const userWithoutPassword = { ...created } as any;
    delete userWithoutPassword.passwordHash;
    return NextResponse.json(userWithoutPassword);
  } catch (e: any) {
    console.error("Create User Error:", e);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + e.message }, { status: 500 });
  }
}
