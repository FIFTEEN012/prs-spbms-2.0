"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Eye,
  FilePlus2,
  FolderKanban,
  History,
  Landmark,
  Loader2,
  PencilLine,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatThaiDate } from "@/lib/utils";
import { useListControls } from "@/lib/use-list-controls";

export type AcademicYearsQueryValues = {
  q: string;
  status: string;
  hasBudgetPlan: string;
  sortBy: "yearName" | "startDate" | "projectCount" | "budgetPlanStatus" | "updatedAt";
  sortDir: "asc" | "desc";
  page: string;
  limit: string;
};

export type AcademicYearListItem = {
  id: string;
  yearName: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  strategyCount: number;
  projectCount: number;
  purchaseRequestCount: number;
  budgetPlanCount: number;
  budgetPlanStatus: string | null;
  budgetPlanStatusLabel: string;
  budgetPlanName: string | null;
  budgetPlanUpdatedAt: string | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  projectStatusCounts: {
    draft: number;
    submitted: number;
    reviewed: number;
    approved: number;
    rejected: number;
  };
  canDelete: boolean;
};

export type AcademicYearsPageData = {
  currentUserRole: string;
  canManage: boolean;
  currentYear: AcademicYearListItem | null;
  summary: {
    total: number;
    active: number;
    current: number;
    inactive: number;
  };
  years: AcademicYearListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: AcademicYearsQueryValues;
};

const defaultQueryValues: AcademicYearsQueryValues = {
  q: "",
  status: "",
  hasBudgetPlan: "",
  sortBy: "yearName",
  sortDir: "desc",
  page: "1",
  limit: "10",
};

const quickFilters = [
  { label: "ทั้งหมด", status: "", hasBudgetPlan: "" },
  { label: "ปีปัจจุบัน", status: "current", hasBudgetPlan: "" },
  { label: "เปิดใช้งาน", status: "active", hasBudgetPlan: "" },
  { label: "ปิดการใช้งาน", status: "inactive", hasBudgetPlan: "" },
  { label: "มีแผนงบประมาณแล้ว", status: "", hasBudgetPlan: "1" },
];

const statusOptions = [
  { value: "", label: "ทุกสถานะ" },
  { value: "current", label: "ปีปัจจุบัน" },
  { value: "active", label: "เปิดใช้งาน" },
  { value: "inactive", label: "ปิดการใช้งาน" },
];

const sortOptions = [
  { value: "yearName", label: "ปีการศึกษา" },
  { value: "startDate", label: "วันที่เริ่มต้น" },
  { value: "projectCount", label: "จำนวนโครงการ" },
  { value: "budgetPlanStatus", label: "สถานะแผนงบประมาณ" },
  { value: "updatedAt", label: "อัปเดตล่าสุด" },
];

export function AcademicYearsClient({ data }: { data: AcademicYearsPageData }) {
  const router = useRouter();
  const [selectedYearId, setSelectedYearId] = useState<string | null>(
    data.currentYear?.id ?? data.years[0]?.id ?? null,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYearListItem | null>(null);
  const [confirmCurrentTarget, setConfirmCurrentTarget] = useState<AcademicYearListItem | null>(
    null,
  );
  const [confirmDisableTarget, setConfirmDisableTarget] = useState<AcademicYearListItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AcademicYearListItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    yearName: "",
    startDate: "",
    endDate: "",
    isActive: false,
  });

  const { appliedValues, draftValues, isPending, setValue, reset, goToPage } =
    useListControls({
      initialValues: data.filters,
      defaults: defaultQueryValues,
    });

  const selectedYear =
    data.years.find((year) => year.id === selectedYearId) ?? data.currentYear ?? data.years[0] ?? null;
  const pageStart = data.total === 0 ? 0 : (data.page - 1) * data.limit + 1;
  const pageEnd = Math.min(data.page * data.limit, data.total);

  const openCreate = () => {
    setEditingYear(null);
    setFormState({ yearName: "", startDate: "", endDate: "", isActive: false });
    setError(null);
    setMessage(null);
    setIsFormOpen(true);
  };

  const openEdit = (year: AcademicYearListItem) => {
    setEditingYear(year);
    setFormState({
      yearName: year.yearName,
      startDate: toDateInputValue(year.startDate),
      endDate: toDateInputValue(year.endDate),
      isActive: year.isActive,
    });
    setError(null);
    setMessage(null);
    setIsFormOpen(true);
  };

  const saveYear = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validateForm(formState, editingYear);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (formState.isActive && data.currentYear && data.currentYear.id !== editingYear?.id) {
      const target =
        editingYear ??
        ({
          id: "__new__",
          yearName: formState.yearName.trim(),
          startDate: formState.startDate || null,
          endDate: formState.endDate || null,
          isActive: false,
          strategyCount: 0,
          projectCount: 0,
          purchaseRequestCount: 0,
          budgetPlanCount: 0,
          budgetPlanStatus: null,
          budgetPlanStatusLabel: "ยังไม่มีแผนงบประมาณ",
          budgetPlanName: null,
          budgetPlanUpdatedAt: null,
          createdAt: null,
          createdBy: null,
          updatedAt: null,
          updatedBy: null,
          projectStatusCounts: { draft: 0, submitted: 0, reviewed: 0, approved: 0, rejected: 0 },
          canDelete: false,
        } satisfies AcademicYearListItem);
      setConfirmCurrentTarget(target);
      return;
    }

    await persistYear();
  };

  const persistYear = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        yearName: formState.yearName.trim(),
        startDate: formState.startDate ? new Date(formState.startDate).toISOString() : null,
        endDate: formState.endDate ? new Date(formState.endDate).toISOString() : null,
        isActive: formState.isActive,
      };

      const response = await fetch(
        editingYear ? `/api/academic-years/${editingYear.id}` : "/api/academic-years",
        {
          method: editingYear ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      }

      setIsFormOpen(false);
      setConfirmCurrentTarget(null);
      setMessage(editingYear ? "อัปเดตปีการศึกษาเรียบร้อยแล้ว" : "สร้างปีการศึกษาใหม่เรียบร้อยแล้ว");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const setAsCurrent = async (year: AcademicYearListItem) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/academic-years/${year.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearName: year.yearName,
          startDate: year.startDate,
          endDate: year.endDate,
          isActive: true,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "ไม่สามารถตั้งปีการศึกษาปัจจุบันได้");
      }

      setConfirmCurrentTarget(null);
      setMessage(`ตั้งปีการศึกษา ${year.yearName} เป็นปีปัจจุบันแล้ว`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถตั้งปีการศึกษาปัจจุบันได้");
    } finally {
      setLoading(false);
    }
  };

  const disableYear = async (year: AcademicYearListItem) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/academic-years/${year.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearName: year.yearName,
          startDate: year.startDate,
          endDate: year.endDate,
          isActive: false,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "ไม่สามารถปิดการใช้งานปีการศึกษาได้");
      }

      setConfirmDisableTarget(null);
      setMessage(`ปิดการใช้งานปีการศึกษา ${year.yearName} เรียบร้อยแล้ว`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถปิดการใช้งานปีการศึกษาได้");
    } finally {
      setLoading(false);
    }
  };

  const deleteYear = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/academic-years/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "ไม่สามารถลบปีการศึกษาได้");
      }

      setDeleteTarget(null);
      setMessage(`ลบปีการศึกษา ${deleteTarget.yearName} เรียบร้อยแล้ว`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถลบปีการศึกษาได้");
    } finally {
      setLoading(false);
    }
  };

  const applyQuickFilter = (status: string, hasBudgetPlan: string) => {
    if (!status && !hasBudgetPlan) {
      reset();
      return;
    }
    setValue("status", status);
    setValue("hasBudgetPlan", hasBudgetPlan);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
              ปีการศึกษา
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              จัดการปีการศึกษาที่ใช้กับโครงการ แผนงบประมาณ และคำขอจัดซื้อของโรงเรียน
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" />
              {data.currentYear
                ? `ปีการศึกษาปัจจุบัน: ${data.currentYear.yearName}`
                : "ยังไม่ได้ตั้งปีการศึกษาปัจจุบัน"}
            </div>
          </div>
          {data.canManage ? (
            <Button onClick={openCreate} className="w-full gap-2 rounded-lg sm:w-auto">
              <FilePlus2 className="size-4" />
              สร้างปีการศึกษาใหม่
            </Button>
          ) : (
            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              บัญชีนี้ดูข้อมูลได้แบบอ่านอย่างเดียว
            </div>
          )}
        </div>
      </section>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      )}
      {error && !isFormOpen && !confirmCurrentTarget && !confirmDisableTarget && !deleteTarget && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <CurrentYearHero
        year={data.currentYear}
        canManage={data.canManage}
        onCreate={openCreate}
        onEdit={openEdit}
      />

      <SummaryCards summary={data.summary} />

      <section className="rounded-lg border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Search className="size-4" />
              ตัวกรองรายการปีการศึกษา
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              แสดง {pageStart}-{pageEnd} จาก {data.total} ปีการศึกษา
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => {
              const active =
                appliedValues.status === filter.status &&
                appliedValues.hasBudgetPlan === filter.hasBudgetPlan;
              return (
                <button
                  key={`${filter.label}-${filter.status}-${filter.hasBudgetPlan}`}
                  type="button"
                  onClick={() => applyQuickFilter(filter.status, filter.hasBudgetPlan)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-primary",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(160px,1fr))]">
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">ค้นหา</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={draftValues.q}
                onChange={(event) => setValue("q", event.target.value)}
                placeholder="ค้นหาปีการศึกษา เช่น 2569"
                className="pl-9"
              />
            </div>
          </label>

          <FilterSelect
            label="สถานะ"
            value={draftValues.status}
            onChange={(value) => setValue("status", value)}
            options={statusOptions}
          />

          <FilterSelect
            label="แผนงบประมาณ"
            value={draftValues.hasBudgetPlan}
            onChange={(value) => setValue("hasBudgetPlan", value)}
            options={[
              { value: "", label: "ทั้งหมด" },
              { value: "1", label: "มีแผนงบประมาณแล้ว" },
            ]}
          />

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <FilterSelect
              label="เรียงลำดับ"
              value={draftValues.sortBy}
              onChange={(value) =>
                setValue("sortBy", value as AcademicYearsQueryValues["sortBy"])
              }
              options={sortOptions}
            />
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">ทิศทาง</span>
              <button
                type="button"
                onClick={() =>
                  setValue("sortDir", draftValues.sortDir === "asc" ? "desc" : "asc")
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-background/90 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                {draftValues.sortDir === "asc" ? (
                  <ArrowUpAZ className="size-4" />
                ) : (
                  <ArrowDownAZ className="size-4" />
                )}
              </button>
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={reset}
            disabled={isPending}
            className="rounded-lg"
          >
            ล้างตัวกรอง
          </Button>
        </div>
      </section>

      {selectedYear && (
        <YearDetailPanel
          year={selectedYear}
          canManage={data.canManage}
          onEdit={openEdit}
        />
      )}

      <section className="rounded-lg border border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <div className="border-b border-border/70 px-5 py-4">
          <h2 className="text-base font-bold text-primary">รายการปีการศึกษา</h2>
        </div>

        {data.years.length === 0 ? (
          <div className="p-8">
            <EmptyState
              canManage={data.canManage}
              onCreate={openCreate}
              hasAnyData={data.summary.total > 0}
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs font-bold text-muted-foreground">
                    <th className="p-4">ปีการศึกษา</th>
                    <th className="p-4">ช่วงวันที่</th>
                    <th className="p-4">สถานะ</th>
                    <th className="p-4">ปีปัจจุบัน</th>
                    <th className="p-4 text-right">จำนวนโครงการ</th>
                    <th className="p-4">แผนงบประมาณ</th>
                    <th className="p-4">อัปเดตล่าสุด</th>
                    <th className="p-4 text-right">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.years.map((year) => (
                    <tr
                      key={year.id}
                      className={cn(
                        "hover:bg-muted/15",
                        selectedYear?.id === year.id && "bg-primary/5",
                      )}
                    >
                      <td className="p-4">
                        <div className="font-bold text-foreground">ปีการศึกษา {year.yearName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          กลยุทธ์ {year.strategyCount} รายการ
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatDateRange(year.startDate, year.endDate)}
                      </td>
                      <td className="p-4">
                        <ActiveBadge isActive={year.isActive} />
                      </td>
                      <td className="p-4">
                        {year.isActive ? (
                          <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary">
                            ใช่
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-foreground">
                        {year.projectCount} โครงการ
                      </td>
                      <td className="p-4">
                        <BudgetPlanBadge status={year.budgetPlanStatus} label={year.budgetPlanStatusLabel} />
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {year.updatedAt ? formatThaiDate(year.updatedAt) : "ยังไม่มีข้อมูล"}
                      </td>
                      <td className="p-4">
                        <RowActions
                          year={year}
                          canManage={data.canManage}
                          onSelect={setSelectedYearId}
                          onEdit={openEdit}
                          onSetCurrent={setConfirmCurrentTarget}
                          onDisable={setConfirmDisableTarget}
                          onDelete={setDeleteTarget}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {data.years.map((year) => (
                <MobileYearCard
                  key={year.id}
                  year={year}
                  selected={selectedYear?.id === year.id}
                  canManage={data.canManage}
                  onSelect={setSelectedYearId}
                  onEdit={openEdit}
                  onSetCurrent={setConfirmCurrentTarget}
                  onDisable={setConfirmDisableTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                แสดง {pageStart}-{pageEnd} จาก {data.total} รายการ
              </span>
              <div className="flex items-center gap-1">
                <PaginationButton
                  onClick={() => goToPage(1)}
                  disabled={isPending || data.page <= 1}
                  icon={<ChevronsLeft className="size-4" />}
                />
                <PaginationButton
                  onClick={() => goToPage(data.page - 1)}
                  disabled={isPending || data.page <= 1}
                  icon={<ChevronLeft className="size-4" />}
                />
                <span className="mx-2 text-sm font-bold text-foreground">
                  หน้า {data.page} / {data.totalPages}
                </span>
                <PaginationButton
                  onClick={() => goToPage(data.page + 1)}
                  disabled={isPending || data.page >= data.totalPages}
                  icon={<ChevronRight className="size-4" />}
                />
                <PaginationButton
                  onClick={() => goToPage(data.totalPages)}
                  disabled={isPending || data.page >= data.totalPages}
                  icon={<ChevronsRight className="size-4" />}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {isFormOpen && (
        <AcademicYearFormModal
          canManage={data.canManage}
          editingYear={editingYear}
          formState={formState}
          setFormState={setFormState}
          error={error}
          loading={loading}
          onClose={() => {
            if (loading) return;
            setIsFormOpen(false);
            setError(null);
          }}
          onSubmit={saveYear}
        />
      )}

      {confirmCurrentTarget && (
        <ConfirmModal
          title="ตั้งเป็นปีการศึกษาปัจจุบัน"
          description={
            <>
              ระบบจะใช้ปีการศึกษานี้เป็นค่าเริ่มต้นสำหรับ dashboard, โครงการ,
              แผนงบประมาณ และคำขอจัดซื้อ
            </>
          }
          warning={
            data.currentYear && data.currentYear.id !== confirmCurrentTarget.id
              ? `ปีปัจจุบันเดิม: ${data.currentYear.yearName} · ปีใหม่ที่จะตั้ง: ${confirmCurrentTarget.yearName}`
              : "การเปลี่ยนปีการศึกษาปัจจุบันอาจทำให้ข้อมูลที่แสดงใน dashboard และรายการโครงการเปลี่ยนไป"
          }
          error={error}
          loading={loading}
          confirmLabel="ยืนยันตั้งเป็นปีปัจจุบัน"
          onClose={() => {
            if (loading) return;
            setConfirmCurrentTarget(null);
            setError(null);
          }}
          onConfirm={() => {
            if (editingYear?.id === confirmCurrentTarget.id || confirmCurrentTarget.id === "__new__") {
              persistYear();
            } else {
              setAsCurrent(confirmCurrentTarget);
            }
          }}
        />
      )}

      {confirmDisableTarget && (
        <ConfirmModal
          title="ปิดการใช้งานปีการศึกษา"
          description={
            <>
              การปิดการใช้งานจะทำให้ปีนี้ไม่ถูกใช้เป็นค่าเริ่มต้นในการสร้างข้อมูลใหม่
            </>
          }
          warning={
            <>
              ตรวจสอบโครงการค้างอยู่ แผนงบประมาณ และคำขอจัดซื้อที่ยังไม่เสร็จก่อนยืนยัน
            </>
          }
          error={error}
          loading={loading}
          confirmLabel="ยืนยันปิดการใช้งาน"
          confirmTone="warning"
          onClose={() => {
            if (loading) return;
            setConfirmDisableTarget(null);
            setError(null);
          }}
          onConfirm={() => disableYear(confirmDisableTarget)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="ยืนยันการลบปีการศึกษา"
          description={
            <>
              การลบปีการศึกษา <strong>{deleteTarget.yearName}</strong> จะย้อนกลับไม่ได้
            </>
          }
          warning={
            deleteTarget.canDelete
              ? "ไม่พบโครงการ แผนงบประมาณ หรือคำขอจัดซื้อที่เชื่อมโยง สามารถลบได้"
              : "ยังมีข้อมูลที่เชื่อมโยงอยู่ จึงไม่ควรลบปีการศึกษานี้"
          }
          error={error}
          loading={loading}
          confirmLabel="ยืนยันลบข้อมูล"
          confirmTone="danger"
          disableConfirm={!deleteTarget.canDelete}
          onClose={() => {
            if (loading) return;
            setDeleteTarget(null);
            setError(null);
          }}
          onConfirm={deleteYear}
        />
      )}
    </div>
  );
}

function CurrentYearHero({
  year,
  canManage,
  onCreate,
  onEdit,
}: {
  year: AcademicYearListItem | null;
  canManage: boolean;
  onCreate: () => void;
  onEdit: (year: AcademicYearListItem) => void;
}) {
  if (!year) {
    return (
      <Card className="rounded-lg border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">ยังไม่ได้ตั้งปีการศึกษาปัจจุบัน</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              กรุณาสร้างหรือเลือกปีการศึกษาเพื่อให้ระบบใช้เป็นค่าเริ่มต้นสำหรับโครงการและงบประมาณ
            </p>
          </div>
          {canManage && (
            <Button onClick={onCreate} className="w-full gap-2 rounded-lg sm:w-auto">
              <FilePlus2 className="size-4" />
              สร้างปีการศึกษาใหม่
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-lg border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-primary/70">ปีการศึกษาปัจจุบัน</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-primary">
              ปีการศึกษา {year.yearName}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActiveBadge isActive />
              <BudgetPlanBadge status={year.budgetPlanStatus} label={year.budgetPlanStatusLabel} />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <QuickLinkButton href={`/projects?academicYearId=${year.id}`} icon={<FolderKanban className="size-4" />}>
              ดูโครงการปีนี้
            </QuickLinkButton>
            <QuickLinkButton href={`/budget?yearId=${year.id}`} icon={<Wallet className="size-4" />}>
              ดูงบประมาณปีนี้
            </QuickLinkButton>
            <QuickLinkButton href="/procurement" icon={<Banknote className="size-4" />}>
              ดูคำขอจัดซื้อ
            </QuickLinkButton>
            {canManage && (
              <Button variant="outline" className="gap-2 rounded-lg" onClick={() => onEdit(year)}>
                <PencilLine className="size-4" />
                แก้ไขปีการศึกษา
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <HeroMetric icon={<CalendarDays className="size-4" />} label="วันที่เริ่มต้น" value={formatThaiDate(year.startDate)} />
          <HeroMetric icon={<Clock3 className="size-4" />} label="วันที่สิ้นสุด" value={formatThaiDate(year.endDate)} />
          <HeroMetric icon={<FolderKanban className="size-4" />} label="โครงการทั้งหมด" value={`${year.projectCount} โครงการ`} />
          <HeroMetric icon={<Wallet className="size-4" />} label="แผนงบประมาณ" value={year.budgetPlanStatusLabel} />
          <HeroMetric icon={<Banknote className="size-4" />} label="คำขอจัดซื้อ" value={`${year.purchaseRequestCount} รายการ`} />
          <HeroMetric icon={<History className="size-4" />} label="อัปเดตล่าสุด" value={year.updatedAt ? formatThaiDate(year.updatedAt) : "ยังไม่มีข้อมูล"} />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCards({
  summary,
}: {
  summary: AcademicYearsPageData["summary"];
}) {
  const cards = [
    {
      label: "ปีการศึกษาทั้งหมด",
      helper: "รวมปีการศึกษาที่บันทึกในระบบ",
      value: summary.total,
      icon: <Landmark className="size-5" />,
      tone: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "เปิดใช้งาน",
      helper: "พร้อมใช้กับข้อมูลใหม่ของระบบ",
      value: summary.active,
      icon: <Check className="size-5" />,
      tone: "text-emerald-700",
      bg: "bg-emerald-100",
    },
    {
      label: "ปีปัจจุบัน",
      helper: "ระบบจะใช้เป็นค่าเริ่มต้น",
      value: summary.current,
      icon: <Sparkles className="size-5" />,
      tone: "text-blue-700",
      bg: "bg-blue-100",
    },
    {
      label: "ปีที่ปิดการใช้งาน",
      helper: "ยังเก็บไว้เป็นข้อมูลอ้างอิง",
      value: summary.inactive,
      icon: <Clock3 className="size-5" />,
      tone: "text-slate-700",
      bg: "bg-slate-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="rounded-lg border-border/70 bg-card/90 shadow-sm">
          <CardContent className="flex items-start gap-4 p-5">
            <div className={cn("rounded-lg p-3", card.bg, card.tone)}>{card.icon}</div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
              <p className={cn("mt-1 text-3xl font-bold", card.tone)}>{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function YearDetailPanel({
  year,
  canManage,
  onEdit,
}: {
  year: AcademicYearListItem;
  canManage: boolean;
  onEdit: (year: AcademicYearListItem) => void;
}) {
  return (
    <Card className="rounded-lg border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base text-primary">
              รายละเอียดปีการศึกษา {year.yearName}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              ข้อมูลสรุปที่ใช้ติดตามความพร้อมของปีการศึกษาในระบบ
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickLinkButton href={`/projects?academicYearId=${year.id}`} icon={<FolderKanban className="size-4" />}>
              ดูโครงการของปีนี้
            </QuickLinkButton>
            <QuickLinkButton href={`/budget?yearId=${year.id}`} icon={<Wallet className="size-4" />}>
              ดูงบประมาณของปีนี้
            </QuickLinkButton>
            <QuickLinkButton href="/procurement" icon={<Banknote className="size-4" />}>
              ดูคำขอจัดซื้อ
            </QuickLinkButton>
            {canManage && (
              <Button variant="outline" className="gap-2 rounded-lg" onClick={() => onEdit(year)}>
                <PencilLine className="size-4" />
                แก้ไขปีการศึกษา
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailStat label="ช่วงวันที่" value={formatDateRange(year.startDate, year.endDate)} />
            <DetailStat label="สถานะ" value={year.isActive ? "ปีปัจจุบัน / เปิดใช้งาน" : "ปิดการใช้งาน"} />
            <DetailStat label="แผนงบประมาณ" value={year.budgetPlanStatusLabel} />
            <DetailStat label="คำขอจัดซื้อ" value={`${year.purchaseRequestCount} รายการ`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MiniMetric label="ร่าง" value={year.projectStatusCounts.draft} />
            <MiniMetric label="รอตรวจ" value={year.projectStatusCounts.submitted} />
            <MiniMetric label="รออนุมัติ" value={year.projectStatusCounts.reviewed} />
            <MiniMetric label="อนุมัติแล้ว" value={year.projectStatusCounts.approved} />
            <MiniMetric label="ตีกลับ" value={year.projectStatusCounts.rejected} />
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4 text-sm">
          <InfoRow label="สร้างเมื่อ" value={year.createdAt ? formatThaiDate(year.createdAt) : "ยังไม่มีข้อมูล"} />
          <InfoRow label="ผู้สร้าง" value={year.createdBy ?? "ยังไม่มีข้อมูล"} />
          <InfoRow label="อัปเดตล่าสุด" value={year.updatedAt ? formatThaiDate(year.updatedAt) : "ยังไม่มีข้อมูล"} />
          <InfoRow label="ผู้แก้ไขล่าสุด" value={year.updatedBy ?? "ยังไม่มีข้อมูล"} />
        </div>
      </CardContent>
    </Card>
  );
}

function RowActions({
  year,
  canManage,
  onSelect,
  onEdit,
  onSetCurrent,
  onDisable,
  onDelete,
}: {
  year: AcademicYearListItem;
  canManage: boolean;
  onSelect: (id: string) => void;
  onEdit: (year: AcademicYearListItem) => void;
  onSetCurrent: (year: AcademicYearListItem) => void;
  onDisable: (year: AcademicYearListItem) => void;
  onDelete: (year: AcademicYearListItem) => void;
}) {
  return (
    <div className="flex justify-end gap-1.5">
      <ActionButton onClick={() => onSelect(year.id)} icon={<Eye className="size-4" />}>
        ดูรายละเอียด
      </ActionButton>
      {canManage && (
        <>
          <ActionButton onClick={() => onEdit(year)} icon={<PencilLine className="size-4" />}>
            แก้ไข
          </ActionButton>
          {!year.isActive && (
            <ActionButton onClick={() => onSetCurrent(year)} icon={<Check className="size-4" />}>
              ตั้งเป็นปีปัจจุบัน
            </ActionButton>
          )}
          {year.isActive && (
            <ActionButton onClick={() => onDisable(year)} icon={<Clock3 className="size-4" />}>
              ปิดการใช้งาน
            </ActionButton>
          )}
          <ActionButton
            onClick={() => onDelete(year)}
            icon={<Trash2 className="size-4" />}
            tone="danger"
            disabled={!year.canDelete}
          >
            ลบ
          </ActionButton>
        </>
      )}
    </div>
  );
}

function MobileYearCard({
  year,
  selected,
  canManage,
  onSelect,
  onEdit,
  onSetCurrent,
  onDisable,
  onDelete,
}: {
  year: AcademicYearListItem;
  selected: boolean;
  canManage: boolean;
  onSelect: (id: string) => void;
  onEdit: (year: AcademicYearListItem) => void;
  onSetCurrent: (year: AcademicYearListItem) => void;
  onDisable: (year: AcademicYearListItem) => void;
  onDelete: (year: AcademicYearListItem) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className={cn("rounded-lg border-border/70", selected && "border-primary/40 bg-primary/5")}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-foreground">ปีการศึกษา {year.yearName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateRange(year.startDate, year.endDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg border border-border/70 p-2 text-muted-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActiveBadge isActive={year.isActive} />
          {year.isActive && (
            <span className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary">
              ปีปัจจุบัน
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <InfoRow label="โครงการ" value={`${year.projectCount} โครงการ`} compact />
          <InfoRow label="แผนงบ" value={year.budgetPlanStatusLabel} compact />
        </div>

        {open && (
          <div className="space-y-3 border-t border-border/50 pt-3">
            <div className="space-y-2 text-sm">
              <InfoRow label="คำขอจัดซื้อ" value={`${year.purchaseRequestCount} รายการ`} compact />
              <InfoRow label="อัปเดตล่าสุด" value={year.updatedAt ? formatThaiDate(year.updatedAt) : "ยังไม่มีข้อมูล"} compact />
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => onSelect(year.id)} icon={<Eye className="size-4" />}>
                ดูรายละเอียด
              </ActionButton>
              {canManage && (
                <>
                  <ActionButton onClick={() => onEdit(year)} icon={<PencilLine className="size-4" />}>
                    แก้ไข
                  </ActionButton>
                  {!year.isActive && (
                    <ActionButton onClick={() => onSetCurrent(year)} icon={<Check className="size-4" />}>
                      ตั้งเป็นปีปัจจุบัน
                    </ActionButton>
                  )}
                  {year.isActive && (
                    <ActionButton onClick={() => onDisable(year)} icon={<Clock3 className="size-4" />}>
                      ปิดการใช้งาน
                    </ActionButton>
                  )}
                  <ActionButton onClick={() => onDelete(year)} icon={<Trash2 className="size-4" />} tone="danger" disabled={!year.canDelete}>
                    ลบ
                  </ActionButton>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AcademicYearFormModal({
  canManage,
  editingYear,
  formState,
  setFormState,
  error,
  loading,
  onClose,
  onSubmit,
}: {
  canManage: boolean;
  editingYear: AcademicYearListItem | null;
  formState: {
    yearName: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
  setFormState: React.Dispatch<
    React.SetStateAction<{
      yearName: string;
      startDate: string;
      endDate: string;
      isActive: boolean;
    }>
  >;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  if (!canManage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
          <h2 className="text-lg font-bold text-primary">
            {editingYear ? "แก้ไขปีการศึกษา" : "สร้างปีการศึกษาใหม่"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">ปีการศึกษา</span>
            <Input
              placeholder="เช่น 2569"
              value={formState.yearName}
              onChange={(event) =>
                setFormState((current) => ({ ...current, yearName: event.target.value }))
              }
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">วันที่เริ่มต้น</span>
              <Input
                type="date"
                value={formState.startDate}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">วันที่สิ้นสุด</span>
              <Input
                type="date"
                value={formState.endDate}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() =>
              setFormState((current) => ({ ...current, isActive: !current.isActive }))
            }
            className="flex w-full items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 text-left hover:bg-muted/30"
          >
            <input
              type="checkbox"
              checked={formState.isActive}
              onChange={() => {}}
              className="mt-0.5 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">ใช้ปีนี้เป็นปีการศึกษาปัจจุบันของระบบ</p>
              <p className="mt-1 text-xs text-muted-foreground">
                เมื่อเปิดใช้งาน ระบบจะปิดการใช้งานปีอื่นอัตโนมัติให้เหลือเพียงปีปัจจุบันหนึ่งปี
              </p>
            </div>
          </button>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[120px] gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  warning,
  error,
  loading,
  confirmLabel,
  confirmTone = "primary",
  disableConfirm = false,
  onClose,
  onConfirm,
}: {
  title: string;
  description: ReactNode;
  warning: ReactNode;
  error: string | null;
  loading: boolean;
  confirmLabel: string;
  confirmTone?: "primary" | "warning" | "danger";
  disableConfirm?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
          <h2 className="text-lg font-bold text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}
          <p className="text-sm leading-relaxed text-foreground">{description}</p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-900">
            {warning}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={loading || disableConfirm}
              className={cn(
                "min-w-[150px] gap-2",
                confirmTone === "warning" && "bg-amber-600 text-white hover:bg-amber-700",
                confirmTone === "danger" && "bg-destructive text-white hover:bg-destructive/90",
              )}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "กำลังบันทึก..." : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-background/90 px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({
  canManage,
  onCreate,
  hasAnyData,
}: {
  canManage: boolean;
  onCreate: () => void;
  hasAnyData: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Landmark className="size-6" />
      </div>
      <h3 className="mt-3 text-base font-bold text-foreground">
        {hasAnyData ? "ไม่พบปีการศึกษาตามเงื่อนไข" : "ยังไม่มีปีการศึกษา"}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {hasAnyData
          ? "ลองล้างตัวกรองหรือเปลี่ยนคำค้นหาเพื่อดูรายการทั้งหมด"
          : canManage
            ? "เริ่มสร้างปีการศึกษาแรก เพื่อใช้เป็นข้อมูลตั้งต้นสำหรับโครงการ แผนงบประมาณ และคำขอจัดซื้อ"
            : "เมื่อผู้ดูแลระบบสร้างปีการศึกษา รายการจะแสดงที่นี่"}
      </p>
      {!hasAnyData && canManage && (
        <Button onClick={onCreate} className="mt-4 gap-2 rounded-lg">
          <FilePlus2 className="size-4" />
          สร้างปีการศึกษาใหม่
        </Button>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
  tone = "default",
  disabled = false,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-border/70 bg-background/80 text-muted-foreground hover:border-primary/30 hover:text-primary",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function QuickLinkButton({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Button asChild variant="outline" className="gap-2 rounded-lg">
      <Link href={href}>
        {icon}
        {children}
      </Link>
    </Button>
  );
}

function PaginationButton({
  onClick,
  disabled,
  icon,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
    </button>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-center">
      <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      เปิดใช้งาน
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      ปิดการใช้งาน
    </span>
  );
}

function BudgetPlanBadge({
  status,
  label,
}: {
  status: string | null;
  label: string;
}) {
  const tone =
    status === "LOCKED"
      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
      : status === "APPROVED"
        ? "border-blue-200 bg-blue-100 text-blue-800"
        : status === "SUBMITTED"
          ? "border-amber-200 bg-amber-100 text-amber-800"
          : status === "REJECTED"
            ? "border-rose-200 bg-rose-100 text-rose-800"
            : status === "DRAFT"
              ? "border-slate-200 bg-slate-100 text-slate-700"
              : "border-border/70 bg-muted/20 text-muted-foreground";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", tone)}>
      {label}
    </span>
  );
}

function InfoRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", !compact && "border-b border-border/40 py-2 last:border-0")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

function validateForm(
  formState: { yearName: string; startDate: string; endDate: string; isActive: boolean },
  editingYear: AcademicYearListItem | null,
) {
  const year = formState.yearName.trim();
  if (!year) return "กรุณาระบุปีการศึกษา";
  if (!/^\d{4}$/.test(year)) return "ปีการศึกษาต้องเป็นตัวเลข 4 หลัก";
  if (!formState.startDate) return "กรุณาระบุวันที่เริ่มต้น";
  if (!formState.endDate) return "กรุณาระบุวันที่สิ้นสุด";
  if (new Date(formState.endDate) <= new Date(formState.startDate)) {
    return "วันที่สิ้นสุดต้องมากกว่าวันที่เริ่มต้น";
  }
  if (editingYear && editingYear.isActive && !formState.isActive) {
    return null;
  }
  return null;
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  return `${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}`;
}
