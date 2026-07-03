import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

type MockUser = {
  id: string;
  username: string;
  password: string;
  fullName: string;
  email?: string;
  role: Role;
  departmentId?: string | null;
};

const DEV_MOCK_USERS: MockUser[] = [
  {
    id: "mock-super-admin",
    username: "admin",
    password: "password123",
    fullName: "ผู้ดูแลระบบ",
    role: "SUPER_ADMIN",
    departmentId: null,
  },
  {
    id: "mock-executive",
    username: "director",
    password: "password123",
    fullName: "ผู้อำนวยการโรงเรียน",
    role: "EXECUTIVE",
    departmentId: null,
  },
  {
    id: "mock-dept-head",
    username: "depthead",
    password: "password123",
    fullName: "หัวหน้ากลุ่มงานวิชาการ",
    role: "DEPT_HEAD",
    departmentId: "mock-dept-academic",
  },
  {
    id: "mock-teacher",
    username: "teacher1",
    password: "password123",
    fullName: "ครูผู้รับผิดชอบโครงการ",
    role: "TEACHER",
    departmentId: "mock-dept-academic",
  },
  {
    id: "mock-finance",
    username: "finance",
    password: "password123",
    fullName: "เจ้าหน้าที่การเงิน",
    role: "FINANCE",
    departmentId: "mock-dept-finance",
  },
  {
    id: "mock-procurement",
    username: "procurement",
    password: "password123",
    fullName: "เจ้าหน้าที่พัสดุ",
    role: "PROCUREMENT",
    departmentId: "mock-dept-procurement",
  },
  {
    id: "mock-committee",
    username: "committee",
    password: "password123",
    fullName: "กรรมการสถานศึกษา",
    role: "COMMITTEE",
    departmentId: null,
  },
];

function findMockUser(username: string, password: string) {
  if (process.env.NODE_ENV === "production") return null;
  const normalizedUsername = username === "head_academic" ? "depthead" : username;
  return (
    DEV_MOCK_USERS.find(
      (user) => user.username === normalizedUsername && user.password === password,
    ) ?? null
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "ชื่อผู้ใช้", type: "text" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null;
        try {
          const user = await prisma.user.findUnique({
            where: { username: credentials.username },
          });
          if (user && user.isActive) {
            const ok = await bcrypt.compare(
              credentials.password,
              user.passwordHash,
            );
            if (ok) {
              return {
                id: user.id,
                name: user.fullName,
                email: user.email ?? undefined,
                role: user.role,
                departmentId: user.departmentId,
              } as any;
            }
          }
        } catch (error) {
          console.warn("Falling back to development mock auth.", error);
        }

        const mockUser = findMockUser(
          credentials.username,
          credentials.password,
        );
        if (!mockUser) return null;

        let resolvedDeptId = mockUser.departmentId;
        if (mockUser.departmentId) {
          let deptName = "";
          if (mockUser.departmentId === "mock-dept-academic") deptName = "กลุ่มบริหารวิชาการ";
          else if (mockUser.departmentId === "mock-dept-finance" || mockUser.departmentId === "mock-dept-procurement") deptName = "กลุ่มบริหารงบประมาณ";

          if (deptName) {
            const dept = await prisma.department.findUnique({ where: { name: deptName } });
            if (dept) resolvedDeptId = dept.id;
          }
        }

        let resolvedUserId = mockUser.id;
        try {
          let dbUsername = mockUser.username;
          if (dbUsername === "depthead") dbUsername = "head_academic";
          const dbUser = await prisma.user.findUnique({
            where: { username: dbUsername },
          });
          if (dbUser) {
            resolvedUserId = dbUser.id;
          }
        } catch (_) {
          // Ignore
        }

        return {
          id: resolvedUserId,
          name: mockUser.fullName,
          email: mockUser.email,
          role: mockUser.role,
          departmentId: resolvedDeptId,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.departmentId = (user as any).departmentId;
        token.uid = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role;
        (session.user as any).departmentId = token.departmentId;
      }
      return session;
    },
  },
};

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  departmentId?: string | null;
};
