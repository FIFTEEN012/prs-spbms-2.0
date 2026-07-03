import {
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  LayoutDashboard,
  PiggyBank,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

export const APP_NAV = [
  { href: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/projects", label: "โครงการ", icon: FolderKanban },
  { href: "/approvals", label: "งานอนุมัติ", icon: CheckCircle2 },
  { href: "/budget", label: "งบประมาณ", icon: Wallet },
  { href: "/budget-allocation", label: "จัดสรรงบประจำปี", icon: PiggyBank },
  { href: "/procurement", label: "พัสดุ/จัดซื้อ", icon: ShoppingCart },
  { href: "/academic-years", label: "ปีการศึกษา", icon: CalendarDays },
  { href: "/users", label: "ผู้ใช้งาน", icon: Users },
] as const;

export function getPageTitle(pathname: string) {
  const matched = APP_NAV.find((item) => pathname.startsWith(item.href));
  return matched?.label ?? "PRS SPBMS";
}
