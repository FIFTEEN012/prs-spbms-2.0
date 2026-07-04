"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  Eye,
  FilePlus2,
  FolderOpen,
  History,
  Loader2,
  PackagePlus,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";
import {
  defaultProjectListQueryValues,
  type ProjectListQueryValues,
  type ProjectRow,
} from "@/lib/project-list-service";
import { useListControls } from "@/lib/use-list-controls";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "รอหัวหน้ากลุ่มตรวจ",
  REVIEWED: "รอผู้บริหารอนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ตีกลับ",
  IN_PROGRESS: "กำลังดำเนินการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  SUBMITTED: "border-amber-200 bg-amber-100 text-amber-800",
  REVIEWED: "border-blue-200 bg-blue-100 text-blue-800",
  APPROVED: "border-emerald-200 bg-emerald-100 text-emerald-800",
  REJECTED: "border-rose-200 bg-rose-100 text-rose-800",
  IN_PROGRESS: "border-violet-200 bg-violet-100 text-violet-800",
  COMPLETED: "border-green-200 bg-green-100 text-green-800",
  CANCELLED: "border-slate-300 bg-slate-200 text-slate-700",
};

const QUICK_FILTERS = [
  { label: "ทั้งหมด", status: "", mine: "" },
  { label: "โครงการของฉัน", status: "", mine: "1" },
  { label: "ร่าง", status: "DRAFT", mine: "" },
  { label: "รอหัวหน้ากลุ่มตรวจ", status: "SUBMITTED", mine: "" },
  { label: "รอผู้บริหารอนุมัติ", status: "REVIEWED", mine: "" },
  { label: "อนุมัติแล้ว", status: "APPROVED", mine: "" },
  { label: "ตีกลับ", status: "REJECTED", mine: "" },
  { label: "กำลังดำเนินการ", status: "IN_PROGRESS", mine: "" },
  { label: "เสร็จสิ้น", status: "COMPLETED", mine: "" },
];

const SORT_OPTIONS = [
  { value: "createdAt", label: "วันที่สร้าง" },
  { value: "updatedAt", label: "อัปเดตล่าสุด" },
  { value: "projectName", label: "ชื่อโครงการ" },
  { value: "projectCode", label: "รหัสโครงการ" },
  { value: "budgetRequested", label: "งบที่ขอ" },
  { value: "budgetApproved", label: "งบอนุมัติ" },
  { value: "status", label: "สถานะ" },
];

type WorkflowAction = "submit" | "review_approve" | "approve" | "reject";

type WorkflowDialogState = {
  project: ProjectRow;
  action: WorkflowAction;
} | null;

interface ProjectsClientProps {
  projects: ProjectRow[];
  departments: Array<{ id: string; name: string }>;
  academicYears: Array<{ id: string; yearName: string; isActive: boolean }>;
  responsibleUsers: Array<{ id: string; fullName: string; departmentId: string | null }>;
  currentUserId: string;
  currentRole: Role;
  canCreateProject: boolean;
  activeAcademicYearName: string | null;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  initialQuery: ProjectListQueryValues;
  bulkSubmitButtonElement?: ReactNode;
}

export function ProjectsClient({
  projects,
  departments,
  academicYears,
  responsibleUsers,
  currentUserId,
  currentRole,
  canCreateProject,
  activeAcademicYearName,
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
  const [workflowDialog, setWorkflowDialog] = useState<WorkflowDialogState>(null);
  const [workflowComment, setWorkflowComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

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
    setSelectedIds(new Set());
  }, [page, projects]);

  useEffect(() => {
    if (!appliedValues.q) return;
    const query = appliedValues.q.toLowerCase();
    const matchingIds = new Set<string>();

    projects.forEach((project) => {
      if (project.activities.some((activity) => activity.name.toLowerCase().includes(query))) {
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
  }, [appliedValues.q, projects]);

  const activeFilters = useMemo(() => {
    const items: Array<{ key: keyof ProjectListQueryValues; label: string; value: string }> = [];
    if (appliedValues.q) items.push({ key: "q", label: "ค้นหา", value: appliedValues.q });
    if (appliedValues.status) {
      items.push({
        key: "status",
        label: "สถานะ",
        value: STATUS_LABELS[appliedValues.status] ?? appliedValues.status,
      });
    }
    if (appliedValues.mine === "1") {
      items.push({ key: "mine", label: "มุมมอง", value: "โครงการของฉัน" });
    }
    if (appliedValues.departmentId) {
      const department = departments.find((item) => item.id === appliedValues.departmentId);
      items.push({
        key: "departmentId",
        label: "กลุ่มบริหาร",
        value: department?.name ?? appliedValues.departmentId,
      });
    }
    if (appliedValues.academicYearId) {
      const year = academicYears.find((item) => item.id === appliedValues.academicYearId);
      items.push({
        key: "academicYearId",
        label: "ปีการศึกษา",
        value: year?.yearName ?? appliedValues.academicYearId,
      });
    }
    if (appliedValues.responsibleUserId) {
      const user = responsibleUsers.find((item) => item.id === appliedValues.responsibleUserId);
      items.push({
        key: "responsibleUserId",
        label: "ผู้รับผิดชอบ",
        value: user?.fullName ?? appliedValues.responsibleUserId,
      });
    }
    return items;
  }, [academicYears, appliedValues, departments, responsibleUsers]);

  const deletableProjects = projects.filter((project) => project.canDelete);
  const selectedProjects = projects.filter((project) => selectedIds.has(project.id));
  const allSelectableChecked =
    deletableProjects.length > 0 && selectedIds.size === deletableProjects.length;

  const applyQuickFilter = (status: string, mine: string) => {
    if (!status && !mine) {
      reset();
      return;
    }
    setValue("mine", mine);
    setValue("status", status);
  };

  const removeFilter = (key: keyof ProjectListQueryValues) => {
    setValue(key, defaultProjectListQueryValues[key]);
  };

  const toggleExpand = (id: string) => {
    setExpandedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableChecked) setSelectedIds(new Set());
    else setSelectedIds(new Set(deletableProjects.map((project) => project.id)));
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "เกิดข้อผิดพลาดในการลบโครงการ");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowAction = async () => {
    if (!workflowDialog) return;
    setWorkflowLoading(true);
    setWorkflowError(null);

    try {
      const res = await fetch(`/api/projects/${workflowDialog.project.id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: workflowDialog.action,
          comment: workflowComment.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถดำเนินการได้");
      }

      setWorkflowDialog(null);
      setWorkflowComment("");
      router.refresh();
    } catch (cause) {
      setWorkflowError(cause instanceof Error ? cause.message : "ไม่สามารถดำเนินการได้");
    } finally {
      setWorkflowLoading(false);
    }
  };

  const openWorkflowDialog = (project: ProjectRow, action: WorkflowAction) => {
    setWorkflowDialog({ project, action });
    setWorkflowComment("");
    setWorkflowError(null);
  };

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, total);

  return (
    <div className="space-y-4 md:space-y-6">
      <ProjectFilterPanel
        draftValues={draftValues}
        appliedValues={appliedValues}
        departments={departments}
        academicYears={academicYears}
        responsibleUsers={responsibleUsers}
        activeAcademicYearName={activeAcademicYearName}
        total={total}
        pageStart={pageStart}
        pageEnd={pageEnd}
        isDirty={isDirty}
        isPending={isPending}
        setValue={setValue}
        reset={reset}
        activeFilters={activeFilters}
        removeFilter={removeFilter}
        applyQuickFilter={applyQuickFilter}
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
            className="w-full gap-1.5 rounded-lg px-4 py-2 font-bold shadow-sm sm:w-auto"
          >
            <Trash2 className="size-4" />
            ลบโครงการที่เลือก ({selectedIds.size})
          </Button>
        )}
        {bulkSubmitButtonElement}
      </div>

      {deletableProjects.length > 0 && (
        <Card className="rounded-lg md:hidden">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={allSelectableChecked}
                onChange={toggleSelectAll}
              />
              เลือกโครงการที่ลบได้ทั้งหมด
            </label>
            <span className="text-xs text-muted-foreground">
              เลือกแล้ว {selectedIds.size} รายการ
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="hidden overflow-hidden rounded-lg border-border/70 bg-card/90 shadow-sm backdrop-blur md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-primary/5 text-xs text-primary">
                  <th className="w-12 px-4 py-4 text-center">
                    {deletableProjects.length > 0 && (
                      <input
                        type="checkbox"
                        className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={allSelectableChecked}
                        onChange={toggleSelectAll}
                      />
                    )}
                  </th>
                  <th className="px-4 py-4 font-bold">รหัส</th>
                  <th className="min-w-[280px] px-4 py-4 font-bold">ชื่อโครงการ</th>
                  <th className="px-4 py-4 font-bold">กลุ่มบริหาร</th>
                  <th className="px-4 py-4 font-bold">ผู้รับผิดชอบ</th>
                  <th className="px-4 py-4 text-right font-bold">งบที่ขอ</th>
                  <th className="px-4 py-4 text-right font-bold">งบอนุมัติ</th>
                  <th className="px-4 py-4 font-bold">สถานะ</th>
                  <th className="px-4 py-4 font-bold">อัปเดตล่าสุด</th>
                  <th className="px-4 py-4 text-right font-bold">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12">
                      <ProjectEmptyState canCreateProject={canCreateProject} />
                    </td>
                  </tr>
                ) : (
                  projects.map((project) => {
                    const isSelected = selectedIds.has(project.id);
                    return (
                      <Fragment key={project.id}>
                        <tr
                          className={cn(
                            "transition-colors hover:bg-primary/5",
                            isSelected && "bg-primary/5",
                          )}
                        >
                          <td className="px-4 py-5 text-center">
                            {project.canDelete ? (
                              <input
                                type="checkbox"
                                className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={isSelected}
                                onChange={() => toggleSelect(project.id)}
                              />
                            ) : (
                              <span className="inline-flex size-4 rounded border border-border/70 bg-muted/40" />
                            )}
                          </td>
                          <td className="px-4 py-5 align-top">
                            <button
                              onClick={() => toggleExpand(project.id)}
                              className="mb-2 inline-flex items-center gap-1 rounded-md text-xs font-semibold text-primary hover:underline"
                              title="ดูกิจกรรมย่อย"
                            >
                              <ChevronRight
                                className={cn(
                                  "size-3.5 transition-transform",
                                  expandedProjectIds.has(project.id) && "rotate-90",
                                )}
                              />
                              กิจกรรม
                            </button>
                            <div className="font-mono text-xs font-semibold text-muted-foreground">
                              {highlightText(project.projectCode, appliedValues.q)}
                            </div>
                          </td>
                          <td className="px-4 py-5 align-top">
                            <Link
                              href={`/projects/${project.id}`}
                              className="block font-bold leading-snug text-foreground hover:text-primary hover:underline"
                            >
                              {highlightText(project.projectName, appliedValues.q)}
                            </Link>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {formatProjectDateRange(project.startDate, project.endDate)}
                            </div>
                          </td>
                          <td className="px-4 py-5 align-top text-xs text-muted-foreground">
                            {project.departmentName}
                          </td>
                          <td className="px-4 py-5 align-top text-xs font-semibold">
                            {highlightText(project.responsibleFullName, appliedValues.q)}
                            {project.responsibleUserId === currentUserId && (
                                <span className="mt-1 block text-[11px] font-bold text-primary">
                                  ของฉัน
                                </span>
                              )}
                          </td>
                          <td className="px-4 py-5 text-right align-top font-mono text-xs font-bold">
                            {formatBaht(project.budgetRequested)}
                          </td>
                          <td className="px-4 py-5 text-right align-top">
                            <div className="font-mono text-xs font-bold">
                              {formatBaht(project.budgetApproved)}
                            </div>
                            {isBudgetActive(project) && (
                              <div className="mt-2">
                                <BudgetProgressBar project={project} />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-5 align-top">
                            <StatusBadge status={project.status} />
                          </td>
                          <td className="px-4 py-5 align-top text-xs text-muted-foreground">
                            {formatThaiDate(project.updatedAt)}
                          </td>
                          <td className="px-4 py-5 align-top">
                            <ProjectRowActions
                              project={project}
                              currentRole={currentRole}
                              onWorkflow={openWorkflowDialog}
                            />
                          </td>
                        </tr>
                        {expandedProjectIds.has(project.id) && (
                          <tr className="bg-muted/15">
                            <td />
                            <td colSpan={9} className="px-4 py-4">
                              <ExpandedActivities project={project} search={appliedValues.q} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 md:hidden">
        {projects.length === 0 ? (
          <Card className="rounded-lg border-border/70 bg-card/90">
            <CardContent className="p-8">
              <ProjectEmptyState canCreateProject={canCreateProject} />
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => {
            const isSelected = selectedIds.has(project.id);
            return (
              <Card
                key={project.id}
                className={cn(
                  "rounded-lg border-border/70 bg-card/90 shadow-sm transition-colors",
                  isSelected && "border-primary/40 bg-primary/5",
                )}
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    {project.canDelete ? (
                      <input
                        type="checkbox"
                        className="mt-1 size-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={isSelected}
                        onChange={() => toggleSelect(project.id)}
                      />
                    ) : (
                      <span className="mt-1 inline-flex size-4 rounded border border-border/70 bg-muted/40" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-muted px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground">
                          {highlightText(project.projectCode, appliedValues.q)}
                        </span>
                        <StatusBadge status={project.status} />
                      </div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="block text-base font-bold leading-snug text-foreground hover:text-primary hover:underline"
                      >
                        {highlightText(project.projectName, appliedValues.q)}
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <InfoRow label="กลุ่มบริหาร" value={project.departmentName} />
                    <InfoRow
                      label="ผู้รับผิดชอบ"
                      valueNode={highlightText(project.responsibleFullName, appliedValues.q)}
                    />
                    <InfoRow label="ช่วงเวลา" value={formatProjectDateRange(project.startDate, project.endDate)} />
                    <InfoRow label="งบที่ขอ" value={formatBaht(project.budgetRequested)} mono strong />
                    <InfoRow label="งบอนุมัติ" value={formatBaht(project.budgetApproved)} mono strong />
                    <InfoRow label="อัปเดตล่าสุด" value={formatThaiDate(project.updatedAt)} />
                  </div>

                  {isBudgetActive(project) && (
                    <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                      <BudgetProgressBar project={project} showLabel />
                    </div>
                  )}

                  <button
                    onClick={() => toggleExpand(project.id)}
                    className="flex w-full items-center justify-between border-t border-border/50 pt-3 text-xs font-bold text-primary hover:underline"
                  >
                    <span className="flex items-center gap-1">
                      <FolderOpen className="size-4" />
                      กิจกรรมย่อย ({project.activities.length})
                    </span>
                    <ChevronRight
                      className={cn(
                        "size-4 transition-transform",
                        expandedProjectIds.has(project.id) && "rotate-90",
                      )}
                    />
                  </button>

                  {expandedProjectIds.has(project.id) && (
                    <MobileActivities project={project} search={appliedValues.q} />
                  )}

                  <ProjectRowActions
                    project={project}
                    currentRole={currentRole}
                    onWorkflow={openWorkflowDialog}
                    mobile
                  />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <LocalPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageStart={pageStart}
        pageEnd={pageEnd}
        disabled={isPending}
        onPageChange={goToPage}
      />

      {isConfirmOpen && (
        <DeleteConfirmModal
          selectedCount={selectedIds.size}
          selectedProjects={selectedProjects}
          loading={loading}
          error={error}
          success={success}
          onClose={() => {
            if (loading) return;
            setIsConfirmOpen(false);
            setError(null);
            setSuccess(null);
          }}
          onConfirm={handleBulkDelete}
        />
      )}

      {workflowDialog && (
        <WorkflowActionModal
          state={workflowDialog}
          comment={workflowComment}
          loading={workflowLoading}
          error={workflowError}
          onCommentChange={setWorkflowComment}
          onClose={() => {
            if (workflowLoading) return;
            setWorkflowDialog(null);
            setWorkflowComment("");
            setWorkflowError(null);
          }}
          onConfirm={handleWorkflowAction}
        />
      )}
    </div>
  );
}

function ProjectFilterPanel({
  draftValues,
  appliedValues,
  departments,
  academicYears,
  responsibleUsers,
  activeAcademicYearName,
  total,
  pageStart,
  pageEnd,
  isDirty,
  isPending,
  setValue,
  reset,
  activeFilters,
  removeFilter,
  applyQuickFilter,
}: {
  draftValues: ProjectListQueryValues;
  appliedValues: ProjectListQueryValues;
  departments: Array<{ id: string; name: string }>;
  academicYears: Array<{ id: string; yearName: string; isActive: boolean }>;
  responsibleUsers: Array<{ id: string; fullName: string }>;
  activeAcademicYearName: string | null;
  total: number;
  pageStart: number;
  pageEnd: number;
  isDirty: boolean;
  isPending: boolean;
  setValue: (key: keyof ProjectListQueryValues & string, value: string) => void;
  reset: () => void;
  activeFilters: Array<{ key: keyof ProjectListQueryValues; label: string; value: string }>;
  removeFilter: (key: keyof ProjectListQueryValues) => void;
  applyQuickFilter: (status: string, mine: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <SlidersHorizontal className="size-4" />
            ตัวกรองรายการโครงการ
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            แสดง {pageStart}-{pageEnd} จาก {total} โครงการ
            {activeAcademicYearName ? ` · ปีการศึกษาปัจจุบัน ${activeAcademicYearName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((filter) => {
            const active =
              appliedValues.status === filter.status && appliedValues.mine === filter.mine;
            return (
              <button
                key={`${filter.label}-${filter.status}-${filter.mine}`}
                type="button"
                onClick={() => applyQuickFilter(filter.status, filter.mine)}
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

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(150px,1fr))]">
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-muted-foreground">ค้นหา</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={draftValues.q}
              onChange={(event) => setValue("q", event.target.value)}
              placeholder="ชื่อโครงการ รหัส ผู้รับผิดชอบ หรือกิจกรรม"
              className="h-10 w-full rounded-lg border border-input bg-background/90 pl-9 pr-3 text-sm outline-none ring-offset-background transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </label>

        <ProjectSelect
          label="ปีการศึกษา"
          value={draftValues.academicYearId}
          onChange={(value) => setValue("academicYearId", value)}
          options={academicYears.map((year) => ({
            value: year.id,
            label: `${year.yearName}${year.isActive ? " (ปัจจุบัน)" : ""}`,
          }))}
          allLabel="ทุกปี"
        />
        <ProjectSelect
          label="กลุ่มบริหาร"
          value={draftValues.departmentId}
          onChange={(value) => setValue("departmentId", value)}
          options={departments.map((department) => ({
            value: department.id,
            label: department.name,
          }))}
          allLabel="ทุกกลุ่ม"
        />
        <ProjectSelect
          label="ผู้รับผิดชอบ"
          value={draftValues.responsibleUserId}
          onChange={(value) => setValue("responsibleUserId", value)}
          options={responsibleUsers.map((user) => ({
            value: user.id,
            label: user.fullName,
          }))}
          allLabel="ทุกคน"
        />
        <ProjectSelect
          label="สถานะ"
          value={draftValues.status}
          onChange={(value) => setValue("status", value)}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          allLabel="ทุกสถานะ"
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <ProjectSelect
            label="เรียงตาม"
            value={draftValues.sortBy}
            onChange={(value) => setValue("sortBy", value)}
            options={SORT_OPTIONS}
          />
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">ทิศทาง</span>
            <button
              type="button"
              onClick={() => setValue("sortDir", draftValues.sortDir === "asc" ? "desc" : "asc")}
              className="flex size-10 items-center justify-center rounded-lg border border-input bg-background/90 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              title={draftValues.sortDir === "asc" ? "เรียงจากน้อยไปมาก" : "เรียงจากมากไปน้อย"}
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

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-h-8 flex-wrap gap-2">
          {activeFilters.length === 0 ? (
            <span className="text-xs text-muted-foreground">ยังไม่มีตัวกรองเพิ่มเติม</span>
          ) : (
            activeFilters.map((filter) => (
              <button
                key={`${filter.key}-${filter.value}`}
                type="button"
                onClick={() => removeFilter(filter.key)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary"
              >
                <span className="text-primary/70">{filter.label}:</span>
                {filter.value}
                <X className="size-3" />
              </button>
            ))
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          disabled={isPending || (!isDirty && activeFilters.length === 0)}
          className="w-full rounded-lg sm:w-auto"
        >
          ล้างตัวกรอง
        </Button>
      </div>
    </section>
  );
}

function ProjectSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-background/90 px-3 text-sm outline-none ring-offset-background transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProjectRowActions({
  project,
  currentRole,
  onWorkflow,
  mobile = false,
}: {
  project: ProjectRow;
  currentRole: Role;
  onWorkflow: (project: ProjectRow, action: WorkflowAction) => void;
  mobile?: boolean;
}) {
  const actions: ReactNode[] = [
    <IconLink key="view" href={`/projects/${project.id}`} label="ดูรายละเอียด" icon={<Eye className="size-4" />} />,
  ];

  if (project.canEdit) {
    actions.push(
      <IconLink
        key="edit"
        href={`/projects/${project.id}/edit`}
        label="แก้ไข"
        icon={<Edit3 className="size-4" />}
      />,
    );
  }

  if (project.canViewBudgetHistory) {
    actions.push(
      <IconLink
        key="history"
        href={`/projects/${project.id}#budget-history`}
        label="ประวัติงบ"
        icon={<History className="size-4" />}
      />,
    );
  }

  if (project.canCreatePurchaseRequest) {
    actions.push(
      <IconLink
        key="procurement"
        href={`/procurement/new?projectId=${project.id}`}
        label="จัดซื้อ"
        icon={<PackagePlus className="size-4" />}
      />,
    );
  }

  if (project.canSubmit) {
    actions.push(
      <IconButton
        key="submit"
        label="ส่งขออนุมัติ"
        icon={<Send className="size-4" />}
        onClick={() => onWorkflow(project, "submit")}
      />,
    );
  }

  if (project.canReviewApprove) {
    actions.push(
      <IconButton
        key="review"
        label="ตรวจผ่าน"
        icon={<Check className="size-4" />}
        onClick={() => onWorkflow(project, "review_approve")}
      />,
    );
  }

  if (project.canApprove) {
    actions.push(
      <IconButton
        key="approve"
        label="อนุมัติ"
        icon={<CheckCircle2 className="size-4" />}
        onClick={() => onWorkflow(project, "approve")}
      />,
    );
  }

  if (project.canReject) {
    actions.push(
      <IconButton
        key="reject"
        label="ตีกลับ"
        icon={<RotateCcw className="size-4" />}
        tone="danger"
        onClick={() => onWorkflow(project, "reject")}
      />,
    );
  }

  if (currentRole === "COMMITTEE") {
    return (
      <div className={cn("flex justify-end", mobile && "justify-start")}>
        {actions[0]}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap justify-end gap-1.5",
        mobile && "justify-start border-t border-border/50 pt-3",
      )}
    >
      {actions}
    </div>
  );
}

function IconLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-background/75 px-2.5 text-xs font-bold text-muted-foreground transition hover:border-primary/30 hover:text-primary"
      title={label}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function IconButton({
  label,
  icon,
  tone = "default",
  onClick,
}: {
  label: string;
  icon: ReactNode;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition",
        tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10",
      )}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-bold",
        STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ExpandedActivities({ project, search }: { project: ProjectRow; search: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/80 p-4 shadow-inner">
      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <FolderOpen className="size-4 text-primary" />
        กิจกรรมย่อย ({project.activities.length})
      </h4>
      {project.activities.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">ยังไม่มีกิจกรรมย่อยในโครงการนี้</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/45 font-bold text-muted-foreground">
                <th className="w-12 p-3 text-center">#</th>
                <th className="p-3">ชื่อกิจกรรมย่อย</th>
                <th className="w-36 p-3 text-right">งบกิจกรรม</th>
                <th className="w-36 p-3 text-right">ใช้สุทธิ</th>
                <th className="w-36 p-3 text-right">คงเหลือ</th>
                <th className="w-44 p-3">ความคืบหน้างบ</th>
              </tr>
            </thead>
            <tbody>
              {project.activities.map((activity, index) => (
                <tr key={activity.id} className="border-b last:border-0 hover:bg-muted/15">
                  <td className="p-3 text-center font-mono text-muted-foreground">{index + 1}</td>
                  <td className="p-3 font-semibold text-foreground">
                    {highlightText(activity.name, search)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold">
                    {formatBaht(activity.budget)}
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={cn(
                        "font-mono",
                        activity.netSpent > 0 && "font-bold text-rose-700",
                      )}
                    >
                      {activity.netSpent > 0 ? formatBaht(activity.netSpent) : "-"}
                    </span>
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({activity.expenseCount} ครั้ง)
                    </span>
                  </td>
                  <td
                    className={cn(
                      "p-3 text-right font-mono font-bold",
                      getRemainingTone(activity.remaining, activity.budget),
                    )}
                  >
                    {formatBaht(activity.remaining)}
                  </td>
                  <td className="p-3">
                    <BudgetProgressBar
                      percentUsed={activity.percentUsed}
                      remaining={activity.remaining}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MobileActivities({ project, search }: { project: ProjectRow; search: string }) {
  if (project.activities.length === 0) {
    return <div className="py-2 text-center text-xs italic text-muted-foreground">ยังไม่มีกิจกรรมย่อย</div>;
  }

  return (
    <div className="space-y-3">
      {project.activities.map((activity, index) => (
        <div key={activity.id} className="space-y-3 rounded-lg border border-border/60 bg-background p-3 shadow-sm">
          <div className="flex items-start gap-2 text-xs font-bold text-foreground">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
              {index + 1}
            </span>
            <span className="leading-snug">{highlightText(activity.name, search)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <InfoRow label="งบกิจกรรม" value={formatBaht(activity.budget)} mono strong />
            <InfoRow
              label="ใช้สุทธิ"
              value={`${activity.netSpent > 0 ? formatBaht(activity.netSpent) : "-"} (${activity.expenseCount} ครั้ง)`}
              mono
              valueClassName={activity.netSpent > 0 ? "text-rose-700" : undefined}
            />
            <div className="col-span-2 border-t border-border/40 pt-2">
              <InfoRow
                label="คงเหลือ"
                value={formatBaht(activity.remaining)}
                mono
                strong
                valueClassName={getRemainingTone(activity.remaining, activity.budget)}
              />
            </div>
          </div>
          <BudgetProgressBar percentUsed={activity.percentUsed} remaining={activity.remaining} />
        </div>
      ))}
    </div>
  );
}

function WorkflowActionModal({
  state,
  comment,
  loading,
  error,
  onCommentChange,
  onClose,
  onConfirm,
}: {
  state: NonNullable<WorkflowDialogState>;
  comment: string;
  loading: boolean;
  error: string | null;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const meta = getWorkflowMeta(state.action);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
          <h2 className={cn("flex items-center gap-2 text-lg font-bold", meta.titleTone)}>
            {meta.icon}
            {meta.title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            disabled={loading}
            aria-label="ปิด"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <p className="font-mono text-xs text-muted-foreground">{state.project.projectCode}</p>
            <p className="mt-1 font-bold text-foreground">{state.project.projectName}</p>
            <div className="mt-3">
              <StatusBadge status={state.project.status} />
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">
              ความเห็นประกอบ{state.action === "reject" ? " (ควรระบุเหตุผล)" : " (ไม่บังคับ)"}
            </span>
            <textarea
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-input bg-background/90 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="ระบุความเห็นเพื่อบันทึกในประวัติ workflow"
            />
          </label>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={loading || (state.action === "reject" && !comment.trim())}
              className={cn("min-w-[130px] gap-2", meta.buttonClass)}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : meta.buttonIcon}
              {loading ? "กำลังบันทึก..." : meta.confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  selectedCount,
  selectedProjects,
  loading,
  error,
  success,
  onClose,
  onConfirm,
}: {
  selectedCount: number;
  selectedProjects: ProjectRow[];
  loading: boolean;
  error: string | null;
  success: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-destructive">
            <Trash2 className="size-5" />
            ยืนยันการลบโครงการที่เลือก
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            disabled={loading}
            aria-label="ปิด"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              <span className="text-sm font-bold">{success}</span>
            </div>
          )}

          {!success && (
            <>
              <p className="text-sm leading-relaxed text-foreground">
                คุณแน่ใจหรือไม่ว่าต้องการลบโครงการที่เลือกจำนวน
                <strong className="mx-1 text-base font-bold text-destructive">
                  {selectedCount} โครงการ
                </strong>
                ข้อมูลที่เชื่อมโยงทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้
              </p>

              <div className="max-h-[200px] overflow-y-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50 font-bold text-muted-foreground">
                      <th className="p-2.5">รหัสโครงการ</th>
                      <th className="p-2.5">ชื่อโครงการ</th>
                      <th className="p-2.5 text-right">งบเสนอขอ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProjects.map((project) => (
                      <tr key={project.id} className="border-b font-medium text-foreground/90 hover:bg-muted/10">
                        <td className="p-2.5 font-mono text-muted-foreground">{project.projectCode}</td>
                        <td className="p-2.5">{project.projectName}</td>
                        <td className="p-2.5 text-right">{formatBaht(project.budgetRequested)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 rounded-lg border border-red-200/70 bg-red-50 p-3.5 text-red-900">
                <h4 className="flex items-center gap-1 text-xs font-bold text-red-700">
                  <AlertTriangle className="size-4" />
                  คำเตือนสำคัญ
                </h4>
                <p className="text-[11px] font-medium leading-relaxed">
                  การดำเนินการนี้จะลบกิจกรรม ประวัติการอนุมัติ ธุรกรรมงบประมาณ และรายการจัดซื้อที่เกี่ยวข้องทั้งหมด
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={onConfirm}
                  className="min-w-[120px] gap-1.5 bg-destructive text-white hover:bg-destructive/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      กำลังลบข้อมูล...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      ยืนยันลบโครงการ
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectEmptyState({ canCreateProject }: { canCreateProject: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FolderOpen className="size-6" />
      </div>
      <h3 className="mt-3 text-base font-bold text-foreground">ไม่พบโครงการตามเงื่อนไข</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        ลองล้างตัวกรองหรือปรับคำค้นหา หากยังไม่มีข้อมูลให้เริ่มสร้างโครงการใหม่
      </p>
      {canCreateProject && (
        <Button asChild className="mt-4 gap-2">
          <Link href="/projects/new">
            <FilePlus2 className="size-4" />
            สร้างโครงการใหม่
          </Link>
        </Button>
      )}
    </div>
  );
}

function LocalPagination({
  page,
  totalPages,
  total,
  pageStart,
  pageEnd,
  disabled,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageStart: number;
  pageEnd: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        แสดง {pageStart}-{pageEnd} จาก {total} รายการ
      </p>
      <div className="flex items-center justify-end gap-1">
        <PaginationButton
          label="หน้าแรก"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(1)}
          icon={<ChevronsLeft className="size-4" />}
        />
        <PaginationButton
          label="ก่อนหน้า"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          icon={<ChevronLeft className="size-4" />}
        />
        <span className="mx-2 text-sm font-bold text-foreground">
          หน้า {page} / {totalPages}
        </span>
        <PaginationButton
          label="ถัดไป"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          icon={<ChevronRight className="size-4" />}
        />
        <PaginationButton
          label="หน้าสุดท้าย"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          icon={<ChevronsRight className="size-4" />}
        />
      </div>
    </div>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      title={label}
    >
      {icon}
    </button>
  );
}

function InfoRow({
  label,
  value,
  valueNode,
  mono = false,
  strong = false,
  valueClassName,
}: {
  label: string;
  value?: string;
  valueNode?: ReactNode;
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
        {valueNode ?? value}
      </span>
    </div>
  );
}

function BudgetProgressBar({
  project,
  percentUsed,
  remaining,
  showLabel = false,
}: {
  project?: ProjectRow;
  percentUsed?: number;
  remaining?: number;
  showLabel?: boolean;
}) {
  const percent = percentUsed ?? getBudgetProgress(project);
  const left = remaining ?? project?.budgetRemaining ?? 0;

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-muted-foreground">ใช้งบประมาณ</span>
          <span className={getProgressTone(percent)}>{percent.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full border border-slate-200/70 bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            percent <= 60 ? "bg-emerald-500" : percent <= 85 ? "bg-amber-500" : "bg-rose-500",
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
        <span>ใช้ {percent.toFixed(0)}%</span>
        <span className={getRemainingTone(left, project?.budgetApproved ?? 0)}>
          เหลือ {formatBaht(left)}
        </span>
      </div>
    </div>
  );
}

function getWorkflowMeta(action: WorkflowAction) {
  switch (action) {
    case "submit":
      return {
        title: "ส่งโครงการขออนุมัติ",
        description: "โครงการจะเปลี่ยนสถานะเป็นรอหัวหน้ากลุ่มตรวจตาม workflow ปัจจุบัน",
        confirmLabel: "ส่งขออนุมัติ",
        icon: <Send className="size-5" />,
        buttonIcon: <Send className="size-4" />,
        titleTone: "text-amber-700",
        buttonClass: "bg-amber-600 text-white hover:bg-amber-700",
      };
    case "review_approve":
      return {
        title: "ตรวจสอบโครงการผ่าน",
        description: "โครงการจะถูกส่งต่อให้ผู้บริหารพิจารณาอนุมัติ",
        confirmLabel: "ตรวจผ่าน",
        icon: <Check className="size-5" />,
        buttonIcon: <Check className="size-4" />,
        titleTone: "text-blue-700",
        buttonClass: "",
      };
    case "approve":
      return {
        title: "อนุมัติโครงการ",
        description: "ระบบจะอนุมัติโครงการและกันวงเงินตาม workflow/งบประมาณเดิม",
        confirmLabel: "อนุมัติ",
        icon: <CheckCircle2 className="size-5" />,
        buttonIcon: <CheckCircle2 className="size-4" />,
        titleTone: "text-emerald-700",
        buttonClass: "bg-emerald-600 text-white hover:bg-emerald-700",
      };
    case "reject":
      return {
        title: "ตีกลับโครงการ",
        description: "โครงการจะถูกตีกลับให้ผู้รับผิดชอบปรับแก้ พร้อมบันทึกเหตุผลประกอบ",
        confirmLabel: "ยืนยันตีกลับ",
        icon: <RotateCcw className="size-5" />,
        buttonIcon: <XCircle className="size-4" />,
        titleTone: "text-rose-700",
        buttonClass: "bg-rose-600 text-white hover:bg-rose-700",
      };
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, search: string) {
  if (!search) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${escapeRegExp(search)})`, "gi"));
  return (
    <span>
      {parts.map((part, index) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-0.5 font-semibold text-amber-950">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
}

function formatProjectDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "ยังไม่ระบุช่วงเวลา";
  return `${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}`;
}

function isBudgetActive(project: ProjectRow) {
  return (
    project.status === "APPROVED" ||
    project.status === "IN_PROGRESS" ||
    project.status === "COMPLETED"
  );
}

function getBudgetProgress(project?: ProjectRow) {
  if (!project || project.budgetApproved <= 0) return 0;
  const spent = project.budgetApproved - project.budgetRemaining;
  return Math.max(0, (spent / project.budgetApproved) * 100);
}

function getProgressTone(percentUsed: number) {
  if (percentUsed <= 60) return "text-emerald-700";
  if (percentUsed <= 85) return "text-amber-700";
  return "text-rose-700";
}

function getRemainingTone(remaining: number, total: number) {
  if (remaining < 0) return "text-rose-700";
  if (total > 0 && remaining <= total * 0.15) return "text-amber-700";
  return "text-emerald-700";
}
