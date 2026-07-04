"use client";

import {
  useMemo,
  useState,
  useTransition,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileClock,
  FolderKanban,
  History,
  Inbox,
  Landmark,
  LayoutGrid,
  Lock,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatBaht, formatThaiDate } from "@/lib/utils";
import { BudgetDeleteButton } from "../_delete-button";
import { BudgetEntry } from "../_entry";

const WALLET_LABELS: Record<string, string> = {
  RESERVE: "งบสำรอง",
  UTILITIES: "ค่าสาธารณูปโภค",
  CENTRAL: "งบกลาง",
  ACADEMIC: "กลุ่มบริหารวิชาการ",
  BUDGET: "กลุ่มบริหารงบประมาณ",
  PERSONNEL: "กลุ่มบริหารงานบุคคล",
  GENERAL: "กลุ่มบริหารทั่วไป",
  LEARNER_ACTIVITY: "กิจกรรมพัฒนาผู้เรียน",
  SCHOOL_INCOME: "รายได้สถานศึกษา",
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  ALLOCATION: "จัดสรรงบประมาณ",
  COMMITMENT: "กันวงเงิน",
  COMMITMENT_RELEASE: "คืนวงเงินกัน",
  DISBURSEMENT: "จ่ายจริง",
  REFUND: "คืนเงิน",
  TRANSFER_IN: "โอนเข้า",
  TRANSFER_OUT: "โอนออก",
  ADJUSTMENT_INCREASE: "ปรับเพิ่ม",
  ADJUSTMENT_DECREASE: "ปรับลด",
  ADJUSTMENT_DECREMENT: "ปรับลด",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  DEPT_HEAD: "หัวหน้ากลุ่มงาน",
  TEACHER: "ครูผู้รับผิดชอบโครงการ",
  FINANCE: "เจ้าหน้าที่การเงิน",
  PROCUREMENT: "เจ้าหน้าที่พัสดุ",
  COMMITTEE: "คณะกรรมการสถานศึกษา",
};

interface WalletItem {
  id: string;
  code: string;
  name: string;
  spendMode: string;
  allocated: number;
  committed: number;
  spent: number;
  available: number;
  progress: number;
  status: string;
  departmentId: string | null;
}

interface ProjectSummaryItem {
  id: string;
  projectCode: string;
  projectName: string;
  departmentName: string;
  budgetApproved: number;
  spent: number;
  remaining: number;
  spentPct: number;
  departmentId: string | null;
  responsibleUserId: string | null;
  status: string;
}

interface TransactionItem {
  id: string;
  postedAt: string;
  entryType: string;
  description: string;
  amount: number;
  walletName: string;
  walletCode: string;
  postedByName: string;
  postedByRole: string;
}

interface WarningItem {
  id: string;
  type: "wallet" | "project" | "pr";
  name: string;
  reason: string;
  severity: "warning" | "danger" | "info";
  amount: number;
}

interface BudgetClientProps {
  role: string;
  userDeptId: string | null;
  userId: string;
  canViewAllocation: boolean;
  academicYears: Array<{ id: string; yearName: string }>;
  selectedYearId: string;
  hasLockedPlan: boolean;
  planName: string | null;
  fiscalYearName: string | null;
  summary: {
    totalBudget: number;
    projectApproved: number;
    committed: number;
    spent: number;
    available: number;
    spentPct: number;
    committedPct: number;
    availablePct: number;
  };
  wallets: WalletItem[];
  departments: Array<{
    name: string;
    code: string;
    allocated: number;
    committed: number;
    spent: number;
    available: number;
    progress: number;
    status: string;
    departmentId: string | null;
  }>;
  topProjects: ProjectSummaryItem[];
  allProjects: ProjectSummaryItem[];
  transactions: TransactionItem[];
  totalTransactions: number;
  currentPage: number;
  warnings: WarningItem[];
}

export function BudgetClient({
  role,
  userDeptId,
  userId,
  canViewAllocation,
  academicYears,
  selectedYearId,
  hasLockedPlan,
  planName,
  fiscalYearName,
  summary,
  wallets,
  departments,
  topProjects,
  allProjects,
  transactions,
  totalTransactions,
  currentPage,
  warnings,
}: BudgetClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"dashboard" | "projects">("dashboard");

  const [searchVal, setSearchVal] = useState(searchParams.get("search") || "");
  const selectedType = searchParams.get("type") || "";
  const selectedWallet = searchParams.get("walletId") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const selectedYear = academicYears.find((year) => year.id === selectedYearId);
  const totalPages = Math.ceil(totalTransactions / 10);
  const showRecordCol = allProjects.some((project) => {
    if (role === "SUPER_ADMIN" || role === "FINANCE") return true;
    return (
      (role === "TEACHER" || role === "DEPT_HEAD") &&
      userDeptId != null &&
      userDeptId === project.departmentId
    );
  });

  const usageRate = summary.totalBudget > 0 ? (1 - summary.available / summary.totalBudget) * 100 : 0;
  const warningTotals = useMemo(
    () => ({
      danger: warnings.filter((warning) => warning.severity === "danger").length,
      warning: warnings.filter((warning) => warning.severity === "warning").length,
      info: warnings.filter((warning) => warning.severity === "info").length,
    }),
    [warnings],
  );

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") {
      params.set("page", "1");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleFilterChange("search", searchVal);
  };

  const handleClearFilters = () => {
    setSearchVal("");
    const params = new URLSearchParams();
    if (selectedYearId) {
      params.set("yearId", selectedYearId);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const canRecordBudget = (project: ProjectSummaryItem) => {
    if (role === "SUPER_ADMIN" || role === "FINANCE") return true;
    return (
      (role === "TEACHER" || role === "DEPT_HEAD") &&
      userDeptId != null &&
      userDeptId === project.departmentId
    );
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="rounded-xl border border-outline-variant/70 bg-white/80 p-6 shadow-sm backdrop-blur md:p-7">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Link className="transition-colors hover:text-primary" href="/dashboard">
              หน้าแรก
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground">งบประมาณ</span>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-primary">งบประมาณ</h1>
                  <p className="text-sm font-medium text-muted-foreground">
                    ติดตามการจัดสรร กันวงเงิน ใช้จ่ายจริง และความพร้อมใช้งบของทั้งโรงเรียน
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={hasLockedPlan ? "blue" : "amber"} icon={hasLockedPlan ? Lock : AlertTriangle}>
                  {hasLockedPlan ? "แผนงบประมาณล็อกแล้ว" : "ยังไม่มีแผนงบประมาณพร้อมใช้งาน"}
                </Pill>
                {selectedYear && (
                  <Pill tone="slate" icon={CalendarRange}>
                    ปีการศึกษา {selectedYear.yearName}
                  </Pill>
                )}
                {fiscalYearName ? (
                  <Pill tone="violet" icon={Landmark}>
                    ปีงบประมาณ {fiscalYearName}
                  </Pill>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:min-w-[280px] sm:max-w-[340px]">
              <label className="text-xs font-bold text-muted-foreground">ปีการศึกษา</label>
              <select
                className="h-11 rounded-lg border border-outline-variant bg-background px-4 text-sm font-semibold text-foreground shadow-sm outline-none ring-0 transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                value={selectedYearId}
                onChange={(event) => handleFilterChange("yearId", event.target.value)}
              >
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    ปีการศึกษา {year.yearName}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-2">
                {canViewAllocation && (
                  <Button asChild className="h-11 rounded-lg px-4 text-sm font-bold shadow-lg shadow-primary/20">
                    <Link href="/budget-allocation">
                      <LayoutGrid className="h-4 w-4" />
                      ดูแผนจัดสรรงบ
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" className="h-11 rounded-lg px-4 text-sm font-bold">
                  <Link href="/projects">
                    <FolderKanban className="h-4 w-4" />
                    ไปหน้าโครงการ
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section
        className={cn(
          "overflow-hidden rounded-xl border p-6 shadow-lg md:p-7",
          hasLockedPlan
            ? "border-primary/15 bg-[linear-gradient(135deg,#1e00a9,#0842a1)] text-white shadow-primary/15"
            : "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.92))]",
        )}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg",
                  hasLockedPlan ? "bg-white/10 text-white" : "bg-amber-100 text-amber-700",
                )}
              >
                {hasLockedPlan ? <CheckCircle2 className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
              </div>
              <div>
                <h2 className={cn("text-xl font-black", hasLockedPlan ? "text-white" : "text-foreground")}>
                  {hasLockedPlan ? "งบประมาณพร้อมใช้งานแล้ว" : "ยังไม่มีแผนงบประมาณที่ล็อกแล้ว"}
                </h2>
                <p className={cn("text-sm", hasLockedPlan ? "text-white/80" : "text-muted-foreground")}>
                  {hasLockedPlan
                    ? `ระบบกำลังติดตามงบจากแผน ${planName || "แผนปัจจุบัน"} แบบเรียลไทม์ พร้อมใช้ควบคุมการกันวงเงินและการเบิกจ่าย`
                    : "กรุณาจัดทำและล็อกแผนงบประมาณประจำปี ก่อนเริ่มติดตามการกันวงเงินและการเบิกจ่ายในหน้านี้"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <InfoStat label="งบรวมทั้งปี" value={formatBaht(summary.totalBudget)} />
              <InfoStat label="คำเตือนที่ต้องดู" value={`${warnings.length} รายการ`} />
              <InfoStat label="โครงการในปีนี้" value={`${allProjects.length} โครงการ`} />
            </div>
          </div>

          <div className="rounded-xl border border-white/60 bg-white/85 p-5 shadow-sm backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">สถานะปีการศึกษา</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-muted-foreground">ปีที่เลือก</span>
                <span className="text-foreground">{selectedYear ? `ปีการศึกษา ${selectedYear.yearName}` : "-"}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-muted-foreground">ปีงบประมาณ</span>
                <span className="text-foreground">{fiscalYearName || "-"}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-muted-foreground">พร้อมเบิกจ่าย</span>
                <span className={cn("font-bold", hasLockedPlan ? "text-primary" : "text-amber-700")}>
                  {hasLockedPlan ? "พร้อมใช้งาน" : "รอจัดสรรงบ"}
                </span>
              </div>
            </div>
            {!hasLockedPlan && canViewAllocation ? (
              <Button asChild className="mt-4 h-10 w-full rounded-2xl text-sm font-bold">
                <Link href="/budget-allocation">
                  ไปที่จัดสรรงบประจำปี
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-xl border border-outline-variant/70 bg-white/80 p-1.5 shadow-sm backdrop-blur">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={cn(
            "inline-flex min-h-[42px] items-center justify-center rounded-lg px-4 text-sm font-bold transition",
            activeTab === "dashboard"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
        >
          ภาพรวมติดตามงบประมาณ
        </button>
        <button
          onClick={() => setActiveTab("projects")}
          className={cn(
            "inline-flex min-h-[42px] items-center justify-center rounded-lg px-4 text-sm font-bold transition",
            activeTab === "projects"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
        >
          งบประมาณรายโครงการทั้งหมด
        </button>
      </div>

      {activeTab === "dashboard" ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryMetricCard
                label="งบรวมทั้งหมด"
                value={summary.totalBudget}
                helper="รวมจากแผนงบที่ล็อกแล้ว"
                icon={Landmark}
                accent="blue"
              />
              <SummaryMetricCard
                label="จัดสรรให้โครงการแล้ว"
                value={summary.projectApproved}
                helper="ยอดอนุมัติโครงการรวม"
                icon={FolderKanban}
                accent="indigo"
              />
              <SummaryMetricCard
                label="กันวงเงินแล้ว"
                value={summary.committed}
                helper="รอการจ่ายจริง"
                icon={BookmarkIcon}
                accent="amber"
              />
              <SummaryMetricCard
                label="ใช้จ่ายแล้ว"
                value={summary.spent}
                helper="เบิกจ่ายจริงสะสม"
                icon={CreditCard}
                accent="rose"
              />
              <SummaryMetricCard
                label="งบคงเหลือพร้อมใช้"
                value={summary.available}
                helper="วงเงินที่พร้อมดำเนินการต่อ"
                icon={CircleDollarSign}
                accent="emerald"
                highlight
              />
            </section>

            <Card className="rounded-xl border-outline-variant/70 bg-white/85 shadow-sm backdrop-blur">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg font-black">ภาพรวมการใช้จ่ายงบประมาณ</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      แสดงสัดส่วนการใช้จ่ายจริง การกันวงเงิน และวงเงินที่ยังพร้อมใช้
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
                    <LegendDot color="bg-rose-500" label={`ใช้จ่ายแล้ว ${summary.spentPct.toFixed(0)}%`} />
                    <LegendDot color="bg-amber-500" label={`กันวงเงินแล้ว ${summary.committedPct.toFixed(0)}%`} />
                    <LegendDot color="bg-emerald-500" label={`คงเหลือพร้อมใช้ ${summary.availablePct.toFixed(0)}%`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {hasLockedPlan && summary.totalBudget > 0 ? (
                  <>
                    <div className="overflow-hidden rounded-full bg-slate-100">
                      <div className="flex h-4 w-full overflow-hidden rounded-full">
                        <div className="bg-rose-500 transition-all" style={{ width: `${summary.spentPct}%` }} />
                        <div className="bg-amber-500 transition-all" style={{ width: `${summary.committedPct}%` }} />
                        <div className="bg-emerald-500 transition-all" style={{ width: `${summary.availablePct}%` }} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ProgressFact label="ใช้จ่ายจริง" value={formatBaht(summary.spent)} tone="rose" />
                      <ProgressFact label="กันวงเงิน" value={formatBaht(summary.committed)} tone="amber" />
                      <ProgressFact label="พร้อมใช้ต่อ" value={formatBaht(summary.available)} tone="emerald" />
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={TrendingUp}
                    title="ยังไม่มีข้อมูลพอสำหรับคำนวณสัดส่วน"
                    description="เมื่อมีแผนงบประมาณที่ล็อกแล้ว ระบบจะแสดงภาพรวมการใช้จ่ายในส่วนนี้"
                  />
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-xl border-outline-variant/70 bg-white/90 shadow-sm">
              <CardHeader className="border-b border-outline-variant/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black">กระเป๋างบประมาณหลัก</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      สรุปการจัดสรร กันวงเงิน ใช้จ่าย และวงเงินคงเหลือของแต่ละกระเป๋า
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {hasLockedPlan ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full text-left text-sm">
                      <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                          <th className="px-6 py-4 font-bold">กระเป๋างบ</th>
                          <th className="px-6 py-4 text-right font-bold">จัดสรร</th>
                          <th className="px-6 py-4 text-right font-bold">กันวงเงิน</th>
                          <th className="px-6 py-4 text-right font-bold">ใช้จ่ายแล้ว</th>
                          <th className="px-6 py-4 text-right font-bold">คงเหลือพร้อมใช้</th>
                          <th className="px-6 py-4 text-center font-bold">สถานะ</th>
                          <th className="px-6 py-4 font-bold">ความคืบหน้า</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {wallets.map((wallet) => {
                          const isMine = wallet.departmentId != null && wallet.departmentId === userDeptId;
                          const statusTone = getWalletStatusTone(wallet.status, wallet.available);

                          return (
                            <tr
                              key={wallet.id}
                              className={cn(
                                "transition hover:bg-surface-container-low/70",
                                isMine && "bg-primary/[0.04] hover:bg-primary/[0.07]",
                              )}
                            >
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                      href={`/budget-wallets/${wallet.id}`}
                                      className="font-bold text-foreground transition hover:text-primary"
                                    >
                                      {WALLET_LABELS[wallet.code] || wallet.name}
                                    </Link>
                                    {isMine ? <TinyBadge>กลุ่มงานของฉัน</TinyBadge> : null}
                                  </div>
                                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                    {wallet.spendMode}
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-foreground">
                                {formatBahtShort(wallet.allocated)}
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-semibold text-muted-foreground">
                                {formatBahtShort(wallet.committed)}
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-semibold text-muted-foreground">
                                {formatBahtShort(wallet.spent)}
                              </td>
                              <td className={cn("px-6 py-4 text-right font-mono font-black", statusTone.valueClassName)}>
                                {formatBahtShort(wallet.available)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", statusTone.badgeClassName)}>
                                  {statusTone.label}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex min-w-[132px] items-center gap-3">
                                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={cn("h-full rounded-full transition-all", statusTone.barClassName)}
                                      style={{ width: `${Math.min(100, wallet.progress)}%` }}
                                    />
                                  </div>
                                  <span className="min-w-[34px] text-right font-mono text-xs font-bold text-muted-foreground">
                                    {wallet.progress.toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8">
                    <EmptyState
                      icon={Wallet}
                      title="ยังไม่มีกระเป๋างบประมาณให้ติดตาม"
                      description="เมื่อมีการล็อกแผนงบประมาณประจำปี ระบบจะแสดงกระเป๋างบประมาณทั้งหมดที่นี่"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {hasLockedPlan ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {departments.map((department) => {
                  const isMine = department.departmentId != null && department.departmentId === userDeptId;
                  const icon = getDepartmentIcon(department.code);
                  const Icon = icon;
                  return (
                    <Card
                      key={department.code}
                      className={cn(
                        "rounded-xl border-outline-variant/70 bg-white/85 shadow-sm",
                        isMine && "border-primary/25 bg-primary/[0.04]",
                      )}
                    >
                      <CardContent className="p-5">
                        <div className="flex h-full flex-col justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Icon className="h-5 w-5" />
                              </div>
                              {isMine ? <TinyBadge>กลุ่มงานของฉัน</TinyBadge> : null}
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-foreground">{department.name}</h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                พร้อมใช้ {formatBahtShort(department.available)} จากที่จัดสรร {formatBahtShort(department.allocated)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                              <span>การใช้จ่ายสะสม</span>
                              <span>{department.progress.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(100, department.progress)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </section>
            ) : null}

            <Card className="overflow-hidden rounded-xl border-outline-variant/70 bg-white/90 shadow-sm">
              <CardHeader className="border-b border-outline-variant/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black">โครงการที่ใช้งบสูงสุด</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      ช่วยเห็นโครงการที่ใกล้ใช้วงเงินเต็มเร็วที่สุดในปีการศึกษานี้
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {hasLockedPlan ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[860px] w-full text-left text-sm">
                      <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                          <th className="px-6 py-4 font-bold">รหัส / ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-bold">กลุ่มงาน</th>
                          <th className="px-6 py-4 text-right font-bold">งบอนุมัติ</th>
                          <th className="px-6 py-4 text-right font-bold">ใช้จ่ายจริง</th>
                          <th className="px-6 py-4 text-right font-bold">คงเหลือ</th>
                          <th className="px-6 py-4 text-center font-bold">ใช้ไปแล้ว</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {topProjects.length > 0 ? (
                          topProjects.map((project) => {
                            const isWarning = project.spentPct >= 85;
                            return (
                              <tr
                                key={project.id}
                                className={cn("transition hover:bg-surface-container-low/70", isWarning && "bg-rose-50/40")}
                              >
                                <td className="px-6 py-4">
                                  <div className="space-y-1">
                                    <Link
                                      href={`/projects/${project.id}`}
                                      className="font-bold text-foreground transition hover:text-primary"
                                    >
                                      {project.projectCode}
                                    </Link>
                                    <p className="max-w-[320px] truncate text-sm text-muted-foreground">
                                      {project.projectName}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-medium text-muted-foreground">{project.departmentName}</td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-foreground">
                                  {formatBahtShort(project.budgetApproved)}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-semibold text-rose-600">
                                  -{formatBahtShort(project.spent)}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-emerald-700">
                                  {formatBahtShort(project.remaining)}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className={cn("font-mono text-sm font-black", isWarning ? "text-rose-600" : "text-foreground")}>
                                      {project.spentPct.toFixed(1)}%
                                    </span>
                                    {isWarning ? <AlertTriangle className="h-4 w-4 text-rose-500" /> : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-10">
                              <EmptyState
                                icon={FolderKanban}
                                title="ยังไม่มีประวัติการใช้จ่ายโครงการ"
                                description="เมื่อเริ่มมีการบันทึกงบ ระบบจะจัดอันดับโครงการที่ใช้จ่ายสูงสุดให้อัตโนมัติ"
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8">
                    <EmptyState
                      icon={FolderKanban}
                      title="ยังไม่สามารถจัดอันดับโครงการได้"
                      description="ระบบต้องมีแผนงบประมาณพร้อมใช้งานก่อน จึงจะเริ่มติดตามการใช้จ่ายรายโครงการ"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-xl border-outline-variant/70 bg-white/90 shadow-sm">
              <CardHeader className="border-b border-outline-variant/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black">ประวัติการเคลื่อนไหวงบประมาณ</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      ค้นหาและกรองรายการบัญชีที่เกิดขึ้นในปีการศึกษาที่เลือก
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-b border-outline-variant/70 bg-surface-container-low/70 p-6">
                  <form onSubmit={handleSearchSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <div className="xl:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold text-muted-foreground">ค้นหารายการ</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="คำอธิบาย หรือชื่อกระเป๋างบ"
                          value={searchVal}
                          onChange={(event) => setSearchVal(event.target.value)}
                          className="h-11 rounded-2xl border-border/70 bg-white pl-10"
                        />
                      </div>
                    </div>

                    <FilterSelect
                      label="ประเภทรายการ"
                      value={selectedType}
                      onChange={(value) => handleFilterChange("type", value)}
                    >
                      <option value="">ทั้งหมด</option>
                      {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </FilterSelect>

                    <FilterSelect
                      label="กระเป๋างบประมาณ"
                      value={selectedWallet}
                      onChange={(value) => handleFilterChange("walletId", value)}
                    >
                      <option value="">ทั้งหมด</option>
                      {wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {WALLET_LABELS[wallet.code] || wallet.name}
                        </option>
                      ))}
                    </FilterSelect>

                    <FilterDate
                      label="วันที่เริ่มต้น"
                      value={startDate}
                      onChange={(value) => handleFilterChange("startDate", value)}
                    />
                    <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                      <FilterDate
                        label="วันที่สิ้นสุด"
                        value={endDate}
                        onChange={(value) => handleFilterChange("endDate", value)}
                      />
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-6 flex h-11 items-center justify-center rounded-2xl border border-border/70 bg-white text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                        title="ล้างตัวกรอง"
                      >
                        <Inbox className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="bg-white text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="px-6 py-4 font-bold">วันที่บันทึก</th>
                        <th className="px-6 py-4 font-bold">ประเภทรายการ</th>
                        <th className="px-6 py-4 font-bold">รายละเอียด</th>
                        <th className="px-6 py-4 font-bold">กระเป๋างบประมาณ</th>
                        <th className="px-6 py-4 text-right font-bold">จำนวนเงิน</th>
                        <th className="px-6 py-4 font-bold">ผู้บันทึก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {transactions.length > 0 ? (
                        transactions.map((entry) => {
                          const negative = [
                            "COMMITMENT",
                            "DISBURSEMENT",
                            "TRANSFER_OUT",
                            "ADJUSTMENT_DECREMENT",
                            "ADJUSTMENT_DECREASE",
                          ].includes(entry.entryType);

                          return (
                            <tr key={entry.id} className="transition hover:bg-surface-container-low/70">
                              <td className="px-6 py-4 font-medium text-muted-foreground">
                                {formatThaiDate(entry.postedAt)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", getEntryTypeTone(entry.entryType))}>
                                  {ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-[320px] truncate font-medium text-foreground" title={entry.description}>
                                {entry.description}
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-foreground">{entry.walletName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {WALLET_LABELS[entry.walletCode] || entry.walletCode}
                                  </p>
                                </div>
                              </td>
                              <td className={cn("px-6 py-4 text-right font-mono text-sm font-black", negative ? "text-rose-600" : "text-emerald-700")}>
                                {negative ? "-" : "+"}
                                {formatBahtShort(entry.amount)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-foreground">{entry.postedByName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {ROLE_LABELS[entry.postedByRole] || entry.postedByRole}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-10">
                            <EmptyState
                              icon={History}
                              title="ไม่พบรายการตามตัวกรองปัจจุบัน"
                              description="ลองเปลี่ยนช่วงวันที่ ประเภทรายการ หรือคำค้นหา แล้วตรวจสอบอีกครั้ง"
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 ? (
                  <div className="flex flex-col gap-3 border-t border-outline-variant/70 px-6 py-4 text-sm font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      หน้า {currentPage} จาก {totalPages} ทั้งหมด {totalTransactions} รายการ
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage <= 1 || isPending}
                        onClick={() => handleFilterChange("page", String(currentPage - 1))}
                        className="rounded-xl"
                      >
                        ก่อนหน้า
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage >= totalPages || isPending}
                        onClick={() => handleFilterChange("page", String(currentPage + 1))}
                        className="rounded-xl"
                      >
                        ถัดไป
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24">
            <Card className="rounded-xl border-outline-variant/70 bg-white/85 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <BriefcaseBusiness className="h-5 w-5 text-primary" />
                  สรุปงบประมาณ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-primary/10 bg-primary/[0.04] p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    สัดส่วนการใช้งบสะสม
                  </p>
                  <p className="mt-2 text-4xl font-black text-primary">{usageRate.toFixed(0)}%</p>
                  <p className="mt-1 text-sm text-muted-foreground">ของงบทั้งปีในปีการศึกษาที่เลือก</p>
                </div>

                <dl className="space-y-3 text-sm">
                  <InfoRow label="แผนงบประมาณ" value={planName || "-"} />
                  <InfoRow label="ปีการศึกษา" value={selectedYear ? selectedYear.yearName : "-"} />
                  <InfoRow label="โครงการทั้งหมด" value={`${allProjects.length} โครงการ`} />
                  <InfoRow
                    label="โครงการอนุมัติแล้ว"
                    value={`${allProjects.filter((project) => ["APPROVED", "IN_PROGRESS", "COMPLETED"].includes(project.status)).length}`}
                  />
                  <InfoRow label="คำเตือนทั้งหมด" value={`${warnings.length} รายการ`} />
                </dl>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-outline-variant/70 bg-white/85 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <FileClock className="h-5 w-5 text-rose-600" />
                  รายการที่ควรเฝ้าระวัง
                </CardTitle>
                <div className="flex flex-wrap gap-2 pt-1">
                  <TinyBadge tone="rose">เร่งด่วน {warningTotals.danger}</TinyBadge>
                  <TinyBadge tone="amber">เฝ้าระวัง {warningTotals.warning}</TinyBadge>
                  <TinyBadge tone="blue">ติดตาม {warningTotals.info}</TinyBadge>
                </div>
              </CardHeader>
              <CardContent>
                {warnings.length > 0 ? (
                  <div className="space-y-3">
                    {warnings.map((warning) => {
                      const tone = getWarningTone(warning.severity);
                      const warningTypeLabel =
                        warning.type === "wallet"
                          ? "กระเป๋างบประมาณ"
                          : warning.type === "project"
                            ? "โครงการ"
                            : "คำขอจัดซื้อ";

                      return (
                        <div
                          key={warning.id}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-sm shadow-sm",
                            tone.containerClassName,
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className={cn("font-bold", tone.titleClassName)}>{warning.name}</p>
                              <p className="text-xs font-semibold text-muted-foreground">{warningTypeLabel}</p>
                            </div>
                            <tone.Icon className={cn("h-4 w-4 shrink-0", tone.iconClassName)} />
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{warning.reason}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={CheckCircle2}
                    title="ยังไม่มีรายการที่ต้องเฝ้าระวัง"
                    description="ภาพรวมงบประมาณอยู่ในเกณฑ์ปกติ ณ ขณะนี้"
                    compact
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-outline-variant/70 bg-white/85 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  ทางลัดการดำเนินการ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {canViewAllocation ? (
                  <QuickActionLink href="/budget-allocation" icon={LayoutGrid} label="จัดการแผนงบประมาณประจำปี" />
                ) : null}
                <QuickActionLink href="/projects" icon={FolderKanban} label="ดูโครงการทั้งหมด" />
                <QuickActionLink href="/procurement" icon={Building2} label="ดูคำขอจัดซื้อจัดจ้าง" />
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-xl border-outline-variant/70 bg-white/90 shadow-sm">
          <CardHeader className="border-b border-outline-variant/70 pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-lg font-black">งบประมาณรายโครงการทั้งหมด</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  สรุปงบอนุมัติ ใช้จ่ายแล้ว และบันทึกเบิกจ่ายของโครงการที่อนุมัติในปีการศึกษานี้
                </p>
              </div>
              <TinyBadge tone="blue">ทั้งหมด {allProjects.length} รายการ</TinyBadge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-bold">รหัส</th>
                    <th className="px-6 py-4 font-bold">ชื่อโครงการ</th>
                    <th className="px-6 py-4 font-bold">กลุ่มงาน</th>
                    <th className="px-6 py-4 text-right font-bold">งบอนุมัติ</th>
                    <th className="px-6 py-4 text-right font-bold">ใช้จ่ายแล้ว</th>
                    <th className="px-6 py-4 text-right font-bold">คงเหลือ</th>
                    {showRecordCol ? <th className="px-6 py-4 font-bold">บันทึกเบิกจ่าย</th> : null}
                    {role === "SUPER_ADMIN" ? <th className="px-6 py-4 text-center font-bold">จัดการ</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {allProjects.length > 0 ? (
                    allProjects.map((project) => {
                      const isMyProject =
                        project.responsibleUserId === userId ||
                        (project.departmentId != null && project.departmentId === userDeptId);

                      return (
                        <tr
                          key={project.id}
                          className={cn(
                            "align-top transition hover:bg-surface-container-low/70",
                            isMyProject && "bg-primary/[0.03] hover:bg-primary/[0.06]",
                          )}
                        >
                          <td className="px-6 py-5 font-mono text-sm font-bold text-foreground">{project.projectCode}</td>
                          <td className="px-6 py-5">
                            <div className="space-y-1">
                              <Link
                                href={`/projects/${project.id}`}
                                className="font-bold text-foreground transition hover:text-primary"
                              >
                                {project.projectName}
                              </Link>
                              {isMyProject ? (
                                <p className="text-xs font-semibold text-primary">โครงการที่เกี่ยวข้องกับฉัน</p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-5 font-medium text-muted-foreground">{project.departmentName}</td>
                          <td className="px-6 py-5 text-right font-mono font-bold text-foreground">
                            {formatBahtShort(project.budgetApproved)}
                          </td>
                          <td className="px-6 py-5 text-right font-mono font-semibold text-rose-600">
                            -{formatBahtShort(project.spent)}
                          </td>
                          <td className="px-6 py-5 text-right font-mono font-bold text-emerald-700">
                            {formatBahtShort(project.remaining)}
                          </td>
                          {showRecordCol ? (
                            <td className="px-6 py-5 min-w-[320px]">
                              {canRecordBudget(project) ? (
                                <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-3">
                                  <BudgetEntry projectId={project.id} max={project.remaining} />
                                </div>
                              ) : (
                                <span className="text-sm font-semibold text-muted-foreground">ไม่มีสิทธิ์บันทึก</span>
                              )}
                            </td>
                          ) : null}
                          {role === "SUPER_ADMIN" ? (
                            <td className="px-6 py-5 text-center">
                              <BudgetDeleteButton
                                projectId={project.id}
                                projectName={project.projectName}
                                projectCode={project.projectCode}
                              />
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={6 + (showRecordCol ? 1 : 0) + (role === "SUPER_ADMIN" ? 1 : 0)}
                        className="px-6 py-10"
                      >
                        <EmptyState
                          icon={FolderKanban}
                          title="ยังไม่มีโครงการที่ได้รับงบประมาณในปีนี้"
                          description="เมื่อมีโครงการที่อนุมัติงบแล้ว รายการโครงการทั้งหมดจะปรากฏในตารางนี้"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryMetricCard({
  label,
  value,
  helper,
  icon: Icon,
  accent,
  highlight = false,
}: {
  label: string;
  value: number;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  accent: "blue" | "indigo" | "amber" | "rose" | "emerald";
  highlight?: boolean;
}) {
  const accentMap = {
    blue: "bg-primary/10 text-primary",
    indigo: "bg-indigo-500/10 text-indigo-600",
    amber: "bg-amber-500/10 text-amber-700",
    rose: "bg-rose-500/10 text-rose-600",
    emerald: "bg-emerald-500/10 text-emerald-700",
  }[accent];

  return (
    <Card
      className={cn(
        "rounded-xl border-outline-variant/70 bg-white/85 shadow-sm backdrop-blur",
        highlight && "border-emerald-300/50 bg-emerald-50/60",
      )}
    >
      <CardContent className="p-5">
        <div className="grid min-h-[150px] grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="min-w-0 space-y-2">
            <p className="max-w-[11rem] text-[11px] font-bold uppercase leading-5 tracking-[0.08em] text-muted-foreground">
              {label}
            </p>
            <p className="break-words text-[clamp(1.9rem,1.2rem+1vw,2.35rem)] font-black leading-none tracking-tight text-foreground">
              {formatBaht(value)}
            </p>
            <p className="max-w-[12rem] text-xs leading-5 text-muted-foreground">{helper}</p>
          </div>
          <div className={cn("mt-1 flex h-10 w-10 items-center justify-center rounded-2xl shrink-0 self-start", accentMap)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
    <div>
      <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
      >
        {children}
      </select>
    </div>
  );
}

function FilterDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</label>
      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border-border/70 bg-white"
      />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-4" : "py-6")}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function TinyBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "amber" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-100 text-slate-700",
    blue: "border-primary/15 bg-primary/10 text-primary",
    amber: "border-amber-200 bg-amber-100 text-amber-800",
    rose: "border-rose-200 bg-rose-100 text-rose-700",
  }[tone];

  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", tones)}>{children}</span>;
}

function Pill({
  children,
  tone,
  icon: Icon,
}: {
  children: ReactNode;
  tone: "blue" | "amber" | "violet" | "slate";
  icon: ComponentType<{ className?: string }>;
}) {
  const tones = {
    blue: "border-primary/15 bg-primary/10 text-primary",
    amber: "border-amber-200 bg-amber-100 text-amber-800",
    violet: "border-violet-200 bg-violet-100 text-violet-700",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold", tones)}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/75 px-4 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-bold text-foreground">{value}</dd>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}

function ProgressFact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "amber" | "emerald";
}) {
  const className = {
    rose: "border-rose-200 bg-rose-50/70 text-rose-700",
    amber: "border-amber-200 bg-amber-50/80 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
  }[tone];

  return (
    <div className={cn("rounded-2xl border px-4 py-3", className)}>
      <p className="text-xs font-bold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function QuickActionLink({
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
      <span className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span>{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return <BookOpen className={className} />;
}

function formatBahtShort(value: number) {
  return formatBaht(value).replace(" บาท", "");
}

function getWalletStatusTone(status: string, available: number) {
  if (available < 0) {
    return {
      label: "งบไม่พอ",
      badgeClassName: "border-rose-200 bg-rose-100 text-rose-700",
      valueClassName: "text-rose-600",
      barClassName: "bg-rose-500",
    };
  }

  if (status === "CRITICAL") {
    return {
      label: "ใกล้หมด",
      badgeClassName: "border-rose-200 bg-rose-100 text-rose-700",
      valueClassName: "text-rose-600",
      barClassName: "bg-rose-500",
    };
  }

  if (status === "WARNING") {
    return {
      label: "เฝ้าระวัง",
      badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
      valueClassName: "text-amber-700",
      barClassName: "bg-amber-500",
    };
  }

  return {
    label: "ปกติ",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700",
    valueClassName: "text-emerald-700",
    barClassName: "bg-primary",
  };
}

function getDepartmentIcon(code: string) {
  switch (code) {
    case "ACADEMIC":
      return BookOpen;
    case "BUDGET":
      return Wallet;
    case "PERSONNEL":
      return Users;
    default:
      return Building2;
  }
}

function getEntryTypeTone(entryType: string) {
  if (["ALLOCATION", "TRANSFER_IN", "ADJUSTMENT_INCREASE"].includes(entryType)) {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }

  if (["COMMITMENT", "TRANSFER_OUT", "COMMITMENT_RELEASE"].includes(entryType)) {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  return "border-rose-200 bg-rose-100 text-rose-700";
}

function getWarningTone(severity: WarningItem["severity"]) {
  switch (severity) {
    case "danger":
      return {
        containerClassName: "border-rose-200 bg-rose-50/80",
        titleClassName: "text-rose-700",
        iconClassName: "text-rose-500",
        Icon: AlertTriangle,
      };
    case "warning":
      return {
        containerClassName: "border-amber-200 bg-amber-50/80",
        titleClassName: "text-amber-800",
        iconClassName: "text-amber-500",
        Icon: AlertTriangle,
      };
    default:
      return {
        containerClassName: "border-blue-200 bg-blue-50/80",
        titleClassName: "text-blue-700",
        iconClassName: "text-blue-500",
        Icon: FileClock,
      };
  }
}
