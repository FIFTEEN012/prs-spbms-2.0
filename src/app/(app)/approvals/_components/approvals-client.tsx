"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  FileText,
  Home,
  Loader2,
  MessageSquareText,
  RotateCcw,
  SearchCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  SearchFilterBar,
  type ActiveFilterSummary,
} from "@/components/ui/search-filter-bar";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import {
  defaultApprovalQueueQueryValues,
  type ApprovalQueueQueryValues,
  type ApprovalQueueRow,
  type ApprovalQueueSummary,
} from "@/lib/approval-list-service";
import { useListControls } from "@/lib/use-list-controls";

const STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "เสนอแล้ว (รอตรวจสอบ)" },
  { value: "REVIEWED", label: "ตรวจสอบแล้ว (รออนุมัติ)" },
];

const statusCopy: Record<
  string,
  { label: string; short: string; tone: string; icon: LucideIcon }
> = {
  SUBMITTED: {
    label: "เสนอแล้ว (รอตรวจสอบ)",
    short: "รอตรวจสอบ",
    tone: "border-amber-300 bg-amber-100 text-amber-900",
    icon: Clock3,
  },
  REVIEWED: {
    label: "ตรวจสอบแล้ว (รออนุมัติ)",
    short: "รอผู้บริหารอนุมัติ",
    tone: "border-blue-200 bg-blue-100 text-blue-900",
    icon: SearchCheck,
  },
};

type ApprovalAction = "approve" | "reject";

interface ApprovalsClientProps {
  initialProjects: ApprovalQueueRow[];
  role: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: ApprovalQueueSummary;
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
  summary,
  initialQuery,
  departments,
}: ApprovalsClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialProjects[0]?.id ?? "");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    project: ApprovalQueueRow;
    action: ApprovalAction;
  } | null>(null);
  const [comment, setComment] = useState("");
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

  useEffect(() => {
    if (!initialProjects.some((project) => project.id === selectedId)) {
      setSelectedId(initialProjects[0]?.id ?? "");
    }
  }, [initialProjects, selectedId]);

  const selectedProject =
    initialProjects.find((project) => project.id === selectedId) ??
    initialProjects[0] ??
    null;

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
          STATUS_OPTIONS.find((option) => option.value === appliedValues.status)
            ?.label ?? appliedValues.status,
      });
    }
    if (appliedValues.departmentId) {
      items.push({
        key: "departmentId",
        label: "ฝ่าย/กลุ่มงาน",
        value:
          departments.find(
            (department) => department.id === appliedValues.departmentId,
          )?.name ?? appliedValues.departmentId,
      });
    }

    return items;
  }, [appliedValues, departments]);

  const roleDescription = getRoleDescription(role);

  const openAction = (project: ApprovalQueueRow, action: ApprovalAction) => {
    setSelectedId(project.id);
    setError(null);
    setSuccess(null);
    setComment("");
    setActionDialog({ project, action });
  };

  const handleBulkApprove = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/projects/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectIds: initialProjects.map((project) => project.id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || "เกิดข้อผิดพลาดในการอนุมัติโครงการ",
        );
      }

      setSuccess(`อนุมัติโครงการสำเร็จ ${data.count} รายการ`);
      setBulkConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectAction = async () => {
    if (!actionDialog) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const workflowAction =
      actionDialog.action === "reject"
        ? "reject"
        : actionDialog.project.status === "SUBMITTED"
          ? "review_approve"
          : "approve";

    try {
      const res = await fetch(
        `/api/projects/${actionDialog.project.id}/workflow`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: workflowAction, comment }),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถดำเนินการได้");
      }

      setSuccess(
        actionDialog.action === "reject"
          ? "ตีกลับโครงการแล้ว"
          : "อนุมัติโครงการแล้ว",
      );
      setActionDialog(null);
      setComment("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-6">
          <div className="space-y-3">
            <nav className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Home className="h-3.5 w-3.5" />
              <span>หน้าหลัก</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-primary">งานอนุมัติ</span>
            </nav>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                งานอนุมัติ
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {roleDescription}
              </p>
            </div>
          </div>

          {initialProjects.length > 0 && (
            <Button
              onClick={() => {
                setError(null);
                setSuccess(null);
                setBulkConfirmOpen(true);
              }}
              className="h-11 rounded-lg bg-emerald-700 px-4 font-bold text-white shadow-sm hover:bg-emerald-800"
            >
              <CheckSquare className="h-4 w-4" />
              อนุมัติทั้งหมดในหน้านี้
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="รอดำเนินการ"
          value={summary.pending}
          helper="รายการในคิวอนุมัติ"
          icon={ClipboardCheck}
          tone="border-l-4 border-l-yellow-400"
          badge={summary.pending > 0 ? "ต้องติดตาม" : "เรียบร้อย"}
        />
        <SummaryCard
          title="รอตรวจสอบ"
          value={summary.submitted}
          helper="รอหัวหน้ากลุ่มงานตรวจ"
          icon={Clock3}
          tone="border-l-4 border-l-amber-400"
        />
        <SummaryCard
          title="รอผู้บริหารอนุมัติ"
          value={summary.reviewed}
          helper="ผ่านการตรวจสอบแล้ว"
          icon={SearchCheck}
          tone="border-l-4 border-l-blue-700"
        />
        <SummaryCard
          title="งบประมาณรวม"
          value={formatBaht(summary.totalBudgetRequested)}
          helper="ยอดเสนอขอในคิวนี้"
          icon={Banknote}
          tone="border-l-4 border-l-emerald-600"
          valueClassName="text-xl"
        />
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

      {success && (
        <AlertBox tone="success" icon={CheckCircle2}>
          {success}
        </AlertBox>
      )}

      {error && !bulkConfirmOpen && !actionDialog && (
        <AlertBox tone="error" icon={AlertTriangle}>
          {error}
        </AlertBox>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <QueueTabs summary={summary} />

          <Card className="overflow-hidden rounded-lg border-border/70">
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4 font-bold">รหัสโครงการ</th>
                      <th className="px-5 py-4 font-bold">ชื่อโครงการ</th>
                      <th className="px-5 py-4 font-bold">
                        ฝ่าย/ผู้รับผิดชอบ
                      </th>
                      <th className="px-5 py-4 text-right font-bold">
                        งบประมาณที่ขอ
                      </th>
                      <th className="px-5 py-4 font-bold">สถานะ</th>
                      <th className="px-5 py-4 font-bold">อัปเดตล่าสุด</th>
                      <th className="px-5 py-4 text-center font-bold">
                        การดำเนินการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {initialProjects.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyQueue />
                        </td>
                      </tr>
                    ) : (
                      initialProjects.map((project) => (
                        <ProjectRow
                          key={project.id}
                          project={project}
                          selected={selectedProject?.id === project.id}
                          onSelect={() => setSelectedId(project.id)}
                          onAction={openAction}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-3 lg:hidden">
                {initialProjects.length === 0 ? (
                  <EmptyQueue />
                ) : (
                  initialProjects.map((project) => (
                    <ProjectMobileCard
                      key={project.id}
                      project={project}
                      selected={selectedProject?.id === project.id}
                      onSelect={() => setSelectedId(project.id)}
                      onAction={openAction}
                    />
                  ))
                )}
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
        </div>

        <ProjectDetailPanel
          project={selectedProject}
          onAction={openAction}
        />
      </div>

      {bulkConfirmOpen && (
        <BulkConfirmModal
          count={initialProjects.length}
          loading={loading}
          error={error}
          onClose={() => setBulkConfirmOpen(false)}
          onConfirm={handleBulkApprove}
        />
      )}

      {actionDialog && (
        <ActionConfirmModal
          project={actionDialog.project}
          action={actionDialog.action}
          comment={comment}
          loading={loading}
          error={error}
          onCommentChange={setComment}
          onClose={() => {
            setActionDialog(null);
            setComment("");
          }}
          onConfirm={handleProjectAction}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
  badge,
  valueClassName = "text-2xl",
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone: string;
  badge?: string;
  valueClassName?: string;
}) {
  return (
    <Card className={`rounded-lg ${tone}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          {badge && (
            <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-900">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
          <p className={`${valueClassName} mt-1 font-extrabold text-foreground`}>
            {value}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {helper}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueTabs({ summary }: { summary: ApprovalQueueSummary }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur">
      <span className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm">
        รอดำเนินการ
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {summary.pending}
        </span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-muted-foreground">
        รอตรวจสอบ
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {summary.submitted}
        </span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-muted-foreground">
        รออนุมัติ
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {summary.reviewed}
        </span>
      </span>
    </div>
  );
}

function ProjectRow({
  project,
  selected,
  onSelect,
  onAction,
}: {
  project: ApprovalQueueRow;
  selected: boolean;
  onSelect: () => void;
  onAction: (project: ApprovalQueueRow, action: ApprovalAction) => void;
}) {
  return (
    <tr
      className={`cursor-pointer border-l-4 transition-colors ${
        selected
          ? "border-l-primary bg-primary/5"
          : "border-l-transparent hover:border-l-primary/60 hover:bg-muted/35"
      }`}
      onClick={onSelect}
    >
      <td className="px-5 py-5 font-mono text-xs font-bold text-muted-foreground">
        {project.projectCode}
      </td>
      <td className="px-5 py-5">
        <div className="max-w-[280px]">
          <p className="line-clamp-2 font-bold text-foreground group-hover:text-primary">
            {project.projectName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatPeriod(project)}
          </p>
        </div>
      </td>
      <td className="px-5 py-5">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Building2 className="h-3.5 w-3.5" />
            {project.department?.name ?? "-"}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
            {project.responsibleUser?.fullName ?? "-"}
          </p>
        </div>
      </td>
      <td className="px-5 py-5 text-right">
        <span className="font-mono text-base font-extrabold text-foreground">
          {formatBaht(project.budgetRequested)}
        </span>
      </td>
      <td className="px-5 py-5">
        <StatusBadge status={project.status} />
      </td>
      <td className="px-5 py-5 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatThaiDate(project.updatedAt)}
        </span>
      </td>
      <td className="px-5 py-5">
        <div
          className="flex items-center justify-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <IconActionButton
            label="อนุมัติ"
            tone="approve"
            onClick={() => onAction(project, "approve")}
          />
          <IconActionButton
            label="ตีกลับ"
            tone="reject"
            onClick={() => onAction(project, "reject")}
          />
        </div>
      </td>
    </tr>
  );
}

function ProjectMobileCard({
  project,
  selected,
  onSelect,
  onAction,
}: {
  project: ApprovalQueueRow;
  selected: boolean;
  onSelect: () => void;
  onAction: (project: ApprovalQueueRow, action: ApprovalAction) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border/70 bg-background/70 hover:border-primary/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold text-muted-foreground">
            {project.projectCode}
          </p>
          <p className="mt-1 font-bold text-foreground">{project.projectName}</p>
        </div>
        <StatusBadge status={project.status} compact />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <InfoLine icon={Building2} label={project.department?.name ?? "-"} />
        <InfoLine
          icon={UserRound}
          label={project.responsibleUser?.fullName ?? "-"}
        />
        <InfoLine icon={CalendarDays} label={formatPeriod(project)} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            งบประมาณที่ขอ
          </p>
          <p className="font-mono text-base font-extrabold text-foreground">
            {formatBaht(project.budgetRequested)}
          </p>
        </div>
        <div
          className="flex gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <IconActionButton
            label="อนุมัติ"
            tone="approve"
            onClick={() => onAction(project, "approve")}
          />
          <IconActionButton
            label="ตีกลับ"
            tone="reject"
            onClick={() => onAction(project, "reject")}
          />
        </div>
      </div>
    </button>
  );
}

function ProjectDetailPanel({
  project,
  onAction,
}: {
  project: ApprovalQueueRow | null;
  onAction: (project: ApprovalQueueRow, action: ApprovalAction) => void;
}) {
  if (!project) {
    return (
      <aside className="xl:sticky xl:top-24">
        <Card className="rounded-lg">
          <CardContent className="p-6">
            <EmptyQueue compact />
          </CardContent>
        </Card>
      </aside>
    );
  }

  return (
    <aside className="xl:sticky xl:top-24 xl:self-start">
      <Card className="rounded-lg">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                ตัวอย่างรายละเอียด
              </p>
              <h2 className="mt-1 line-clamp-3 text-lg font-extrabold text-primary">
                {project.projectName}
              </h2>
            </div>
            <StatusBadge status={project.status} compact />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DetailMetric label="รหัส" value={project.projectCode} />
            <DetailMetric
              label="งบประมาณ"
              value={formatBaht(project.budgetRequested)}
              strong
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-4">
            <InfoLine icon={Building2} label={project.department?.name ?? "-"} />
            <InfoLine
              icon={UserRound}
              label={project.responsibleUser?.fullName ?? "-"}
            />
            <InfoLine icon={CalendarDays} label={formatPeriod(project)} />
          </div>

          <div className="rounded-lg border border-border/70 bg-background/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
              <MessageSquareText className="h-4 w-4" />
              วัตถุประสงค์โดยย่อ
            </div>
            <p className="line-clamp-5 text-sm leading-6 text-foreground">
              {project.objectives?.trim() || "ยังไม่มีข้อมูลวัตถุประสงค์"}
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-full rounded-lg font-bold"
          >
            <Link href={`/projects/${project.id}`}>
              <Eye className="h-4 w-4" />
              ดูรายละเอียดเต็ม
            </Link>
          </Button>

          <div className="grid gap-2">
            <Button
              className="h-12 rounded-lg bg-emerald-700 font-extrabold text-white hover:bg-emerald-800"
              onClick={() => onAction(project, "approve")}
            >
              <CheckCircle2 className="h-5 w-5" />
              อนุมัติโครงการนี้
            </Button>
            <Button
              variant="destructive"
              className="h-12 rounded-lg font-extrabold"
              onClick={() => onAction(project, "reject")}
            >
              <RotateCcw className="h-5 w-5" />
              ตีกลับ/แก้ไข
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const copy = statusCopy[status];
  if (!copy) {
    return (
      <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
        {status}
      </span>
    );
  }

  const Icon = copy.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${copy.tone}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {compact ? copy.short : copy.label}
    </span>
  );
}

function IconActionButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "approve" | "reject";
  onClick: () => void;
}) {
  const approve = tone === "approve";
  const Icon = approve ? CheckCircle2 : XCircle;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm transition active:scale-95 ${
        approve ? "bg-emerald-700 hover:bg-emerald-800" : "bg-red-700 hover:bg-red-800"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function BulkConfirmModal({
  count,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  count: number;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalFrame title="ยืนยันการอนุมัติทั้งหมด" icon={CheckSquare} onClose={onClose} loading={loading}>
      {error && (
        <AlertBox tone="error" icon={AlertTriangle}>
          {error}
        </AlertBox>
      )}
      <p className="text-sm leading-6 text-foreground">
        ต้องการอนุมัติโครงการในหน้าปัจจุบันจำนวน{" "}
        <strong className="text-emerald-700">{count} โครงการ</strong> หรือไม่
        ระบบจะอัปเดตสถานะตามขั้นตอนของแต่ละโครงการทันที
      </p>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
        การอนุมัติแบบกลุ่มจะใช้รายการที่แสดงอยู่ในหน้าปัจจุบันตามตัวกรองและการแบ่งหน้า
      </div>
      <ModalActions
        loading={loading}
        confirmLabel="ยืนยันอนุมัติทั้งหมด"
        confirmIcon={Check}
        confirmClassName="bg-emerald-700 hover:bg-emerald-800"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </ModalFrame>
  );
}

function ActionConfirmModal({
  project,
  action,
  comment,
  loading,
  error,
  onCommentChange,
  onClose,
  onConfirm,
}: {
  project: ApprovalQueueRow;
  action: ApprovalAction;
  comment: string;
  loading: boolean;
  error: string | null;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const approve = action === "approve";
  const title = approve ? "ยืนยันการอนุมัติ" : "ยืนยันการตีกลับ";
  const Icon = approve ? CheckCircle2 : RotateCcw;

  return (
    <ModalFrame title={title} icon={Icon} onClose={onClose} loading={loading}>
      {error && (
        <AlertBox tone="error" icon={AlertTriangle}>
          {error}
        </AlertBox>
      )}
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
        <p className="font-mono text-xs font-bold text-muted-foreground">
          {project.projectCode}
        </p>
        <p className="mt-1 font-bold text-foreground">{project.projectName}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {project.department?.name ?? "-"} ·{" "}
          {formatBaht(project.budgetRequested)}
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-bold text-foreground">
          ความเห็นประกอบการพิจารณา
        </span>
        <textarea
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-input bg-background/90 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          placeholder={
            approve
              ? "เช่น ตรวจสอบข้อมูลแล้ว เห็นควรอนุมัติ"
              : "ระบุเหตุผลที่ต้องการให้แก้ไข"
          }
        />
      </label>
      <ModalActions
        loading={loading}
        confirmLabel={approve ? "ยืนยันอนุมัติ" : "ยืนยันตีกลับ"}
        confirmIcon={approve ? Check : RotateCcw}
        confirmClassName={
          approve ? "bg-emerald-700 hover:bg-emerald-800" : "bg-red-700 hover:bg-red-800"
        }
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </ModalFrame>
  );
}

function ModalFrame({
  title,
  icon: Icon,
  loading,
  onClose,
  children,
}: {
  title: string;
  icon: LucideIcon;
  loading: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  loading,
  confirmLabel,
  confirmIcon: ConfirmIcon,
  confirmClassName,
  onClose,
  onConfirm,
}: {
  loading: boolean;
  confirmLabel: string;
  confirmIcon: LucideIcon;
  confirmClassName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={loading}
        className="rounded-lg"
      >
        ยกเลิก
      </Button>
      <Button
        type="button"
        onClick={onConfirm}
        disabled={loading}
        className={`min-w-[140px] rounded-lg text-white ${confirmClassName}`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังบันทึก...
          </>
        ) : (
          <>
            <ConfirmIcon className="h-4 w-4" />
            {confirmLabel}
          </>
        )}
      </Button>
    </div>
  );
}

function AlertBox({
  tone,
  icon: Icon,
  children,
}: {
  tone: "success" | "error";
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm font-semibold ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        className={`mt-1 break-words ${
          strong
            ? "font-mono text-sm font-extrabold text-emerald-700"
            : "font-mono text-sm font-bold text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{label}</span>
    </p>
  );
}

function EmptyQueue({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center text-muted-foreground ${
        compact ? "py-8" : "p-12"
      }`}
    >
      <FileText className="h-10 w-10 text-muted-foreground/45" />
      <p className="mt-3 text-sm font-bold">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
      <p className="mt-1 text-xs">
        ปรับตัวกรองหรือค้นหาด้วยรหัส/ชื่อโครงการอีกครั้ง
      </p>
    </div>
  );
}

function getRoleDescription(role: string) {
  if (role === "DEPT_HEAD") {
    return "โครงการที่รอหัวหน้ากลุ่มงานตรวจสอบก่อนส่งต่อผู้บริหาร";
  }
  if (role === "EXECUTIVE") {
    return "โครงการที่ผ่านการตรวจสอบและรอผู้บริหารอนุมัติงบประมาณ";
  }
  if (role === "SUPER_ADMIN") {
    return "โครงการทั้งหมดที่อยู่ในขั้นตอนเสนอขอและตรวจสอบ";
  }
  return "คุณไม่มีงานอนุมัติในบทบาทนี้";
}

function formatPeriod(project: ApprovalQueueRow) {
  if (!project.startDate && !project.endDate) return "ไม่ระบุช่วงเวลา";
  if (project.startDate && project.endDate) {
    return `${formatThaiDate(project.startDate)} - ${formatThaiDate(project.endDate)}`;
  }
  return project.startDate
    ? `เริ่ม ${formatThaiDate(project.startDate)}`
    : `สิ้นสุด ${formatThaiDate(project.endDate)}`;
}
