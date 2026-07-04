"use client";

import { useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Eye,
  FileClock,
  FolderKanban,
  Landmark,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserRoundCheck,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { cn, formatThaiDate } from "@/lib/utils";
import {
  defaultUserListQueryValues,
  type UserListQueryValues,
  type UserListRow,
  type UserListSummary,
} from "@/lib/user-list-service";
import { useListControls } from "@/lib/use-list-controls";
import type { Role } from "@prisma/client";

type DepartmentType = {
  id: string;
  name: string;
};

interface UsersClientProps {
  initialUsers: UserListRow[];
  departments: DepartmentType[];
  currentUserId: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  initialQuery: UserListQueryValues;
  summary: UserListSummary;
}

type UserFormState = {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  departmentId: string;
  isActive: boolean;
};

type SavePayload = {
  username: string;
  password?: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  departmentId: string | null;
  isActive: boolean;
};

type ConfirmAction =
  | { type: "save"; payload: SavePayload; title: string; description: string; changes: string[] }
  | { type: "status"; target: UserListRow; payload: SavePayload; title: string; description: string; changes: string[] }
  | { type: "delete"; target: UserListRow };

const ROLE_VALUES = [
  "SUPER_ADMIN",
  "EXECUTIVE",
  "DEPT_HEAD",
  "TEACHER",
  "FINANCE",
  "PROCUREMENT",
  "COMMITTEE",
] as const satisfies readonly Role[];

const DEPARTMENT_REQUIRED_ROLES = new Set<Role>(["TEACHER", "DEPT_HEAD"]);

const ROLE_META: Record<
  Role,
  {
    label: string;
    badgeClassName: string;
    icon: ComponentType<{ className?: string }>;
    permissions: string[];
  }
> = {
  SUPER_ADMIN: {
    label: "ผู้ดูแลระบบ",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-800",
    icon: Shield,
    permissions: [
      "จัดการผู้ใช้งานและสิทธิ์",
      "จัดการปีการศึกษาและข้อมูลอ้างอิง",
      "ดูและจัดการโครงการทั้งหมด",
      "ดูงบประมาณและพัสดุทั้งหมด",
    ],
  },
  EXECUTIVE: {
    label: "ผู้บริหาร",
    badgeClassName: "border-blue-200 bg-blue-100 text-blue-800",
    icon: Landmark,
    permissions: [
      "อนุมัติโครงการ",
      "อนุมัติแผนจัดสรรงบ",
      "อนุมัติคำขอจัดซื้อ",
      "ดูภาพรวมงบประมาณ",
    ],
  },
  DEPT_HEAD: {
    label: "หัวหน้ากลุ่ม",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
    icon: BriefcaseBusiness,
    permissions: [
      "ตรวจสอบโครงการในกลุ่มบริหาร",
      "ดูโครงการในกลุ่มบริหาร",
      "สร้างและส่งโครงการตามสิทธิ์",
    ],
  },
  TEACHER: {
    label: "ครู",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-800",
    icon: Users,
    permissions: [
      "สร้างโครงการ",
      "แก้ไขโครงการของตน",
      "สร้างคำขอจัดซื้อจากโครงการที่อนุมัติแล้ว",
    ],
  },
  FINANCE: {
    label: "เจ้าหน้าที่การเงิน",
    badgeClassName: "border-purple-200 bg-purple-100 text-purple-800",
    icon: CircleDollarSign,
    permissions: [
      "จัดสรรงบประจำปี",
      "ตรวจงบประมาณ",
      "ดูรายการเคลื่อนไหวงบประมาณ",
    ],
  },
  PROCUREMENT: {
    label: "เจ้าหน้าที่พัสดุ",
    badgeClassName: "border-orange-200 bg-orange-100 text-orange-800",
    icon: ShoppingCart,
    permissions: [
      "ตรวจรายการพัสดุ",
      "ดูและจัดการคำขอจัดซื้อที่เกี่ยวข้อง",
      "บันทึกสถานะจัดซื้อจัดจ้าง",
    ],
  },
  COMMITTEE: {
    label: "คณะกรรมการสถานศึกษา",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
    icon: ClipboardCheck,
    permissions: ["ดูข้อมูลแบบอ่านอย่างเดียว"],
  },
};

const emptyForm: UserFormState = {
  username: "",
  password: "",
  fullName: "",
  email: "",
  phone: "",
  role: "TEACHER",
  departmentId: "",
  isActive: true,
};

export function UsersClient({
  initialUsers,
  departments,
  currentUserId,
  total,
  page,
  limit,
  totalPages,
  initialQuery,
  summary,
}: UsersClientProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListRow | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserListRow | null>(initialUsers[0] ?? null);
  const [formState, setFormState] = useState<UserFormState>(emptyForm);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    appliedValues,
    draftValues,
    isPending,
    setValue,
    reset,
    goToPage,
  } = useListControls({
    initialValues: initialQuery,
    defaults: defaultUserListQueryValues,
  });

  const roleOptions = ROLE_VALUES.map((value) => ({
    value,
    label: ROLE_META[value].label,
  }));
  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: department.name,
  }));
  const sortOptions = [
    { value: "fullName", label: "ชื่อ-นามสกุล" },
    { value: "username", label: "ชื่อผู้ใช้" },
    { value: "role", label: "บทบาท" },
    { value: "updatedAt", label: "อัปเดตล่าสุด" },
    { value: "createdAt", label: "วันที่สร้าง" },
  ];

  const activeFilters = useMemo(() => {
    const items: Array<{ key: string; label: string; value: string }> = [];
    if (appliedValues.q) items.push({ key: "q", label: "ค้นหา", value: appliedValues.q });
    if (appliedValues.role) {
      items.push({
        key: "role",
        label: "บทบาท",
        value: ROLE_META[appliedValues.role as Role]?.label ?? appliedValues.role,
      });
    }
    if (appliedValues.isActive) {
      items.push({
        key: "isActive",
        label: "สถานะ",
        value: appliedValues.isActive === "true" ? "เปิดใช้งาน" : "ปิดใช้งาน",
      });
    }
    if (appliedValues.departmentId) {
      items.push({
        key: "departmentId",
        label: "กลุ่มบริหาร",
        value:
          departments.find((department) => department.id === appliedValues.departmentId)?.name ??
          appliedValues.departmentId,
      });
    }
    return items;
  }, [appliedValues, departments]);

  const selectedDepartment = departments.find(
    (department) => department.id === formState.departmentId,
  );

  const openCreateModal = () => {
    setEditingUser(null);
    setFormState(emptyForm);
    setError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (user: UserListRow) => {
    setEditingUser(user);
    setSelectedUser(user);
    setFormState({
      username: user.username,
      password: "",
      fullName: user.fullName,
      email: user.email || "",
      phone: user.phone || "",
      role: user.role,
      departmentId: user.departmentId || "",
      isActive: user.isActive,
    });
    setError(null);
    setIsFormOpen(true);
  };

  const openDetail = (user: UserListRow) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  };

  const patchForm = <TKey extends keyof UserFormState>(key: TKey, value: UserFormState[TKey]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const validateForm = () => {
    if (!formState.username.trim()) return "กรุณาระบุชื่อผู้ใช้";
    if (!editingUser && !formState.password.trim()) {
      return "กรุณาระบุรหัสผ่านเริ่มต้นสำหรับผู้ใช้ใหม่";
    }
    if (!formState.fullName.trim()) return "กรุณาระบุชื่อ-นามสกุล";
    if (formState.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) {
      return "รูปแบบอีเมลไม่ถูกต้อง";
    }
    if (!ROLE_VALUES.includes(formState.role)) return "กรุณาเลือกบทบาทที่ถูกต้อง";
    if (DEPARTMENT_REQUIRED_ROLES.has(formState.role) && !formState.departmentId) {
      return "กรุณาเลือกกลุ่มบริหารสำหรับบทบาทนี้";
    }
    return null;
  };

  const buildPayload = (): SavePayload => ({
    username: formState.username.trim(),
    password: formState.password.trim() || undefined,
    fullName: formState.fullName.trim(),
    email: formState.email.trim() || null,
    phone: formState.phone.trim() || null,
    role: formState.role,
    departmentId: formState.departmentId || null,
    isActive: formState.isActive,
  });

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = buildPayload();
    const changes: string[] = [];
    if (editingUser && editingUser.role !== payload.role) {
      changes.push(`บทบาทเดิม: ${ROLE_META[editingUser.role].label} → บทบาทใหม่: ${ROLE_META[payload.role].label}`);
    }
    if (editingUser && editingUser.isActive !== payload.isActive) {
      changes.push(payload.isActive ? "เปิดใช้งานบัญชีนี้" : "ปิดใช้งานบัญชีนี้");
    }

    if (changes.length > 0) {
      setConfirmAction({
        type: "save",
        payload,
        title: "ยืนยันการเปลี่ยนสิทธิ์ผู้ใช้งาน",
        description:
          "การเปลี่ยนบทบาทหรือสถานะบัญชีจะมีผลต่อสิทธิ์การเข้าถึงเมนูและการดำเนินการในระบบ",
        changes,
      });
      return;
    }

    void executeSave(payload);
  };

  const executeSave = async (payload: SavePayload) => {
    setLoading(true);
    setError(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ไม่สามารถบันทึกข้อมูลผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง");
      }

      setIsFormOpen(false);
      setConfirmAction(null);
      router.refresh();
    } catch (caughtError: any) {
      setError(caughtError.message);
      setConfirmAction(null);
    } finally {
      setLoading(false);
    }
  };

  const openStatusConfirm = (user: UserListRow) => {
    const nextActive = !user.isActive;
    setSelectedUser(user);
    setConfirmAction({
      type: "status",
      target: user,
      title: nextActive ? "เปิดใช้งานบัญชีผู้ใช้นี้" : "ปิดใช้งานบัญชีผู้ใช้นี้",
      description: nextActive
        ? "ผู้ใช้นี้จะกลับมาเข้าสู่ระบบและดำเนินการตามสิทธิ์บทบาทได้อีกครั้ง"
        : "ผู้ใช้นี้จะไม่สามารถเข้าสู่ระบบหรือดำเนินการในระบบได้ จนกว่าจะเปิดใช้งานอีกครั้ง",
      changes: [nextActive ? "ยืนยันเปิดใช้งานบัญชี" : "ยืนยันปิดใช้งานบัญชี"],
      payload: {
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        departmentId: user.departmentId,
        isActive: nextActive,
      },
    });
  };

  const executeStatusChange = async (action: Extract<ConfirmAction, { type: "status" }>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${action.target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ไม่สามารถเปลี่ยนสถานะบัญชีได้");
      setConfirmAction(null);
      router.refresh();
    } catch (caughtError: any) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteConfirm = (user: UserListRow) => {
    setSelectedUser(user);
    setConfirmAction({ type: "delete", target: user });
  };

  const executeDelete = async (user: UserListRow) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการลบข้อมูล");
      setConfirmAction(null);
      router.refresh();
    } catch (caughtError: any) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "save") void executeSave(confirmAction.payload);
    if (confirmAction.type === "status") void executeStatusChange(confirmAction);
    if (confirmAction.type === "delete") void executeDelete(confirmAction.target);
  };

  const setQuickFilter = (key: "role" | "isActive", value: string) => {
    setValue(key, value);
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="px-1">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <UserCog className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-primary">ผู้ใช้งาน</h1>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  จัดการบัญชีผู้ใช้ บทบาท กลุ่มบริหาร และสิทธิ์การเข้าถึงระบบ
                </p>
              </div>
            </div>
          </div>
          <Button onClick={openCreateModal} className="h-11 rounded-lg px-5 text-sm font-bold shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            เพิ่มผู้ใช้งาน
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-xl border border-indigo-400/20 bg-[linear-gradient(135deg,#1e00a9,#0842a1)] p-6 text-white shadow-lg shadow-primary/15">
        <div className="relative z-10 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">คำเตือนด้านความปลอดภัย</h2>
            <p className="mt-1 max-w-4xl text-sm font-medium leading-relaxed text-white/80">
              กรุณาตรวจสอบบทบาทและกลุ่มบริหารให้ถูกต้องก่อนบันทึก เพราะสิทธิ์นี้มีผลต่อการสร้างโครงการ
              อนุมัติ งบประมาณ และพัสดุ/จัดซื้อ
            </p>
          </div>
        </div>
        <Shield className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 text-white/10" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={Users} label="ผู้ใช้งานทั้งหมด" value={summary.total} helper="บัญชีที่บันทึกในระบบ" tone="violet" />
        <SummaryCard icon={Shield} label="ผู้ดูแลระบบ" value={summary.superAdmins} helper="จัดการระบบและสิทธิ์" tone="purple" />
        <SummaryCard icon={Landmark} label="ผู้บริหาร" value={summary.executives} helper="อนุมัติและดูภาพรวม" tone="blue" />
        <SummaryCard icon={BriefcaseBusiness} label="ครู/หัวหน้ากลุ่ม" value={summary.teachersAndHeads} helper="สร้างและตรวจโครงการ" tone="gold" />
        <SummaryCard icon={CircleDollarSign} label="การเงิน/พัสดุ" value={summary.financeAndProcurement} helper="งบประมาณและจัดซื้อ" tone="orange" />
        <SummaryCard icon={UserRoundX} label="ปิดใช้งาน" value={summary.inactive} helper="บัญชีที่เข้าใช้ไม่ได้" tone="slate" />
      </section>

      <Card className="rounded-xl border-outline-variant/70 bg-white/80 shadow-sm backdrop-blur">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-black text-primary">
            <SlidersHorizontal className="h-4 w-4" />
            ตัวกรองและการค้นหา
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_190px_170px_170px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={draftValues.q}
                onChange={(event) => setValue("q", event.target.value)}
                placeholder="ค้นหาชื่อ / อีเมล / กลุ่มบริหาร"
                className="h-11 rounded-lg border-outline-variant bg-background pl-11"
              />
            </div>
            <FilterSelect value={draftValues.role} onChange={(value) => setValue("role", value)} label="บทบาททั้งหมด">
              <option value="">บทบาททั้งหมด</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={draftValues.departmentId} onChange={(value) => setValue("departmentId", value)} label="กลุ่มบริหารทั้งหมด">
              <option value="">กลุ่มบริหารทั้งหมด</option>
              {departmentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={draftValues.isActive} onChange={(value) => setValue("isActive", value)} label="สถานะบัญชีทั้งหมด">
              <option value="">สถานะทั้งหมด</option>
              <option value="true">เปิดใช้งาน</option>
              <option value="false">ปิดใช้งาน</option>
            </FilterSelect>
            <FilterSelect value={draftValues.sortBy} onChange={(value) => setValue("sortBy", value)} label="เรียงลำดับ">
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FilterSelect>
            <Button type="button" variant="outline" onClick={reset} disabled={isPending} className="h-11 rounded-lg">
              <X className="h-4 w-4" />
              ล้าง
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <QuickChip active={!appliedValues.role && !appliedValues.isActive} onClick={reset}>ทั้งหมด</QuickChip>
            {ROLE_VALUES.map((roleValue) => (
              <QuickChip key={roleValue} active={appliedValues.role === roleValue} onClick={() => setQuickFilter("role", roleValue)}>
                {ROLE_META[roleValue].label}
              </QuickChip>
            ))}
            <QuickChip active={appliedValues.isActive === "true"} onClick={() => setQuickFilter("isActive", "true")}>เปิดใช้งาน</QuickChip>
            <QuickChip active={appliedValues.isActive === "false"} onClick={() => setQuickFilter("isActive", "false")}>ปิดใช้งาน</QuickChip>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <span key={filter.key} className="rounded-full border border-outline-variant bg-white px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {filter.label}: <span className="text-foreground">{filter.value}</span>
                </span>
              ))}
            </div>
          ) : null}

          <div className="text-xs font-medium text-muted-foreground">
            {isPending ? "กำลังอัปเดตรายการ..." : `พบ ${initialUsers.length} รายการในหน้านี้ จากทั้งหมด ${total} รายการ`}
          </div>
        </CardContent>
      </Card>

      <PaginationControls
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={goToPage}
        disabled={isPending}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="hidden rounded-xl border-outline-variant/70 bg-white/90 shadow-sm md:block">
          <CardHeader className="border-b border-outline-variant/70 bg-white px-5 py-4">
            <CardTitle className="text-lg font-black">รายการผู้ใช้งาน</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto pb-16">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="bg-surface-container-low text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  <tr>
                    <th className="w-[28%] px-5 py-4 font-semibold">ผู้ใช้งาน</th>
                    <th className="hidden w-[18%] px-5 py-4 font-semibold lg:table-cell">อีเมล</th>
                    <th className="w-[14%] px-5 py-4 font-semibold">บทบาท</th>
                    <th className="w-[13%] px-5 py-4 font-semibold">กลุ่มบริหาร</th>
                    <th className="w-[12%] px-5 py-4 font-semibold">สถานะบัญชี</th>
                    <th className="hidden w-[11%] px-5 py-4 font-semibold xl:table-cell">อัปเดตล่าสุด</th>
                    <th className="w-[170px] px-5 py-4 text-right font-semibold">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {initialUsers.length > 0 ? (
                    initialUsers.map((user) => (
                      <UserTableRow
                        key={user.id}
                        user={user}
                        currentUserId={currentUserId}
                        onDetail={openDetail}
                        onEdit={openEditModal}
                        onStatus={openStatusConfirm}
                        onDelete={openDeleteConfirm}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12">
                        <EmptyState onCreate={openCreateModal} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 md:hidden">
          {initialUsers.length > 0 ? (
            initialUsers.map((user) => (
              <UserMobileCard
                key={user.id}
                user={user}
                currentUserId={currentUserId}
                onDetail={openDetail}
                onEdit={openEditModal}
                onStatus={openStatusConfirm}
                onDelete={openDeleteConfirm}
              />
            ))
          ) : (
            <Card className="rounded-[24px] border-border/60">
              <CardContent className="p-6">
                <EmptyState onCreate={openCreateModal} />
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="hidden xl:block xl:sticky xl:top-24">
          <UserDetailPanel user={selectedUser} onEdit={openEditModal} onStatus={openStatusConfirm} />
        </aside>
      </div>

      <PaginationControls
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={goToPage}
        disabled={isPending}
      />

      {isFormOpen ? (
        <UserFormModal
          editingUser={editingUser}
          formState={formState}
          selectedDepartmentName={selectedDepartment?.name}
          departments={departments}
          loading={loading}
          error={error}
          currentUserId={currentUserId}
          onPatch={patchForm}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSave}
        />
      ) : null}

      {isDetailOpen ? (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setIsDetailOpen(false)}
          onEdit={openEditModal}
          onStatus={openStatusConfirm}
        />
      ) : null}

      {confirmAction ? (
        <ConfirmationModal
          action={confirmAction}
          loading={loading}
          error={error}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </div>
  );
}

function UserTableRow({
  user,
  currentUserId,
  onDetail,
  onEdit,
  onStatus,
  onDelete,
}: {
  user: UserListRow;
  currentUserId: string;
  onDetail: (user: UserListRow) => void;
  onEdit: (user: UserListRow) => void;
  onStatus: (user: UserListRow) => void;
  onDelete: (user: UserListRow) => void;
}) {
  const isSelf = user.id === currentUserId;

  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <UserIdentityBlock user={user} isSelf={isSelf} />
      </td>
      <td className="hidden px-5 py-4 lg:table-cell">
        {user.email ? (
          <a href={`mailto:${user.email}`} className="block max-w-[220px] truncate font-medium text-primary hover:underline">
            {user.email}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">ยังไม่มีอีเมล</span>
        )}
      </td>
      <td className="px-5 py-4">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-5 py-4">
        <span className="block max-w-[130px] truncate text-sm font-medium text-muted-foreground">
          {shortenDepartmentName(user.department?.name)}
        </span>
      </td>
      <td className="px-5 py-4">
        <StatusBadge isActive={user.isActive} />
      </td>
      <td className="hidden whitespace-nowrap px-5 py-4 text-sm font-medium text-muted-foreground xl:table-cell">
        {formatThaiDate(user.updatedAt)}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" className="rounded-xl whitespace-nowrap" onClick={() => onDetail(user)}>
            <Eye className="h-4 w-4" />
            ดูรายละเอียด
          </Button>
          <UserActionsMenu
            user={user}
            isSelf={isSelf}
            onEdit={onEdit}
            onStatus={onStatus}
            onDelete={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}

function UserMobileCard({
  user,
  currentUserId,
  onDetail,
  onEdit,
  onStatus,
  onDelete,
}: {
  user: UserListRow;
  currentUserId: string;
  onDetail: (user: UserListRow) => void;
  onEdit: (user: UserListRow) => void;
  onStatus: (user: UserListRow) => void;
  onDelete: (user: UserListRow) => void;
}) {
  const isSelf = user.id === currentUserId;

  return (
    <Card className="rounded-xl border-outline-variant/70 bg-white/90 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <UserIdentityBlock user={user} isSelf={isSelf} />
          <StatusBadge isActive={user.isActive} />
        </div>
        <div className="flex flex-wrap gap-2">
          <RoleBadge role={user.role} />
          <span className="inline-flex rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-slate-600">
            {shortenDepartmentName(user.department?.name)}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">{user.email || "ยังไม่มีอีเมล"}</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <MiniCount label="โครงการ" value={user.counts.responsibleProjects} />
          <MiniCount label="จัดซื้อ" value={user.counts.createdPurchaseRequests} />
          <MiniCount label="อนุมัติ" value={user.counts.approvals} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => onDetail(user)}>
            <Eye className="h-4 w-4" />
            รายละเอียด
          </Button>
          <UserActionsMenu
            user={user}
            isSelf={isSelf}
            onEdit={onEdit}
            onStatus={onStatus}
            onDelete={onDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function UserIdentityBlock({ user, isSelf }: { user: UserListRow; isSelf: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary ring-1 ring-primary/10">
        {getUserInitials(user.fullName, user.username)}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-bold text-foreground">{user.fullName}</span>
          {isSelf ? <TinyBadge>บัญชีของคุณ</TinyBadge> : null}
        </div>
        <p className="truncate font-mono text-xs font-semibold text-muted-foreground">@{user.username}</p>
      </div>
    </div>
  );
}

function UserActionsMenu({
  user,
  isSelf,
  onEdit,
  onStatus,
  onDelete,
}: {
  user: UserListRow;
  isSelf: boolean;
  onEdit: (user: UserListRow) => void;
  onStatus: (user: UserListRow) => void;
  onDelete: (user: UserListRow) => void;
}) {
  const [open, setOpen] = useState(false);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative inline-flex">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-lg whitespace-nowrap"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
        เพิ่มเติม
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-outline-variant bg-white p-1.5 text-sm shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-primary transition hover:bg-primary/10"
            onClick={() => runAction(() => onEdit(user))}
          >
            <Pencil className="h-4 w-4" />
            แก้ไข
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isSelf}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-45",
              user.isActive ? "text-amber-700" : "text-emerald-700",
            )}
            onClick={() => runAction(() => onStatus(user))}
          >
            {user.isActive ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}
            {user.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isSelf}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => runAction(() => onDelete(user))}
          >
            <Trash2 className="h-4 w-4" />
            ลบผู้ใช้งาน
          </button>
        </div>
      ) : null}
    </div>
  );
}

function UserFormModal({
  editingUser,
  formState,
  selectedDepartmentName,
  departments,
  loading,
  error,
  currentUserId,
  onPatch,
  onClose,
  onSubmit,
}: {
  editingUser: UserListRow | null;
  formState: UserFormState;
  selectedDepartmentName?: string;
  departments: DepartmentType[];
  loading: boolean;
  error: string | null;
  currentUserId: string;
  onPatch: <TKey extends keyof UserFormState>(key: TKey, value: UserFormState[TKey]) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const isSelf = editingUser?.id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low/60 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-foreground">
              {editingUser ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              กำหนดข้อมูลบัญชี บทบาท กลุ่มบริหาร และสถานะการเข้าใช้งาน
            </p>
          </div>
          <button className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            {error ? (
              <AlertBox tone="danger" title="ไม่สามารถบันทึกข้อมูลได้">
                {error}
              </AlertBox>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="ชื่อผู้ใช้">
                <Input
                  value={formState.username}
                  onChange={(event) => onPatch("username", event.target.value)}
                  disabled={Boolean(editingUser)}
                  placeholder="เช่น somchai"
                  className="h-11 rounded-2xl"
                />
              </Field>
              <Field label={editingUser ? "ตั้งรหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น"}>
                <Input
                  type="password"
                  value={formState.password}
                  onChange={(event) => onPatch("password", event.target.value)}
                  placeholder={editingUser ? "เว้นว่างหากไม่เปลี่ยน" : "กำหนดรหัสผ่านเริ่มต้น"}
                  className="h-11 rounded-2xl"
                />
              </Field>
            </div>

            <Field label="ชื่อ-นามสกุล">
              <Input
                value={formState.fullName}
                onChange={(event) => onPatch("fullName", event.target.value)}
                placeholder="เช่น ครูสมชาย ใจดี"
                className="h-11 rounded-2xl"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="อีเมล">
                <Input
                  type="email"
                  value={formState.email}
                  onChange={(event) => onPatch("email", event.target.value)}
                  placeholder="example@school.ac.th"
                  className="h-11 rounded-2xl"
                />
              </Field>
              <Field label="เบอร์โทรศัพท์">
                <Input
                  type="tel"
                  value={formState.phone}
                  onChange={(event) => onPatch("phone", event.target.value)}
                  placeholder="เช่น 0812345678"
                  className="h-11 rounded-2xl"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="บทบาท">
                <select
                  value={formState.role}
                  onChange={(event) => onPatch("role", event.target.value as Role)}
                  disabled={isSelf}
                  className="h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/30"
                >
                  {ROLE_VALUES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_META[role].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="กลุ่มบริหาร">
                <select
                  value={formState.departmentId}
                  onChange={(event) => onPatch("departmentId", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">ไม่สังกัดกลุ่มบริหาร</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              type="button"
              onClick={() => !isSelf && onPatch("isActive", !formState.isActive)}
              disabled={isSelf}
              className="flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-slate-50/70 p-4 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 items-center justify-center rounded border",
                  formState.isActive ? "border-primary bg-primary text-white" : "border-muted-foreground/40 bg-white",
                )}
              >
                {formState.isActive ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span>
                <span className="block font-bold text-foreground">เปิดใช้งานบัญชีนี้</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  บัญชีที่ปิดใช้งานจะไม่สามารถเข้าสู่ระบบหรือดำเนินการใด ๆ ได้
                </span>
              </span>
            </button>
          </div>

          <div className="space-y-4">
            <Card className="rounded-[24px] border-border/60">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-black text-foreground">สิทธิ์โดยสรุป</p>
                <RoleBadge role={formState.role} />
                <PermissionList role={formState.role} />
                <div className="rounded-2xl border border-border/60 bg-slate-50/70 p-3 text-xs text-muted-foreground">
                  กลุ่มบริหาร: <span className="font-semibold text-foreground">{selectedDepartmentName || "ไม่สังกัดกลุ่มบริหาร"}</span>
                </div>
              </CardContent>
            </Card>

            <AlertBox tone="info" title="หมายเหตุด้านความปลอดภัย">
              ระบบจะไม่แสดงรหัสผ่านเดิมหรือ password hash ผู้ดูแลระบบสามารถตั้งรหัสผ่านใหม่ได้จากฟอร์มนี้เท่านั้น
            </AlertBox>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/60 pt-4 lg:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[132px] rounded-xl">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmationModal({
  action,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  action: ConfirmAction;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const target = action.type === "save" ? null : action.target;
  const title =
    action.type === "delete"
      ? "ยืนยันการลบผู้ใช้งาน"
      : action.title;
  const description =
    action.type === "delete"
      ? "การลบผู้ใช้งานจะทำไม่ได้หากบัญชียังเป็นผู้รับผิดชอบโครงการในระบบ"
      : action.description;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-outline-variant bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {error ? <AlertBox tone="danger" title="ดำเนินการไม่สำเร็จ">{error}</AlertBox> : null}
          {target ? (
            <div className="rounded-2xl border border-border/60 bg-slate-50/70 p-4">
              <p className="font-bold text-foreground">{target.fullName}</p>
              <p className="mt-1 text-sm text-muted-foreground">@{target.username} • {target.email || "ยังไม่มีอีเมล"}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <MiniCount label="โครงการ" value={target.counts.responsibleProjects} />
                <MiniCount label="จัดซื้อ" value={target.counts.createdPurchaseRequests} />
                <MiniCount label="อนุมัติ" value={target.counts.approvals} />
              </div>
            </div>
          ) : null}
          {action.type !== "delete" ? (
            <div className="space-y-2">
              {action.changes.map((change) => (
                <div key={change} className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-900">
                  {change}
                </div>
              ))}
            </div>
          ) : (
            <AlertBox tone="danger" title="คำเตือน">
              การลบเป็นการนำบัญชีออกจากระบบ หากต้องการหยุดการเข้าใช้งานชั่วคราว แนะนำให้ใช้ปิดใช้งานบัญชีแทน
            </AlertBox>
          )}
          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              variant={action.type === "delete" ? "destructive" : "default"}
              className="min-w-[150px] rounded-xl"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : action.type === "delete" ? <Trash2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {loading ? "กำลังดำเนินการ..." : action.type === "delete" ? "ยืนยันลบ" : "ยืนยัน"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserDetailDrawer({
  user,
  onClose,
  onEdit,
  onStatus,
}: {
  user: UserListRow | null;
  onClose: () => void;
  onEdit: (user: UserListRow) => void;
  onStatus: (user: UserListRow) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm xl:hidden">
        <div className="ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low/60 px-5 py-4">
          <h2 className="text-lg font-black">รายละเอียดผู้ใช้งาน</h2>
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          <UserDetailPanel user={user} onEdit={onEdit} onStatus={onStatus} />
        </div>
      </div>
    </div>
  );
}

function UserDetailPanel({
  user,
  onEdit,
  onStatus,
}: {
  user: UserListRow | null;
  onEdit: (user: UserListRow) => void;
  onStatus: (user: UserListRow) => void;
}) {
  if (!user) {
    return (
      <Card className="rounded-[28px] border-border/60">
        <CardContent className="p-6">
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-outline-variant/70 bg-white/85 shadow-sm backdrop-blur">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">รายละเอียดผู้ใช้งาน</p>
            <h3 className="mt-2 text-xl font-black text-foreground">{user.fullName}</h3>
            <p className="mt-1 font-mono text-xs font-semibold text-muted-foreground">@{user.username}</p>
          </div>
          <StatusBadge isActive={user.isActive} />
        </div>

        <div className="flex flex-wrap gap-2">
          <RoleBadge role={user.role} />
          <TinyBadge>{shortenDepartmentName(user.department?.name)}</TinyBadge>
        </div>

        <dl className="space-y-3 text-sm">
          <InfoRow label="อีเมล" value={user.email || "ยังไม่มีอีเมล"} />
          <InfoRow label="เบอร์โทรศัพท์" value={user.phone || "ยังไม่มีเบอร์โทรศัพท์"} />
          <InfoRow label="เข้าสู่ระบบล่าสุด" value="ยังไม่มีข้อมูลการเข้าสู่ระบบ" />
          <InfoRow label="วันที่สร้างบัญชี" value={formatThaiDate(user.createdAt)} />
          <InfoRow label="อัปเดตล่าสุด" value={formatThaiDate(user.updatedAt)} />
        </dl>

        <div className="grid grid-cols-2 gap-3">
          <MiniCount label="โครงการที่รับผิดชอบ" value={user.counts.responsibleProjects} />
          <MiniCount label="คำขอจัดซื้อ" value={user.counts.createdPurchaseRequests} />
          <MiniCount label="งานอนุมัติ" value={user.counts.approvals} />
          <MiniCount label="ประวัติการดำเนินการ" value={user.counts.auditLogs} />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-black text-foreground">สิทธิ์โดยสรุป</p>
          <PermissionList role={user.role} />
        </div>

        <div className="space-y-2">
          <QuickLink href={`/projects?responsibleUserId=${user.id}`} icon={FolderKanban} label="ดูโครงการของผู้ใช้นี้" />
          <QuickLink href="/procurement" icon={ShoppingCart} label="ดูคำขอจัดซื้อ" />
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
            <FileClock className="h-4 w-4" />
            หน้าประวัติการดำเนินการยังไม่มี route เฉพาะ
          </div>
        </div>

        <div className="flex gap-2 border-t border-border/60 pt-4">
          <Button className="flex-1 rounded-xl" onClick={() => onEdit(user)}>
            <Pencil className="h-4 w-4" />
            แก้ไข
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onStatus(user)}>
            {user.isActive ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}
            {user.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  helper: string;
  tone: "violet" | "purple" | "blue" | "gold" | "orange" | "slate";
}) {
  const tones = {
    violet: "bg-violet-100 text-violet-700",
    purple: "bg-purple-100 text-purple-700",
    blue: "bg-blue-100 text-blue-700",
    gold: "bg-amber-100 text-amber-800",
    orange: "bg-orange-100 text-orange-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <Card className="rounded-xl border-outline-variant/70 bg-white/80 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-black text-primary">{value.toLocaleString("th-TH")}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{helper}</p>
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold leading-none", meta.badgeClassName)}>
      {meta.label}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold leading-none text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      เปิดใช้งาน
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold leading-none text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      ปิดใช้งาน
    </span>
  );
}

function PermissionList({ role }: { role: Role }) {
  return (
    <ul className="space-y-2">
      {ROLE_META[role].permissions.map((permission) => (
        <li key={permission} className="flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>{permission}</span>
        </li>
      ))}
    </ul>
  );
}

function getUserInitials(fullName: string, username: string) {
  const source = fullName.trim() || username.trim();
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    return words
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toUpperCase();
  }

  return Array.from(source).slice(0, 2).join("").toUpperCase() || "U";
}

function shortenDepartmentName(name?: string | null) {
  if (!name) return "ไม่สังกัดกลุ่ม";

  return name
    .replace(/^กลุ่มบริหาร/, "")
    .replace(/^กลุ่ม/, "")
    .replace(/บริหาร/g, "")
    .trim() || name;
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className="h-11 w-full rounded-lg border border-outline-variant bg-background px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
    >
      {children}
    </select>
  );
}

function QuickChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-bold transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-outline-variant bg-white text-muted-foreground hover:bg-surface-container-low hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function TinyBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-border/70 bg-white px-2.5 py-1 text-xs font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-slate-50/70 px-3 py-2">
      <p className="text-lg font-black text-foreground">{value.toLocaleString("th-TH")}</p>
      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[190px] text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function AlertBox({
  tone,
  title,
  children,
}: {
  tone: "danger" | "info";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "danger"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-blue-200 bg-blue-50 text-blue-900",
      )}
    >
      <p className="font-bold">{title}</p>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-slate-50 hover:text-primary"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
        <Users className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-black text-foreground">ยังไม่มีผู้ใช้งาน</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        เริ่มเพิ่มผู้ใช้งานเพื่อกำหนดบทบาทและสิทธิ์การเข้าถึงระบบ
      </p>
      {onCreate ? (
        <Button onClick={onCreate} className="mt-4 rounded-2xl">
          <Plus className="h-4 w-4" />
          เพิ่มผู้ใช้งาน
        </Button>
      ) : null}
    </div>
  );
}
