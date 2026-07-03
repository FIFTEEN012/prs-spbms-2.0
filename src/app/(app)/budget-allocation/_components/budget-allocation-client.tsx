"use client";

import { useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Edit2,
  Trash2,
  PiggyBank,
  Calculator,
  TrendingUp,
  Sparkles,
  X,
  Loader2,
  Check,
  GraduationCap,
  Info,
  Coins,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { formatBaht } from "@/lib/utils";

type FundSourceType = {
  id: string;
  name: string;
  budgetAmount: number;
  projectCount: number;
};

interface BudgetAllocationClientProps {
  initialSources: FundSourceType[];
  role: string;
}

// Constants for Thai OBEC Student Funding Rates (as of 2569)
const RATES = {
  k1: { level: "k", instruction: 1800, textbook: 200, supplies: 290, uniform: 325, activity: 285, eef: 4200, poor: 0 },
  k2: { level: "k", instruction: 1800, textbook: 200, supplies: 290, uniform: 325, activity: 285, eef: 4200, poor: 0 },
  k3: { level: "k", instruction: 1800, textbook: 200, supplies: 290, uniform: 325, activity: 285, eef: 4200, poor: 0 },
  p1: { level: "p", instruction: 2000, textbook: 656, supplies: 440, uniform: 400, activity: 315, eef: 4200, poor: 1000 },
  p2: { level: "p", instruction: 2000, textbook: 650, supplies: 440, uniform: 400, activity: 315, eef: 4200, poor: 1000 },
  p3: { level: "p", instruction: 2000, textbook: 653, supplies: 440, uniform: 400, activity: 315, eef: 4200, poor: 1000 },
  p4: { level: "p", instruction: 2000, textbook: 707, supplies: 440, uniform: 400, activity: 315, eef: 4200, poor: 1000 },
  p5: { level: "p", instruction: 2000, textbook: 846, supplies: 440, uniform: 400, activity: 315, eef: 4200, poor: 1000 },
  p6: { level: "p", instruction: 2000, textbook: 859, supplies: 440, uniform: 400, activity: 315, eef: 4200, poor: 1000 },
  m1: { level: "j", instruction: 3700, textbook: 808, supplies: 520, uniform: 500, activity: 590, eef: 4200, poor: 3000 },
  m2: { level: "j", instruction: 3700, textbook: 921, supplies: 520, uniform: 500, activity: 590, eef: 4200, poor: 3000 },
  m3: { level: "j", instruction: 3700, textbook: 996, supplies: 520, uniform: 500, activity: 590, eef: 4200, poor: 3000 },
  m4: { level: "s", instruction: 4000, textbook: 1384, supplies: 520, uniform: 550, activity: 630, eef: 0, poor: 0 },
  m5: { level: "s", instruction: 4000, textbook: 1326, supplies: 520, uniform: 550, activity: 630, eef: 0, poor: 0 },
  m6: { level: "s", instruction: 4000, textbook: 1164, supplies: 520, uniform: 550, activity: 630, eef: 0, poor: 0 },
};

const GRADE_LABELS: Record<keyof typeof RATES, string> = {
  k1: "อนุบาล 1 (อ.1)",
  k2: "อนุบาล 2 (อ.2)",
  k3: "อนุบาล 3 (อ.3)",
  p1: "ประถมศึกษาปีที่ 1 (ป.1)",
  p2: "ประถมศึกษาปีที่ 2 (ป.2)",
  p3: "ประถมศึกษาปีที่ 3 (ป.3)",
  p4: "ประถมศึกษาปีที่ 4 (ป.4)",
  p5: "ประถมศึกษาปีที่ 5 (ป.5)",
  p6: "ประถมศึกษาปีที่ 6 (ป.6)",
  m1: "มัธยมศึกษาปีที่ 1 (ม.1)",
  m2: "มัธยมศึกษาปีที่ 2 (ม.2)",
  m3: "มัธยมศึกษาปีที่ 3 (ม.3)",
  m4: "มัธยมศึกษาปีที่ 4 (ม.4)",
  m5: "มัธยมศึกษาปีที่ 5 (ม.5)",
  m6: "มัธยมศึกษาปีที่ 6 (ม.6)",
};

const GRADE_GROUPS = [
  {
    title: "ระดับก่อนประถมศึกษา (อนุบาล)",
    grades: ["k1", "k2", "k3"] as (keyof typeof RATES)[],
    bgHeader: "bg-pink-50/40 dark:bg-pink-950/10",
    textHeader: "text-pink-800 dark:text-pink-400 border-pink-100 dark:border-pink-900/30",
  },
  {
    title: "ระดับประถมศึกษา (ป.1 - ป.6)",
    grades: ["p1", "p2", "p3", "p4", "p5", "p6"] as (keyof typeof RATES)[],
    bgHeader: "bg-blue-50/40 dark:bg-blue-950/10",
    textHeader: "text-blue-800 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
  },
  {
    title: "ระดับมัธยมศึกษาตอนต้น (ม.1 - ม.3)",
    grades: ["m1", "m2", "m3"] as (keyof typeof RATES)[],
    bgHeader: "bg-indigo-50/40 dark:bg-indigo-950/10",
    textHeader: "text-indigo-800 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30",
  },
  {
    title: "ระดับมัธยมศึกษาตอนปลาย (ม.4 - ม.6)",
    grades: ["m4", "m5", "m6"] as (keyof typeof RATES)[],
    bgHeader: "bg-purple-50/40 dark:bg-purple-950/10",
    textHeader: "text-purple-800 dark:text-purple-400 border-purple-100 dark:border-purple-900/30",
  },
];

type GradeKey = keyof typeof RATES;
type CategoryKey = "instruction" | "textbook" | "supplies" | "uniform" | "activity" | "eef" | "poor";

interface BudgetAllocationClientProps {
  initialSources: FundSourceType[];
  role: string;
}

export function BudgetAllocationClient({ initialSources, role }: BudgetAllocationClientProps) {
  const router = useRouter();
  const isAdmin = role === "SUPER_ADMIN";

  // State
  const sources = initialSources;
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCalculatorConfirmOpen, setIsCalculatorConfirmOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<FundSourceType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FundSourceType | null>(null);

  // Form State
  const [sourceName, setSourceName] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  // Granular Calculator States (Grade-by-Grade & Category-by-Category)
  const [studentCounts, setStudentCounts] = useState<Record<GradeKey, Record<CategoryKey, number>>>(() => {
    const initial: any = {};
    Object.keys(RATES).forEach((grade) => {
      initial[grade] = {
        instruction: 0,
        textbook: 0,
        supplies: 0,
        uniform: 0,
        activity: 0,
        eef: 0,
        poor: 0,
      };
    });
    return initial;
  });

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-fill Helper function for individual grades
  const handleInstructionChange = (grade: GradeKey, val: number) => {
    const value = Math.max(0, val);
    setStudentCounts((prev) => {
      const currentGrade = prev[grade];
      const updated = { ...currentGrade, instruction: value };
      if (currentGrade.textbook === currentGrade.instruction) updated.textbook = value;
      if (currentGrade.supplies === currentGrade.instruction) updated.supplies = value;
      if (currentGrade.uniform === currentGrade.instruction) updated.uniform = value;
      if (currentGrade.activity === currentGrade.instruction) updated.activity = value;
      return { ...prev, [grade]: updated };
    });
  };

  const handleInputChange = (grade: GradeKey, category: CategoryKey, val: number) => {
    const value = Math.max(0, val);
    setStudentCounts((prev) => ({
      ...prev,
      [grade]: {
        ...prev[grade],
        [category]: value,
      },
    }));
  };

  // Copy Main Counts Helper
  const handleCopyMainCounts = () => {
    setStudentCounts((prev) => {
      const updated = { ...prev };
      (Object.keys(RATES) as GradeKey[]).forEach((grade) => {
        updated[grade] = {
          ...updated[grade],
          textbook: updated[grade].instruction,
          supplies: updated[grade].instruction,
          uniform: updated[grade].instruction,
          activity: updated[grade].instruction,
        };
      });
      return updated;
    });
  };

  // Live Calculations
  const calculatedBudget = useMemo(() => {
    let kTotal = 0;
    let pTotal = 0;
    let jTotal = 0;
    let sTotal = 0;
    let totalInstruction = 0;
    let totalTextbooks = 0;
    let totalSupplies = 0;
    let totalUniforms = 0;
    let totalActivities = 0;
    let totalEEF = 0;
    let totalBasicPoor = 0;
    let totalStudents = 0;

    (Object.keys(RATES) as GradeKey[]).forEach((grade) => {
      const counts = studentCounts[grade];
      const rates = RATES[grade];

      const inst = counts.instruction * rates.instruction;
      const text = counts.textbook * rates.textbook;
      const supp = counts.supplies * rates.supplies;
      const unif = counts.uniform * rates.uniform;
      const act = counts.activity * rates.activity;
      const eefVal = rates.eef > 0 ? counts.eef * rates.eef : 0;
      const poorVal = rates.poor > 0 ? counts.poor * rates.poor : 0;

      const gradeTotal = inst + text + supp + unif + act + eefVal + poorVal;

      if (rates.level === "k") kTotal += gradeTotal;
      else if (rates.level === "p") pTotal += gradeTotal;
      else if (rates.level === "j") jTotal += gradeTotal;
      else if (rates.level === "s") sTotal += gradeTotal;

      totalInstruction += inst;
      totalTextbooks += text;
      totalSupplies += supp;
      totalUniforms += unif;
      totalActivities += act;
      totalEEF += eefVal;
      totalBasicPoor += poorVal;
      totalStudents += counts.instruction;
    });

    const totalBudget = totalInstruction + totalTextbooks + totalSupplies + totalUniforms + totalActivities + totalEEF + totalBasicPoor;

    return {
      kTotal,
      pTotal,
      jTotal,
      sTotal,
      totalInstruction,
      totalTextbooks,
      totalSupplies,
      totalUniforms,
      totalActivities,
      totalBasicPoor,
      totalEEF,
      totalStudents,
      totalBudget,
    };
  }, [studentCounts]);

  const openCreateModal = () => {
    setEditingSource(null);
    setSourceName("");
    setBudgetAmount("");
    setError(null);
    setIsOpen(true);
  };

  const openEditModal = (src: FundSourceType) => {
    setEditingSource(src);
    setSourceName(src.name);
    setBudgetAmount(String(src.budgetAmount));
    setError(null);
    setIsOpen(true);
  };

  const openDeleteModal = (src: FundSourceType) => {
    setDeleteTarget(src);
    setError(null);
    setIsDeleteOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName.trim()) {
      setError("กรุณาระบุชื่อแหล่งเงินงบประมาณ");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: sourceName.trim(),
      budgetAmount: budgetAmount ? Number(budgetAmount) : 0,
    };

    try {
      const url = editingSource
        ? `/api/fund-sources/${editingSource.id}`
        : "/api/fund-sources";
      const method = editingSource ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      const res = await fetch(`/api/fund-sources/${deleteTarget.id}`, {
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

  // Allocate Calculated Budgets to DB
  const handleApplyCalculatedBudget = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const allocations = [
      { name: "เงินอุดหนุนรายหัว", amount: calculatedBudget.totalInstruction },
      { name: "ค่าหนังสือเรียน", amount: calculatedBudget.totalTextbooks },
      { name: "ค่าอุปกรณ์การเรียน", amount: calculatedBudget.totalSupplies },
      { name: "ค่าเครื่องแบบนักเรียน", amount: calculatedBudget.totalUniforms },
      { name: "ค่ากิจกรรมพัฒนาคุณภาพผู้เรียน", amount: calculatedBudget.totalActivities },
      { name: "เงินทุนเสมอภาค (กสศ.)", amount: calculatedBudget.totalEEF },
      { name: "เงินอุดหนุนปัจจัยพื้นฐาน", amount: calculatedBudget.totalBasicPoor },
    ].filter(a => a.amount > 0);

    try {
      for (const allocation of allocations) {
        const existing = sources.find((s) => s.name === allocation.name);
        const payload = {
          name: allocation.name,
          budgetAmount: allocation.amount,
        };

        const url = existing ? `/api/fund-sources/${existing.id}` : "/api/fund-sources";
        const method = existing ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `ไม่สามารถจัดสรรงบสำหรับ ${allocation.name} ได้`);
        }
      }

      setSuccessMsg(`จัดสรรงบประมาณสำเร็จ! อัปเดตและสร้างแหล่งงบประมาณรวม ${allocations.length} แหล่งเงิน จำนวนเงินรวม ${formatBaht(calculatedBudget.totalBudget)} เรียบร้อยแล้ว`);
      setIsCalculatorConfirmOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดสรรงบประมาณประจำปี</h1>
          <p className="text-muted-foreground text-sm mt-1">
            กำหนดแผนแหล่งงบประมาณประจำปีการศึกษาและคำนวณเงินอุดหนุนรายหัวตามเกณฑ์ สพฐ.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <Check className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      {error && !isOpen && !isDeleteOpen && !isCalculatorConfirmOpen && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Budget CRUD & Calculator */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Card 1: Yearly Budget Sources List */}
          <Card className="border border-muted/40 shadow-sm overflow-hidden rounded-xl">
            <CardHeader className="bg-muted/10 pb-4 border-b border-muted/40 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg font-bold">แหล่งงบประมาณประจำปี</CardTitle>
              </div>
              {isAdmin && (
                <Button onClick={openCreateModal} size="sm" className="bg-primary hover:bg-primary/95 text-primary-foreground gap-1 flex items-center h-8 text-xs font-semibold">
                  <Plus className="h-3.5 w-3.5" />
                  เพิ่มแหล่งเงิน
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/20 border-b border-muted/50 text-muted-foreground font-medium">
                      <th className="p-4 font-semibold">ชื่อแหล่งงบประมาณ</th>
                      <th className="p-4 text-right font-semibold">งบประมาณจัดสรรประจำปี</th>
                      <th className="p-4 text-center font-semibold">โครงการที่ใช้</th>
                      {isAdmin && <th className="p-4 text-right font-semibold">การจัดการ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/30">
                    {sources.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 4 : 3} className="p-8 text-center text-muted-foreground font-normal">
                          ไม่พบข้อมูลแหล่งงบประมาณในระบบ
                        </td>
                      </tr>
                    ) : (
                      sources.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4 font-semibold text-foreground">
                            {s.name}
                          </td>
                          <td className="p-4 text-right font-mono text-base font-bold text-foreground">
                            {formatBaht(s.budgetAmount)}
                          </td>
                          <td className="p-4 text-center font-medium">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 text-xs font-semibold">
                              {s.projectCount} โครงการ
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="p-4 text-right">
                              <div className="inline-flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary/90 hover:bg-primary/5 h-8 px-2.5"
                                  onClick={() => openEditModal(s)}
                                >
                                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                                  แก้ไข
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive/90 hover:bg-destructive/5 h-8 px-2.5"
                                  onClick={() => openDeleteModal(s)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  ลบ
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Per-Student Funding Calculator */}
          <Card className="border border-muted/40 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-muted/40 pb-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-lg font-bold">เครื่องคำนวณเงินอุดหนุนรายหัว & ปัจจัยพื้นฐาน (สพฐ.)</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground font-normal mt-1 leading-relaxed">
                กรอกจำนวนนักเรียนและจำนวนผู้ได้รับทุน ระบบจะคำนวณแบ่งหมวดค่าหนังสือ, อุปกรณ์การเรียน, เครื่องแบบ, กิจกรรมพัฒนาผู้เรียน, ทุนเสมอภาค และปัจจัยพื้นฐาน
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                
                {/* Inputs for student levels */}
                <div className="xl:col-span-3 space-y-5">
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      ป้อนจำนวนนักเรียนที่ได้รับงบประมาณในแต่ละระดับชั้น (คน)
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyMainCounts}
                      className="h-7 text-[10px] font-bold gap-1 flex items-center border-indigo-200 hover:border-indigo-300 text-indigo-700 hover:bg-indigo-50/50 transition-all shadow-sm rounded-lg"
                    >
                      <Sparkles className="h-3 w-3" />
                      ใช้จำนวนนักเรียนรายหัวกับหมวดเรียนฟรีทั้งหมด
                    </Button>
                  </div>

                  {/* Tabular Input Grid */}
                  <div className="overflow-x-auto border border-muted/50 rounded-xl shadow-sm bg-background">
                    <table className="w-full text-[10px] text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-muted/30 border-b border-muted text-muted-foreground font-semibold">
                          <th className="p-3 font-semibold">ระดับชั้น</th>
                          <th className="p-3 text-center font-semibold text-primary">1. รายหัว/จัดการสอน</th>
                          <th className="p-3 text-center font-semibold">2. ค่าหนังสือเรียน</th>
                          <th className="p-3 text-center font-semibold">3. ค่าอุปกรณ์การเรียน</th>
                          <th className="p-3 text-center font-semibold">4. ค่าเครื่องแบบนักเรียน</th>
                          <th className="p-3 text-center font-semibold">5. กิจกรรมพัฒนาผู้เรียน</th>
                          <th className="p-3 text-center font-semibold text-emerald-800">6. ทุนเสมอภาค (กสศ.)</th>
                          <th className="p-3 text-center font-semibold text-amber-800">7. ปัจจัยพื้นฐานยากจน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-muted/30">
                        {GRADE_GROUPS.map((group) => (
                          <Fragment key={group.title}>
                            {/* Group Header Row */}
                            <tr key={group.title} className={`${group.bgHeader} border-y`}>
                              <td colSpan={8} className={`p-2 font-bold text-xs ${group.textHeader}`}>
                                {group.title}
                              </td>
                            </tr>
                            {/* Grade Rows */}
                            {group.grades.map((grade) => {
                              const counts = studentCounts[grade];
                              const rates = RATES[grade];
                              return (
                                <tr key={grade} className="hover:bg-muted/10 transition-colors">
                                  <td className="p-3 font-semibold text-foreground pl-6">
                                    {GRADE_LABELS[grade]}
                                  </td>
                                  
                                  {/* 1. รายหัว/จัดการสอน */}
                                  <td className="p-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={counts.instruction || ""}
                                        onChange={(e) => handleInstructionChange(grade, parseInt(e.target.value) || 0)}
                                        className="w-14 text-right font-bold h-7 text-xs bg-background"
                                      />
                                      <span className="text-[9px] text-muted-foreground font-mono">@{rates.instruction}</span>
                                    </div>
                                  </td>

                                  {/* 2. ค่าหนังสือเรียน */}
                                  <td className="p-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={counts.textbook || ""}
                                        onChange={(e) => handleInputChange(grade, "textbook", parseInt(e.target.value) || 0)}
                                        className="w-14 text-right font-semibold h-7 text-xs bg-background"
                                      />
                                      <span className="text-[9px] text-muted-foreground font-mono">@{rates.textbook}</span>
                                    </div>
                                  </td>

                                  {/* 3. ค่าอุปกรณ์การเรียน */}
                                  <td className="p-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={counts.supplies || ""}
                                        onChange={(e) => handleInputChange(grade, "supplies", parseInt(e.target.value) || 0)}
                                        className="w-14 text-right font-semibold h-7 text-xs bg-background"
                                      />
                                      <span className="text-[9px] text-muted-foreground font-mono">@{rates.supplies}</span>
                                    </div>
                                  </td>

                                  {/* 4. ค่าเครื่องแบบนักเรียน */}
                                  <td className="p-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={counts.uniform || ""}
                                        onChange={(e) => handleInputChange(grade, "uniform", parseInt(e.target.value) || 0)}
                                        className="w-14 text-right font-semibold h-7 text-xs bg-background"
                                      />
                                      <span className="text-[9px] text-muted-foreground font-mono">@{rates.uniform}</span>
                                    </div>
                                  </td>

                                  {/* 5. กิจกรรมพัฒนาผู้เรียน */}
                                  <td className="p-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={counts.activity || ""}
                                        onChange={(e) => handleInputChange(grade, "activity", parseInt(e.target.value) || 0)}
                                        className="w-14 text-right font-semibold h-7 text-xs bg-background"
                                      />
                                      <span className="text-[9px] text-muted-foreground font-mono">@{rates.activity}</span>
                                    </div>
                                  </td>

                                  {/* 6. ทุนเสมอภาค (กสศ.) */}
                                  <td className="p-2 text-center">
                                    {rates.eef > 0 ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <Input
                                          type="number"
                                          min="0"
                                          value={counts.eef || ""}
                                          onChange={(e) => handleInputChange(grade, "eef", parseInt(e.target.value) || 0)}
                                          className="w-14 text-right font-bold h-7 text-xs bg-emerald-50/20 border-emerald-100 text-emerald-800"
                                        />
                                        <span className="text-[9px] text-emerald-700/85 font-mono">@{rates.eef}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground font-medium text-[10px]">-</span>
                                    )}
                                  </td>

                                  {/* 7. ปัจจัยพื้นฐานยากจน */}
                                  <td className="p-2 text-center">
                                    {rates.poor > 0 ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <Input
                                          type="number"
                                          min="0"
                                          value={counts.poor || ""}
                                          onChange={(e) => handleInputChange(grade, "poor", parseInt(e.target.value) || 0)}
                                          className="w-14 text-right font-bold h-7 text-xs bg-amber-50/20 border-amber-100 text-amber-800"
                                        />
                                        <span className="text-[9px] text-amber-700/85 font-mono">@{rates.poor}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground font-medium text-[10px]">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Calculated Breakdown Breakdown table */}
                  <div className="p-3 bg-muted/15 rounded-xl border text-xs space-y-2">
                    <span className="font-bold text-muted-foreground block text-[10px] uppercase tracking-wider">ยอดงบประมาณรวมแต่ละหมวดจากการคำนวณแยกตามคน</span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-medium text-center">
                      <div className="p-2 rounded bg-background border flex flex-col justify-between">
                        <span className="text-[10px] text-muted-foreground">รายหัว/จัดการสอน</span>
                        <span className="font-bold text-foreground text-xs mt-1">{formatBaht(calculatedBudget.totalInstruction)}</span>
                      </div>
                      <div className="p-2 rounded bg-background border flex flex-col justify-between">
                        <span className="text-[10px] text-muted-foreground">ค่าหนังสือเรียน</span>
                        <span className="font-bold text-foreground text-xs mt-1">{formatBaht(calculatedBudget.totalTextbooks)}</span>
                      </div>
                      <div className="p-2 rounded bg-background border flex flex-col justify-between">
                        <span className="text-[10px] text-muted-foreground">ค่าอุปกรณ์การเรียน</span>
                        <span className="font-bold text-foreground text-xs mt-1">{formatBaht(calculatedBudget.totalSupplies)}</span>
                      </div>
                      <div className="p-2 rounded bg-background border flex flex-col justify-between">
                        <span className="text-[10px] text-muted-foreground">ค่าเครื่องแบบ</span>
                        <span className="font-bold text-foreground text-xs mt-1">{formatBaht(calculatedBudget.totalUniforms)}</span>
                      </div>
                      <div className="p-2 rounded bg-background border flex flex-col justify-between">
                        <span className="text-[10px] text-muted-foreground">กิจกรรมพัฒนาผู้เรียน</span>
                        <span className="font-bold text-foreground text-xs mt-1">{formatBaht(calculatedBudget.totalActivities)}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Live Calculations Summary Box */}
                <div className="xl:col-span-2 p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/10 border border-emerald-200/50 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-200/30 pb-2">
                      <TrendingUp className="h-3.5 w-3.5" />
                      สรุปผลการจัดสรรรายหมวด
                    </h3>

                    <div className="divide-y divide-emerald-200/20 text-xs space-y-2 text-emerald-900/90 dark:text-emerald-300">
                      <div className="flex justify-between pt-1">
                        <span>นักเรียนรวมทั้งหมด:</span>
                        <span className="font-bold text-sm text-foreground">{calculatedBudget.totalStudents} คน</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span>1. เงินอุดหนุนรายหัวปกติ:</span>
                        <span className="font-semibold text-foreground">{formatBaht(calculatedBudget.totalInstruction)}</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span>2. เงินค่าหนังสือเรียนรวม:</span>
                        <span className="font-semibold text-foreground">{formatBaht(calculatedBudget.totalTextbooks)}</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span>3. เงินค่าอุปกรณ์การเรียนรวม:</span>
                        <span className="font-semibold text-foreground">{formatBaht(calculatedBudget.totalSupplies)}</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span>4. เงินค่าเครื่องแบบนักเรียน:</span>
                        <span className="font-semibold text-foreground">{formatBaht(calculatedBudget.totalUniforms)}</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span>5. เงินกิจกรรมพัฒนาคุณภาพ:</span>
                        <span className="font-semibold text-foreground">{formatBaht(calculatedBudget.totalActivities)}</span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span>6. ทุนเสมอภาค (กสศ.):</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-bold">{formatBaht(calculatedBudget.totalEEF)}</span>
                      </div>
                      <div className="flex justify-between pt-2 pb-1">
                        <span>7. ปัจจัยพื้นฐานยากจน:</span>
                        <span className="font-semibold text-amber-700 dark:text-amber-400 font-bold">{formatBaht(calculatedBudget.totalBasicPoor)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-emerald-200/40 text-center space-y-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-wide">ประมาณการงบประมาณแผ่นดินรวม</p>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono tracking-tight">
                        {formatBaht(calculatedBudget.totalBudget)}
                      </p>
                    </div>

                    {isAdmin && (
                      <Button
                        type="button"
                        onClick={() => setIsCalculatorConfirmOpen(true)}
                        disabled={calculatedBudget.totalBudget <= 0}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-2 text-xs font-semibold py-2 shadow-md hover:shadow transition-all"
                      >
                        <PiggyBank className="h-3.5 w-3.5" />
                        จัดสรรสอดคล้องสู่แผนงบประมาณ
                      </Button>
                    )}
                  </div>

                </div>

              </div>

            </CardContent>
          </Card>

        </div>

        {/* Right Column: Recommended Next Features */}
        <div className="space-y-6">
          <Card className="border border-indigo-100 dark:border-indigo-950 shadow-sm rounded-xl overflow-hidden bg-gradient-to-b from-indigo-50/30 to-background">
            <CardHeader className="pb-3 flex flex-row items-center gap-2 border-b border-indigo-100/40 bg-indigo-50/20">
              <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
              <CardTitle className="text-base font-bold text-indigo-900 dark:text-indigo-400">แนะนำฟีเจอร์พัฒนาต่อในอนาคต</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                ข้อเสนอแนะเชิงกลยุทธ์เพื่อพัฒนาขีดความสามารถของระบบในระยะถัดไปให้ดียิ่งขึ้น:
              </p>

              <div className="space-y-4">
                
                {/* Feature 1 */}
                <div className="group p-3 rounded-lg border border-muted bg-background hover:border-indigo-200 hover:bg-indigo-50/10 transition-all duration-200">
                  <div className="flex items-start gap-2.5">
                    <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-300">ระบบวางแผนโครงการอัจฉริยะ (AI Assist)</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        ใช้โมเดลภาษาขนาดใหญ่ (LLM) ในการวิเคราะห์และช่วยครูร่างเป้าหมาย ตัวชี้วัด และวิธีดำเนินงานโครงการให้สอดคล้องตามมาตรฐานแผน สพฐ.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="group p-3 rounded-lg border border-muted bg-background hover:border-indigo-200 hover:bg-indigo-50/10 transition-all duration-200">
                  <div className="flex items-start gap-2.5">
                    <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-300">ประมาณการเทียบใช้จริง (Real-time Burn Rate)</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        ระบบแสดงกราฟเปรียบเทียบวงเงินจัดสรรและยอดจัดซื้อจัดจ้างจริงของฝ่ายต่าง ๆ พร้อมส่งการแจ้งเตือนทันทีเมื่อตรวจพบการใช้งบเกินเป้าหมาย
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="group p-3 rounded-lg border border-muted bg-background hover:border-indigo-200 hover:bg-indigo-50/10 transition-all duration-200">
                  <div className="flex items-start gap-2.5">
                    <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      <Info className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-300">ระบบอนุมัติเอกสารออนไลน์แบบหลายลำดับขั้น</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        ลดกระบวนการส่งสารกระดาษด้วยการแจ้งเตือนผ่านไลน์กลุ่มถึงผู้มีอำนาจเพื่อพิจารณาอนุมัติลงลายมือชื่อดิจิทัลในขั้นตอนที่รวดเร็ว
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="group p-3 rounded-lg border border-muted bg-background hover:border-indigo-200 hover:bg-indigo-50/10 transition-all duration-200">
                  <div className="flex items-start gap-2.5">
                    <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      <Coins className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-300">เชื่อมโยงบัญชีการเงินโรงเรียนตามมาตรฐานศธ.</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        บันทึกบัญชีแยกประเภทรายรับ-รายจ่ายตามฝ่ายงาน ส่งออกรายงานการเงินแบบ 3 มิติเพื่อความโปร่งใสและพร้อมส่งหน่วยงานตรวจสอบได้ทันที
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              <div className="pt-2">
                <Button variant="ghost" className="w-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 text-xs font-bold gap-1.5 flex items-center justify-center p-2 rounded-lg transition-colors border border-indigo-100">
                  ปรึกษาแผนพัฒนาเพิ่มเติม
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

      {/* Fund Source Create / Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200">
          <div className="bg-background border rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingSource ? "แก้ไขข้อมูลแหล่งงบประมาณ" : "เพิ่มแหล่งงบประมาณประจำปี"}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 p-6 space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2 text-xs font-medium border border-destructive/20">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">ชื่อแหล่งงบประมาณ *</label>
                <Input
                  type="text"
                  placeholder="ตัวอย่าง: เงินอุดหนุนรายหัว, เงินงบประมาณอบจ."
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="rounded-lg font-medium text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">จำนวนงบประมาณจัดสรร (บาท)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="rounded-lg font-mono font-bold text-sm"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={loading} className="rounded-lg">
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={loading} className="rounded-lg gap-2 bg-primary hover:bg-primary/95 text-primary-foreground min-w-[90px]">
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

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200">
          <div className="bg-background border rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                ยืนยันการลบแหล่งงบประมาณ
              </h2>
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2 text-xs font-medium border border-destructive/20">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-sm text-foreground leading-relaxed">
                ท่านแน่ใจหรือไม่ว่าต้องการลบแหล่งงบประมาณ <strong className="text-base font-bold">&quot;{deleteTarget.name}&quot;</strong>? 
                งบประมาณจำนวน {formatBaht(deleteTarget.budgetAmount)} จะถูกลบออกจากการคำนวณ
              </p>

              {deleteTarget.projectCount > 0 ? (
                <div className="p-3.5 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400 border border-yellow-200/50 rounded-lg space-y-1">
                  <h4 className="font-semibold text-xs flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    ระบบบล็อกการลบเพื่อความถูกต้องทางงบการเงิน
                  </h4>
                  <p className="text-xs leading-relaxed">
                    มีจำนวนโครงการในฐานข้อมูล <strong>{deleteTarget.projectCount} โครงการ</strong> ที่ผูกไว้กับแหล่งเงินงบประมาณนี้ 
                    ท่านต้องทำการเปลี่ยนแหล่งเงินของโครงการเหล่านี้ก่อนจึงจะสามารถลบออกได้
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                  ไม่พบการเชื่อมโยงข้อมูลกับโครงการใด ๆ สามารถกดลบออกได้ทันที
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={loading} className="rounded-lg">
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading || deleteTarget.projectCount > 0}
                  onClick={handleDelete}
                  className="rounded-lg gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      ยืนยันลบข้อมูล
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calculator Confirm Modal */}
      {isCalculatorConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200">
          <div className="bg-background border rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-emerald-500" />
                ยืนยันการจัดสรรงบประมาณรายหัว
              </h2>
              <button
                onClick={() => setIsCalculatorConfirmOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2 text-xs font-medium border border-destructive/20">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-xs text-foreground leading-relaxed">
                การดำเนินการนี้จะอัปเดตหรือสร้างแหล่งงบประมาณตามหมวดการคำนวณจำนวน <strong className="text-emerald-700 dark:text-emerald-400">7 รายการหลัก</strong> ในระบบงบประมาณจริงของโรงเรียน:
              </p>

              <div className="p-3 rounded-lg border bg-muted/20 text-xs space-y-2">
                <div className="flex justify-between font-semibold border-b pb-1 text-muted-foreground">
                  <span>แหล่งงบประมาณ</span>
                  <span>งบประมาณที่จะจัดสรร</span>
                </div>
                {calculatedBudget.totalInstruction > 0 && (
                  <div className="flex justify-between">
                    <span>เงินอุดหนุนรายหัว (จัดการเรียนการสอน)</span>
                    <span className="font-mono font-bold">{formatBaht(calculatedBudget.totalInstruction)}</span>
                  </div>
                )}
                {calculatedBudget.totalTextbooks > 0 && (
                  <div className="flex justify-between">
                    <span>ค่าหนังสือเรียน</span>
                    <span className="font-mono font-bold">{formatBaht(calculatedBudget.totalTextbooks)}</span>
                  </div>
                )}
                {calculatedBudget.totalSupplies > 0 && (
                  <div className="flex justify-between">
                    <span>ค่าอุปกรณ์การเรียน</span>
                    <span className="font-mono font-bold">{formatBaht(calculatedBudget.totalSupplies)}</span>
                  </div>
                )}
                {calculatedBudget.totalUniforms > 0 && (
                  <div className="flex justify-between">
                    <span>ค่าเครื่องแบบนักเรียน</span>
                    <span className="font-mono font-bold">{formatBaht(calculatedBudget.totalUniforms)}</span>
                  </div>
                )}
                {calculatedBudget.totalActivities > 0 && (
                  <div className="flex justify-between">
                    <span>ค่ากิจกรรมพัฒนาคุณภาพผู้เรียน</span>
                    <span className="font-mono font-bold">{formatBaht(calculatedBudget.totalActivities)}</span>
                  </div>
                )}
                {calculatedBudget.totalEEF > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span>เงินทุนเสมอภาค (กสศ.)</span>
                    <span className="font-mono font-bold">{formatBaht(calculatedBudget.totalEEF)}</span>
                  </div>
                )}
                {calculatedBudget.totalBasicPoor > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400 font-medium">
                    <span>เงินอุดหนุนปัจจัยพื้นฐาน</span>
                    <span className="font-mono font-bold">{formatBaht(calculatedBudget.totalBasicPoor)}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl space-y-1.5 text-center">
                <div className="text-[10px] text-emerald-800 dark:text-emerald-500 font-bold uppercase tracking-wider">ประมาณการยอดรวมจัดสรรสอดคล้องรวม</div>
                <div className="text-2xl font-black text-emerald-600 font-mono">
                  {formatBaht(calculatedBudget.totalBudget)}
                </div>
                <div className="text-xs text-muted-foreground">(สำหรับนักเรียนทั้งหมด {calculatedBudget.totalStudents} คน)</div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsCalculatorConfirmOpen(false)} disabled={loading} className="rounded-lg">
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={handleApplyCalculatedBudget}
                  className="rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังจัดสรร...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      ยืนยันจัดสรรงบประมาณทั้งหมด
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
