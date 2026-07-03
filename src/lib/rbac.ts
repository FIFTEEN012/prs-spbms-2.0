import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  DEPT_HEAD: "หัวหน้ากลุ่มงาน",
  TEACHER: "ครูผู้รับผิดชอบโครงการ",
  FINANCE: "เจ้าหน้าที่การเงิน",
  PROCUREMENT: "เจ้าหน้าที่พัสดุ",
  COMMITTEE: "คณะกรรมการสถานศึกษา",
};

const ABILITY: Record<string, Role[]> = {
  "project.create": ["SUPER_ADMIN", "TEACHER", "DEPT_HEAD"],
  "project.edit": ["SUPER_ADMIN", "TEACHER", "DEPT_HEAD"],
  "project.submit": ["SUPER_ADMIN", "TEACHER", "DEPT_HEAD"],
  "project.review": ["SUPER_ADMIN", "DEPT_HEAD"],
  "project.approve": ["SUPER_ADMIN", "EXECUTIVE"],
  "project.finance_review": ["SUPER_ADMIN", "FINANCE"],
  "budget.record": ["SUPER_ADMIN", "FINANCE"],
  "procurement.record": ["SUPER_ADMIN", "PROCUREMENT"],
  "academic_year.manage": ["SUPER_ADMIN"],
  "users.manage": ["SUPER_ADMIN"],
  "dashboard.view": [
    "SUPER_ADMIN",
    "EXECUTIVE",
    "DEPT_HEAD",
    "TEACHER",
    "FINANCE",
    "PROCUREMENT",
    "COMMITTEE",
  ],
};

export function can(role: Role | undefined | null, ability: string): boolean {
  if (!role) return false;
  return (ABILITY[ability] ?? []).includes(role);
}
