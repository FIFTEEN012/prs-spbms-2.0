"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchFilterBar, type ActiveFilterSummary } from "@/components/ui/search-filter-bar";
import {
  AlertTriangle,
  Building,
  Calendar,
  Check,
  CheckSquare,
  Coins,
  FileText,
  Loader2,
  User as UserIcon,
  X,
} from "lucide-react";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import {
  defaultApprovalQueueQueryValues,
  type ApprovalQueueQueryValues,
  type ApprovalQueueRow,
} from "@/lib/approval-list-service";
import { useListControls } from "@/lib/use-list-controls";

const STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "เสนอโครงการ (รอตรวจ)" },
  { value: "REVIEWED", label: "ตรวจแล้ว (รออนุมัติ)" },
];

interface ApprovalsClientProps {
  initialProjects: ApprovalQueueRow[];
  role: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  initialQuery: ApprovalQueueQueryValues;
  departments: Array<{ id: string; name: string }>;
}

export function ApprovalsClient({
  initialProjects,
  role,
  total,
  page,
  limit,
  totalPages,
  initialQuery,
  departments,
}: ApprovalsClientProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    defaults: defaultApprovalQueueQueryValues,
  });

  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: department.name,
  }));
  const sortOptions = [
    { value: "updatedAt", label: "อัปเดตล่าสุด" },
    { value: "projectName", label: "ชื่อโครงการ" },
    { value: "projectCode", label: "รหัสโครงการ" },
    { value: "budgetRequested", label: "งบเสนอขอ" },
  ];

  const activeFilters = useMemo<ActiveFilterSummary[]>(() => {
    const items: ActiveFilterSummary[] = [];

    if (appliedValues.q) {
      items.push({ key: "q", label: "ค้นหา", value: appliedValues.q });
    }
    if (appliedValues.status) {
      items.push({
        key: "status",
        label: "สถานะ",
        value:
          STATUS_OPTIONS.find((option) => option.value === appliedValues.status)?.label ??
          appliedValues.status,
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

  const handleBulkApprove = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/projects/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: initialProjects.map((project) => project.id) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการอนุมัติโครงการ");
      }

      setSuccess(`อนุมัติโครงการสำเร็จ ${data.count} รายการ`);
      setIsConfirmOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="rounded-full border border-blue-200/40 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
            เสนอโครงการ (รอตรวจ)
          </span>
        );
      case "REVIEWED":
        return (
          <span className="rounded-full border border-amber-200/40 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            ตรวจแล้ว (รออนุมัติ)
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">งานอนุมัติ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === "DEPT_HEAD" && "โครงการที่รอหัวหน้ากลุ่มงานตรวจสอบ"}
            {role === "EXECUTIVE" && "โครงการที่ผ่านการตรวจและรอผู้บริหารอนุมัติ"}
            {role === "SUPER_ADMIN" && "โครงการทั้งหมดที่อยู่ในขั้นตอนเสนอขอและตรวจสอบ"}
            {role !== "DEPT_HEAD" &&
              role !== "EXECUTIVE" &&
              role !== "SUPER_ADMIN" &&
              "คุณไม่มีงานอนุมัติในบทบาทนี้"}
          </p>
        </div>
        {initialProjects.length > 0 && (
          <Button
            onClick={() => {
              setError(null);
              setSuccess(null);
              setIsConfirmOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white shadow-md transition-all hover:bg-emerald-700"
          >
            <CheckSquare className="h-4.5 w-4.5" />
            อนุมัติทั้งหมดในหน้านี้
          </Button>
        )}
      </div>

      <SearchFilterBar
        searchValue={draftValues.q}
        onSearchChange={(value) => setValue("q", value)}
        searchPlaceholder="ค้นหาชื่อโครงการ, รหัส, ผู้เสนอ..."
        filters={[
          {
            type: "select",
            key: "status",
            label: "สถานะ",
            options: STATUS_OPTIONS,
            value: draftValues.status,
            onChange: (value) => setValue("status", value),
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
        filteredCount={initialProjects.length}
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

      {success && (
        <div className="animate-in fade-in duration-300 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <Check className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="text-sm font-semibold">{success}</span>
        </div>
      )}

      {error && !isConfirmOpen && (
        <div className="animate-in fade-in flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <Card className="overflow-hidden rounded-xl border border-muted/40 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-muted/40 bg-muted/20 font-medium text-muted-foreground">
                  <th className="w-28 p-4 text-center font-semibold">รหัสโครงการ</th>
                  <th className="p-4 font-semibold">ชื่อโครงการ</th>
                  <th className="p-4 font-semibold">ฝ่าย/กลุ่มงาน</th>
                  <th className="p-4 font-semibold">ผู้เสนอโครงการ</th>
                  <th className="p-4 text-right font-semibold">งบประมาณเสนอขอ</th>
                  <th className="p-4 font-semibold">อัปเดตล่าสุด</th>
                  <th className="p-4 text-center font-semibold">ขั้นตอนสถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/30">
                {initialProjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="h-10 w-10 text-muted-foreground/45" />
                        <span className="text-sm font-semibold">
                          ไม่พบรายการที่ตรงกับเงื่อนไข
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  initialProjects.map((project) => (
                    <tr
                      key={project.id}
                      className="transition-colors hover:bg-muted/10"
                    >
                      <td className="p-4 text-center font-mono text-xs font-bold text-muted-foreground">
                        {project.projectCode}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/projects/${project.id}`}
                          className="block font-bold text-primary transition-all hover:underline"
                        >
                          {project.projectName}
                        </Link>
                      </td>
                      <td className="p-4 font-medium text-foreground/90">
                        <span className="flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-muted-foreground" />
                          {project.department?.name ?? "-"}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-foreground/90">
                        <span className="flex items-center gap-1.5">
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {project.responsibleUser?.fullName ?? "-"}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-base font-bold text-foreground">
                        <span className="flex items-center justify-end gap-1 font-mono">
                          <Coins className="h-3.5 w-3.5 text-amber-500" />
                          {formatBaht(Number(project.budgetRequested))}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatThaiDate(project.updatedAt)}
                        </span>
                      </td>
                      <td className="p-4 text-center font-semibold">
                        {getRoleBadge(project.status)}
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

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all duration-200">
          <div className="animate-in zoom-in-95 fade-in duration-150 flex w-full max-w-md flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CheckSquare className="h-5 w-5 text-emerald-600" />
                ยืนยันการอนุมัติโครงการทั้งหมด
              </h2>
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                disabled={loading}
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
                คุณแน่ใจหรือไม่ว่าต้องการอนุมัติโครงการในหน้านี้จำนวน
                <strong className="mx-1 text-base font-bold text-emerald-700">
                  {initialProjects.length} โครงการ
                </strong>
                ระบบจะอัปเดตสถานะตามขั้นตอนของแต่ละโครงการทันที
              </p>

              <div className="space-y-1 rounded-xl border border-amber-200/50 bg-amber-50 p-3.5 text-amber-900">
                <h4 className="flex items-center gap-1 text-xs font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  โปรดตรวจสอบความถูกต้อง:
                </h4>
                <p className="text-[11px] font-medium leading-relaxed">
                  การอนุมัติแบบกลุ่มจะใช้รายการที่แสดงอยู่ในหน้าปัจจุบันตามตัวกรองและการแบ่งหน้าที่เลือกไว้
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={loading}
                  className="rounded-lg"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={handleBulkApprove}
                  className="min-w-[120px] gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังอนุมัติ...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      ยืนยันอนุมัติทั้งหมด
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
