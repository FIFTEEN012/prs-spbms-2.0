"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchFilterBar, type ActiveFilterSummary } from "@/components/ui/search-filter-bar";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { cn, formatBaht } from "@/lib/utils";
import {
  defaultProjectListQueryValues,
  type ProjectListQueryValues,
  type ProjectRow,
} from "@/lib/project-list-service";
import { useListControls } from "@/lib/use-list-controls";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "ส่งขออนุมัติ",
  REVIEWED: "ตรวจสอบแล้ว",
  APPROVED: "อนุมัติ",
  REJECTED: "ตีกลับ",
  IN_PROGRESS: "ดำเนินการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  REVIEWED: "bg-indigo-100 text-indigo-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-300 text-gray-700",
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, search: string) {
  if (!search) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${escapeRegExp(search)})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-yellow-100 text-yellow-950 font-semibold rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

interface ProjectsClientProps {
  projects: ProjectRow[];
  departments: Array<{ id: string; name: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  initialQuery: ProjectListQueryValues;
  bulkSubmitButtonElement?: React.ReactNode;
}

export function ProjectsClient({
  projects,
  departments,
  total,
  page,
  limit,
  totalPages,
  initialQuery,
  bulkSubmitButtonElement,
}: ProjectsClientProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedProjectIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedProjectIds(next);
  };

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
    defaults: defaultProjectListQueryValues,
  });

  useEffect(() => {
    if (appliedValues.q) {
      const matchingIds = new Set<string>();
      projects.forEach((project) => {
        const hasMatchingActivity = project.activities.some((activity) =>
          activity.name.toLowerCase().includes(appliedValues.q.toLowerCase())
        );
        if (hasMatchingActivity) {
          matchingIds.add(project.id);
        }
      });
      if (matchingIds.size > 0) {
        setExpandedProjectIds((prev) => {
          const next = new Set(prev);
          matchingIds.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [appliedValues.q, projects]);

  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: department.name,
  }));

  const sortOptions = [
    { value: "createdAt", label: "วันที่สร้างล่าสุด" },
    { value: "updatedAt", label: "วันที่อัปเดตล่าสุด" },
    { value: "projectName", label: "ชื่อโครงการ" },
    { value: "projectCode", label: "รหัสโครงการ" },
    { value: "budgetRequested", label: "งบเสนอขอ" },
    { value: "budgetApproved", label: "งบอนุมัติ" },
    { value: "status", label: "สถานะ" },
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
        value: STATUS_LABELS[appliedValues.status] ?? appliedValues.status,
      });
    }

    if (appliedValues.departmentId) {
      const department = departments.find(
        (item) => item.id === appliedValues.departmentId,
      );
      items.push({
        key: "departmentId",
        label: "ฝ่าย/กลุ่มงาน",
        value: department?.name ?? appliedValues.departmentId,
      });
    }

    return items;
  }, [appliedValues, departments]);

  const deletableProjects = projects.filter((project) => project.canDelete);
  const selectedProjects = projects.filter((project) => selectedIds.has(project.id));
  const allSelectableChecked =
    deletableProjects.length > 0 && selectedIds.size === deletableProjects.length;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletableProjects.map((project) => project.id)));
    }
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/projects/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: Array.from(selectedIds) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการลบโครงการ");
      }

      setSuccess(`ลบโครงการสำเร็จ ${data.count} รายการ`);
      setSelectedIds(new Set());
      router.refresh();

      setTimeout(() => {
        setIsConfirmOpen(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setIsConfirmOpen(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <SearchFilterBar
        searchValue={draftValues.q}
        onSearchChange={(value) => setValue("q", value)}
        searchPlaceholder="ค้นหาชื่อโครงการ, รหัส, ผู้รับผิดชอบ..."
        filters={[
          {
            type: "select",
            key: "status",
            label: "สถานะ",
            options: statusOptions,
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
        filteredCount={projects.length}
        isLoading={isPending}
        isDirty={isDirty}
        onReset={reset}
        activeFilters={activeFilters}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {selectedIds.size > 0 && (
          <Button
            key="delete-selected-btn"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setIsConfirmOpen(true);
            }}
            variant="destructive"
            className="w-full gap-1.5 rounded-xl px-4 py-2 font-bold shadow-md transition-all sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            ลบโครงการที่เลือก ({selectedIds.size})
          </Button>
        )}
        {bulkSubmitButtonElement}
      </div>

      <PaginationControls
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={goToPage}
        disabled={isPending}
      />

      {deletableProjects.length > 0 && (
        <Card className="rounded-2xl border-border/70 shadow-sm md:hidden">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={allSelectableChecked}
                onChange={toggleSelectAll}
              />
              เลือกทั้งหมด
            </label>
            <span className="text-xs text-muted-foreground">
              เลือกแล้ว {selectedIds.size} รายการ
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="hidden overflow-hidden rounded-2xl border-border/70 shadow-sm md:block">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-muted-foreground">
                <th className="w-10 p-3 text-center">
                  {deletableProjects.length > 0 && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={allSelectableChecked}
                      onChange={toggleSelectAll}
                    />
                  )}
                </th>
                <th className="p-3">ชื่อโครงการ / รหัส</th>
                <th className="p-3">ฝ่าย</th>
                <th className="p-3">ผู้รับผิดชอบ</th>
                <th className="p-3 text-right">งบอนุมัติ</th>
                <th className="p-3 text-right">ใช้สุทธิ / จำนวนครั้ง</th>
                <th className="p-3 text-right">งบคงเหลือ</th>
                <th className="min-w-[140px] p-3">ความคืบหน้างบประมาณ</th>
                <th className="p-3">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    ไม่พบรายการที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
              {projects.map((project) => {
                const isSelected = selectedIds.has(project.id);
                const budgetDisplay = getBudgetDisplay(project);
                const progress = getBudgetProgress(project);

                return (
                  <Fragment key={project.id}>
                    <tr
                      className={cn(
                        "border-b transition-colors hover:bg-muted/30",
                        isSelected && "bg-muted/20",
                      )}
                    >
                    <td className="p-3 text-center">
                      {project.canDelete ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={isSelected}
                          onChange={() => toggleSelect(project.id)}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-not-allowed rounded border-gray-300 opacity-20"
                          disabled
                          title="คุณไม่มีสิทธิ์ลบโครงการนี้"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleExpand(project.id)}
                          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="ดูกิจกรรมย่อย"
                        >
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transform transition-transform duration-200",
                              expandedProjectIds.has(project.id) && "rotate-90 text-primary"
                            )}
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 font-mono text-[10px] leading-none text-muted-foreground">
                            {highlightText(project.projectCode, appliedValues.q)}
                          </div>
                          <Link
                            href={`/projects/${project.id}`}
                            className="block text-sm font-bold text-primary hover:underline"
                          >
                            {highlightText(project.projectName, appliedValues.q)}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{project.departmentName}</td>
                    <td className="p-3 text-xs">{project.responsibleFullName}</td>
                    <td className="p-3 text-right font-mono text-xs font-semibold">
                      {formatBaht(budgetDisplay)}
                    </td>
                    <td className="p-3 text-right text-xs">
                      {progress ? (
                        <Link
                          href={`/projects/${project.id}#budget-history`}
                          className="inline-flex flex-col items-end hover:underline"
                        >
                          <span className="font-mono font-semibold text-red-600">
                            {formatBaht(project.budgetNetSpent)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ใช้จ่าย {project.expenseCount} ครั้ง
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-xs font-semibold">
                      {progress ? (
                        <Link
                          href={`/projects/${project.id}#budget-history`}
                          className={cn(
                            "hover:underline",
                            project.budgetRemaining < 0
                              ? "font-bold text-red-600"
                              : project.budgetRemaining <= project.budgetApproved * 0.15
                                ? "font-bold text-amber-600"
                                : "text-emerald-600",
                          )}
                        >
                          {formatBaht(project.budgetRemaining)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {progress ? (
                        <BudgetProgressBar percentUsed={progress.percentUsed} />
                      ) : (
                        <div className="text-[10px] italic text-muted-foreground">
                          ยังไม่ตั้งงบใช้จ่าย
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[project.status]}`}
                      >
                        {STATUS_LABELS[project.status]}
                      </span>
                    </td>
                  </tr>
                  {expandedProjectIds.has(project.id) && (
                    <tr className="bg-muted/5 border-b">
                      <td />
                      <td colSpan={8} className="p-3">
                        <div className="rounded-xl border bg-background p-4 shadow-inner">
                          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <span>📂</span> กิจกรรมย่อย ({project.activities.length})
                          </h4>
                          {project.activities.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">ไม่มีกิจกรรมย่อยในโครงการนี้</p>
                          ) : (
                            <div className="overflow-hidden rounded-lg border">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-muted/50 font-semibold text-muted-foreground border-b">
                                    <th className="p-2.5 w-12 text-center">#</th>
                                    <th className="p-2.5">ชื่อกิจกรรมย่อย</th>
                                    <th className="p-2.5 text-right w-36">งบประมาณกิจกรรม</th>
                                    <th className="p-2.5 text-right w-44">ใช้สุทธิ / จำนวนครั้ง</th>
                                    <th className="p-2.5 text-right w-36">งบคงเหลือ</th>
                                    <th className="p-2.5 w-48">ความคืบหน้างบประมาณ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {project.activities.map((activity, index) => {
                                    const remainingColor = activity.remaining < 0
                                      ? "font-bold text-red-600"
                                      : activity.remaining <= activity.budget * 0.15
                                        ? "font-bold text-amber-600"
                                        : "text-emerald-600";

                                    return (
                                      <tr key={activity.id} className="border-b last:border-0 hover:bg-muted/10 font-medium">
                                        <td className="p-2.5 text-center text-muted-foreground font-mono">{index + 1}</td>
                                        <td className="p-2.5 text-foreground">{highlightText(activity.name, appliedValues.q)}</td>
                                        <td className="p-2.5 text-right font-mono text-foreground font-bold">{formatBaht(activity.budget)}</td>
                                        <td className="p-2.5 text-right text-muted-foreground">
                                          {activity.netSpent > 0 ? (
                                            <span className="font-mono font-semibold text-red-600">
                                              {formatBaht(activity.netSpent)}
                                            </span>
                                          ) : (
                                            <span className="font-mono">-</span>
                                          )}
                                          <span className="ml-1 text-[10px] text-muted-foreground">
                                            ({activity.expenseCount} ครั้ง)
                                          </span>
                                        </td>
                                        <td className={cn("p-2.5 text-right font-mono font-semibold", remainingColor)}>
                                          {formatBaht(activity.remaining)}
                                        </td>
                                        <td className="p-2.5 w-48">
                                          <BudgetProgressBar percentUsed={activity.percentUsed} compact />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="space-y-3 md:hidden">
        {projects.length === 0 ? (
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              ไม่พบรายการที่ตรงกับเงื่อนไข
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => {
            const isSelected = selectedIds.has(project.id);
            const budgetDisplay = getBudgetDisplay(project);
            const progress = getBudgetProgress(project);

            return (
              <Card
                key={project.id}
                className={cn(
                  "rounded-2xl border-border/70 shadow-sm transition-colors",
                  isSelected && "border-primary/40 bg-primary/5",
                )}
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      {project.canDelete ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={isSelected}
                          onChange={() => toggleSelect(project.id)}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-not-allowed rounded border-gray-300 opacity-20"
                          disabled
                          title="คุณไม่มีสิทธิ์ลบโครงการนี้"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="inline-flex rounded-full bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                            {highlightText(project.projectCode, appliedValues.q)}
                          </div>
                          <Link
                            href={`/projects/${project.id}`}
                            className="block text-base font-bold leading-snug text-primary hover:underline"
                          >
                            {highlightText(project.projectName, appliedValues.q)}
                          </Link>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_COLORS[project.status]}`}
                        >
                          {STATUS_LABELS[project.status]}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm">
                        <InfoRow label="ฝ่าย" value={project.departmentName} />
                        <InfoRow label="ผู้รับผิดชอบ" value={project.responsibleFullName} />
                        <InfoRow label="งบโครงการ" value={formatBaht(budgetDisplay)} mono strong />
                        <InfoRow
                          label="ใช้สุทธิ"
                          value={
                            progress
                              ? `${formatBaht(project.budgetNetSpent)} (${project.expenseCount} ครั้ง)`
                              : "-"
                          }
                          mono={Boolean(progress)}
                          valueClassName={progress ? "text-red-600" : undefined}
                        />
                        <InfoRow
                          label="งบคงเหลือ"
                          value={progress ? formatBaht(project.budgetRemaining) : "-"}
                          mono={Boolean(progress)}
                          strong={Boolean(progress)}
                          valueClassName={
                            progress
                              ? project.budgetRemaining < 0
                                ? "text-red-600"
                                : project.budgetRemaining <= project.budgetApproved * 0.15
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {progress ? (
                    <div className="rounded-2xl bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold">
                        <span className="text-muted-foreground">ความคืบหน้างบประมาณ</span>
                        <span
                          className={
                            progress.percentUsed <= 60
                              ? "text-emerald-600"
                              : progress.percentUsed <= 85
                                ? "text-amber-600"
                                : "text-red-600"
                          }
                        >
                          ใช้ {progress.percentUsed.toFixed(0)}%
                        </span>
                      </div>
                      <BudgetProgressBar percentUsed={progress.percentUsed} compact />
                      <Link
                        href={`/projects/${project.id}#budget-history`}
                        className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
                      >
                        ดูประวัติงบประมาณทั้งหมด
                      </Link>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-3 text-xs text-muted-foreground">
                      ยังไม่ตั้งงบใช้จ่าย
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/50">
                    <button
                      onClick={() => toggleExpand(project.id)}
                      className="flex items-center justify-between w-full text-xs font-semibold text-primary hover:underline"
                    >
                      <span className="flex items-center gap-1">📂 กิจกรรมย่อย ({project.activities.length})</span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transform transition-transform duration-200",
                          expandedProjectIds.has(project.id) && "rotate-90 text-primary"
                        )}
                      />
                    </button>
                    {expandedProjectIds.has(project.id) && (
                      <div className="mt-3 space-y-3">
                        {project.activities.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic text-center py-2">ไม่มีกิจกรรมย่อย</div>
                        ) : (
                          project.activities.map((activity, index) => {
                            const remainingColor = activity.remaining < 0
                              ? "text-red-600 font-bold"
                              : activity.remaining <= activity.budget * 0.15
                                ? "text-amber-600 font-bold"
                                : "text-emerald-600 font-semibold";

                            return (
                              <div key={activity.id} className="space-y-3 rounded-xl border border-border/50 bg-background p-3 shadow-sm">
                                <div className="flex items-start gap-2 text-xs font-semibold text-foreground">
                                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                                    {index + 1}
                                  </span>
                                  <span className="leading-snug">
                                    {highlightText(activity.name, appliedValues.q)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div className="flex justify-between border-r border-border/50 pr-2">
                                    <span className="text-muted-foreground">งบประมาณ:</span>
                                    <span className="font-mono font-bold text-foreground">{formatBaht(activity.budget)}</span>
                                  </div>
                                  <div className="flex justify-between pl-2">
                                    <span className="text-muted-foreground">ใช้สุทธิ (ครั้ง):</span>
                                    <span className="font-mono text-foreground">
                                      {activity.netSpent > 0 ? (
                                        <span className="font-semibold text-red-600">{formatBaht(activity.netSpent)}</span>
                                      ) : (
                                        "-"
                                      )}
                                      <span className="text-[9px] text-muted-foreground ml-0.5">({activity.expenseCount} ครั้ง)</span>
                                    </span>
                                  </div>
                                  <div className="col-span-2 border-t border-border/30 pt-1.5 flex justify-between">
                                    <span className="text-muted-foreground">งบคงเหลือ:</span>
                                    <span className={cn("font-mono", remainingColor)}>{formatBaht(activity.remaining)}</span>
                                  </div>
                                </div>
                                <div className="border-t border-border/30 pt-2">
                                  <BudgetProgressBar percentUsed={activity.percentUsed} compact />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

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
          <div className="animate-in zoom-in-95 fade-in duration-150 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
                <Trash2 className="h-5 w-5" />
                ยืนยันการลบโครงการที่เลือก
              </h2>
              <button
                onClick={handleClose}
                className="text-muted-foreground transition-colors hover:text-foreground"
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="animate-in fade-in duration-300 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="text-sm font-semibold">{success}</span>
                </div>
              )}

              {!success && (
                <>
                  <p className="text-sm leading-relaxed text-foreground">
                    คุณแน่ใจหรือไม่ว่าต้องการลบโครงการที่เลือกจำนวน
                    <strong className="mx-1 text-base font-bold text-destructive">
                      {selectedIds.size} โครงการ
                    </strong>
                    ข้อมูลที่เชื่อมโยงทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้
                  </p>

                  <div className="max-h-[200px] overflow-y-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 font-medium text-muted-foreground">
                          <th className="p-2.5">รหัสโครงการ</th>
                          <th className="p-2.5">ชื่อโครงการ</th>
                          <th className="p-2.5 text-right">งบเสนอขอ (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProjects.map((project) => (
                          <tr
                            key={project.id}
                            className="border-b font-medium text-foreground/90 hover:bg-muted/10"
                          >
                            <td className="p-2.5 font-mono text-muted-foreground">
                              {project.projectCode}
                            </td>
                            <td className="p-2.5">{project.projectName}</td>
                            <td className="p-2.5 text-right">
                              {formatBaht(project.budgetRequested)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1 rounded-xl border border-red-200/50 bg-red-50 p-3.5 text-red-900">
                    <h4 className="flex items-center gap-1 text-xs font-bold text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      คำเตือนสำคัญ:
                    </h4>
                    <p className="text-[11px] font-medium leading-relaxed">
                      การดำเนินการนี้จะลบข้อมูลกิจกรรม ประวัติการอนุมัติ ธุรกรรมงบประมาณ และรายการจัดซื้อที่เกี่ยวข้องทั้งหมด
                    </p>
                  </div>
                </>
              )}

              {!success && (
                <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="rounded-lg"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={handleBulkDelete}
                    className="min-w-[120px] gap-1.5 rounded-lg bg-destructive text-white hover:bg-destructive/90"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        กำลังลบข้อมูล...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        ยืนยันลบโครงการ
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getBudgetDisplay(project: ProjectRow) {
  return isBudgetActive(project)
    ? project.budgetApproved
    : project.budgetRequested;
}

function getBudgetProgress(project: ProjectRow) {
  if (!isBudgetActive(project)) return null;
  const spent = project.budgetApproved - project.budgetRemaining;
  const percentUsed =
    project.budgetApproved > 0 ? (spent / project.budgetApproved) * 100 : 0;
  return { percentUsed };
}

function isBudgetActive(project: ProjectRow) {
  return (
    project.status === "APPROVED" ||
    project.status === "IN_PROGRESS" ||
    project.status === "COMPLETED"
  );
}

function BudgetProgressBar({
  percentUsed,
  compact = false,
}: {
  percentUsed: number;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "w-full overflow-hidden rounded-full border border-slate-200/50 bg-slate-100",
          compact ? "h-2" : "h-1.5",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            percentUsed <= 60
              ? "bg-emerald-500"
              : percentUsed <= 85
                ? "bg-amber-500"
                : "bg-red-500",
          )}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
        <span>ใช้ {percentUsed.toFixed(0)}%</span>
        <span>เหลือ {(100 - percentUsed).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  strong = false,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right",
          mono && "font-mono",
          strong && "font-semibold",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}
