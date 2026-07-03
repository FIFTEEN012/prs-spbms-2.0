"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchFilterBar, type ActiveFilterSummary } from "@/components/ui/search-filter-bar";
import {
  AlertTriangle,
  Check,
  Edit2,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import {
  defaultUserListQueryValues,
  type UserListQueryValues,
  type UserListRow,
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
}

export function UsersClient({
  initialUsers,
  departments,
  currentUserId,
  total,
  page,
  limit,
  totalPages,
  initialQuery,
}: UsersClientProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserListRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    appliedValues,
    draftValues,
    isDirty,
    isPending,
    setValue,
    reset,
    goToPage,
  } = useListControls({
    initialValues: initialQuery,
    defaults: defaultUserListQueryValues,
  });

  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const statusOptions = [
    { value: "true", label: "ใช้งาน" },
    { value: "false", label: "ปิดใช้งาน" },
  ];
  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: department.name,
  }));
  const sortOptions = [
    { value: "fullName", label: "ชื่อ-นามสกุล" },
    { value: "username", label: "ชื่อผู้ใช้" },
    { value: "role", label: "บทบาท" },
    { value: "createdAt", label: "วันที่สร้าง" },
  ];

  const activeFilters = useMemo<ActiveFilterSummary[]>(() => {
    const items: ActiveFilterSummary[] = [];

    if (appliedValues.q) {
      items.push({ key: "q", label: "ค้นหา", value: appliedValues.q });
    }
    if (appliedValues.role) {
      items.push({
        key: "role",
        label: "บทบาท",
        value: ROLE_LABELS[appliedValues.role as Role] ?? appliedValues.role,
      });
    }
    if (appliedValues.isActive) {
      items.push({
        key: "isActive",
        label: "สถานะ",
        value: appliedValues.isActive === "true" ? "ใช้งาน" : "ปิดใช้งาน",
      });
    }
    if (appliedValues.departmentId) {
      items.push({
        key: "departmentId",
        label: "ฝ่าย/กลุ่มงาน",
        value:
          departments.find((department) => department.id === appliedValues.departmentId)
            ?.name ?? appliedValues.departmentId,
      });
    }

    return items;
  }, [appliedValues, departments]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("TEACHER");
  const [departmentId, setDepartmentId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const openCreateModal = () => {
    setEditingUser(null);
    setUsername("");
    setPassword("");
    setFullName("");
    setEmail("");
    setPhone("");
    setRole("TEACHER");
    setDepartmentId("");
    setIsActive(true);
    setError(null);
    setIsOpen(true);
  };

  const openEditModal = (user: UserListRow) => {
    setEditingUser(user);
    setUsername(user.username);
    setPassword("");
    setFullName(user.fullName);
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setRole(user.role);
    setDepartmentId(user.departmentId || "");
    setIsActive(user.isActive);
    setError(null);
    setIsOpen(true);
  };

  const openDeleteModal = (user: UserListRow) => {
    setDeleteTarget(user);
    setError(null);
    setIsDeleteOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim()) {
      setError("กรุณาระบุชื่อผู้ใช้");
      return;
    }
    if (!editingUser && !password.trim()) {
      setError("กรุณาระบุรหัสผ่านสำหรับการสร้างผู้ใช้ใหม่");
      return;
    }
    if (!fullName.trim()) {
      setError("กรุณาระบุชื่อ-นามสกุล");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim() || undefined,
          fullName: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          role,
          departmentId: departmentId || null,
          isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการลบข้อมูล");
      }

      setIsDeleteOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            ผู้ใช้งานและสิทธิ์เข้าใช้งาน
          </h1>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            จัดการข้อมูลผู้ใช้งาน กำหนดบทบาทสิทธิ์ และฝ่ายงานในระบบ
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/95"
        >
          <Plus className="h-4 w-4" />
          เพิ่มผู้ใช้ใหม่
        </Button>
      </div>

      <SearchFilterBar
        searchValue={draftValues.q}
        onSearchChange={(value) => setValue("q", value)}
        searchPlaceholder="ค้นหาชื่อ, username, อีเมล, เบอร์โทร..."
        filters={[
          {
            type: "select",
            key: "role",
            label: "บทบาท",
            options: roleOptions,
            value: draftValues.role,
            onChange: (value) => setValue("role", value),
            allLabel: "ทุกบทบาท",
          },
          {
            type: "select",
            key: "isActive",
            label: "สถานะ",
            options: statusOptions,
            value: draftValues.isActive,
            onChange: (value) => setValue("isActive", value),
            allLabel: "ทุกสถานะ",
          },
          {
            type: "select",
            key: "departmentId",
            label: "ฝ่าย/กลุ่มงาน",
            options: departmentOptions,
            value: draftValues.departmentId,
            onChange: (value) => setValue("departmentId", value),
            allLabel: "ทุกฝ่าย",
          },
        ]}
        sortOptions={sortOptions}
        sortValue={draftValues.sortBy}
        onSortChange={(value) => setValue("sortBy", value)}
        sortDirection={draftValues.sortDir}
        onSortDirectionChange={(value) => setValue("sortDir", value)}
        totalCount={total}
        filteredCount={initialUsers.length}
        isLoading={isPending}
        isDirty={isDirty}
        onReset={reset}
        activeFilters={activeFilters}
      />

      <PaginationControls
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={goToPage}
        disabled={isPending}
      />

      <Card className="overflow-hidden rounded-xl border border-muted/40 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-muted/50 bg-muted/30 font-medium text-muted-foreground">
                  <th className="p-4 font-semibold">ชื่อผู้ใช้</th>
                  <th className="p-4 font-semibold">ชื่อ-นามสกุล</th>
                  <th className="p-4 font-semibold">บทบาท</th>
                  <th className="p-4 font-semibold">ฝ่าย/กลุ่มงาน</th>
                  <th className="p-4 font-semibold">อีเมล/เบอร์โทร</th>
                  <th className="p-4 font-semibold">สถานะ</th>
                  <th className="p-4 text-right font-semibold">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/30">
                {initialUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      ไม่พบรายการที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  initialUsers.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-muted/10">
                      <td className="p-4 font-mono text-xs font-semibold text-primary">
                        {user.username}
                        {user.id === currentUserId && (
                          <span className="ml-1.5 rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            บัญชีของคุณ
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-foreground">
                        {user.fullName}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/50 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                          <Shield className="h-3 w-3 shrink-0" />
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-muted-foreground">
                        {user.department?.name ?? "-"}
                      </td>
                      <td className="space-y-0.5 p-4 text-xs text-muted-foreground">
                        {user.email && <div>{user.email}</div>}
                        {user.phone && <div>{user.phone}</div>}
                        {!user.email && !user.phone && <div>-</div>}
                      </td>
                      <td className="p-4">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            <UserCheck className="h-3.5 w-3.5" />
                            ใช้งาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            <UserX className="h-3.5 w-3.5" />
                            ปิดใช้งาน
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 text-primary hover:bg-primary/5 hover:text-primary/90"
                            onClick={() => openEditModal(user)}
                          >
                            <Edit2 className="mr-1 h-3.5 w-3.5" />
                            แก้ไข
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 text-destructive hover:bg-destructive/5 hover:text-destructive/90"
                            onClick={() => openDeleteModal(user)}
                            disabled={user.id === currentUserId}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            ลบ
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all duration-200">
          <div className="animate-in zoom-in-95 fade-in duration-150 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingUser ? "แก้ไขข้อมูลผู้ใช้งาน" : "เพิ่มผู้ใช้งานใหม่"}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="max-h-[80vh] flex-1 space-y-4 overflow-y-auto p-6"
            >
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    ชื่อผู้ใช้ (Username) *
                  </label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="rounded-lg font-mono text-sm"
                    required
                    disabled={!!editingUser}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    รหัสผ่าน {editingUser ? "(เว้นว่างหากไม่ต้องการเปลี่ยน)" : "*"}
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="rounded-lg text-sm"
                    required={!editingUser}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  ชื่อ-นามสกุล *
                </label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="rounded-lg text-sm font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    อีเมล (ถ้ามี)
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    เบอร์โทรศัพท์ (ถ้ามี)
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    บทบาทและสิทธิ์ *
                  </label>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as Role)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    disabled={editingUser?.id === currentUserId}
                  >
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    ฝ่าย/กลุ่มงาน
                  </label>
                  <select
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">-- ไม่สังกัดฝ่าย --</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border bg-muted/20 p-3.5 transition-colors hover:bg-muted/30"
                onClick={() => {
                  if (editingUser?.id === currentUserId) return;
                  setIsActive(!isActive);
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => {}}
                  disabled={editingUser?.id === currentUserId}
                  className="h-4.5 w-4.5 rounded border-muted-foreground/30 text-primary focus:ring-primary disabled:opacity-50"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    เปิดใช้งานบัญชีนี้
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    บัญชีที่ปิดใช้งานจะไม่สามารถเข้าสู่ระบบหรือดำเนินการใด ๆ ได้
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="rounded-lg"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="min-w-[90px] gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      บันทึก...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      บันทึกข้อมูล
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all duration-200">
          <div className="animate-in zoom-in-95 fade-in duration-150 flex w-full max-w-md flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
                <AlertTriangle className="h-5 w-5" />
                ยืนยันการลบผู้ใช้งาน
              </h2>
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-sm leading-relaxed text-foreground">
                ท่านแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งาน{" "}
                <strong className="text-base font-bold">
                  &quot;{deleteTarget.fullName}&quot; (@{deleteTarget.username})
                </strong>
                ? การดำเนินการนี้จะไม่สามารถกู้ข้อมูลคืนมาได้
              </p>

              <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                หากผู้ใช้นี้ยังผูกกับโครงการที่อยู่ในระบบ ระบบจะไม่อนุญาตให้ลบ
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeleteOpen(false)}
                  disabled={loading}
                  className="rounded-lg"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading}
                  onClick={handleDelete}
                  className="gap-1.5 rounded-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      ยืนยันลบผู้ใช้งาน
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
