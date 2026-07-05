"use client";

import { FileSpreadsheet, Filter, Printer, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export type ReportFilterOption = {
  value: string;
  label: string;
};

export type ReportCsvRow = {
  documentNo: string;
  subject: string;
  projectName: string;
  departmentName: string;
  status: string;
  requestedAmount: number;
  documentDate: string;
};

export function AnnualReportActions({ rows }: { rows: ReportCsvRow[] }) {
  const downloadCsv = () => {
    const header = [
      "เลขที่เอกสาร",
      "เรื่อง",
      "โครงการ",
      "กลุ่มบริหาร",
      "สถานะ",
      "ยอดขอ",
      "วันที่เอกสาร",
    ];
    const escapeCell = (value: string | number) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [
      header.map(escapeCell).join(","),
      ...rows.map((row) =>
        [
          row.documentNo,
          row.subject,
          row.projectName,
          row.departmentName,
          row.status,
          row.requestedAmount,
          row.documentDate,
        ].map(escapeCell).join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "annual-procurement-report.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button variant="outline" className="gap-2 rounded-lg bg-white" onClick={() => window.print()}>
        <Printer className="size-4" />
        Export PDF
      </Button>
      <Button variant="outline" className="gap-2 rounded-lg bg-white" onClick={downloadCsv}>
        <FileSpreadsheet className="size-4" />
        Export CSV
      </Button>
    </div>
  );
}

export function AnnualReportFilters({
  fiscalYears,
  departments,
  statuses,
  categories,
}: {
  fiscalYears: ReportFilterOption[];
  departments: ReportFilterOption[];
  statuses: ReportFilterOption[];
  categories: ReportFilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/procurement/reports/annual?${params.toString()}`);
  };

  const selected = (key: string) => searchParams.get(key) ?? "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm print:hidden">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
        <Filter className="size-4" />
        ตัวกรองรายงาน
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <select
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={selected("fiscalYearId")}
          onChange={(event) => setParam("fiscalYearId", event.target.value)}
        >
          {fiscalYears.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={selected("status")}
          onChange={(event) => setParam("status", event.target.value)}
        >
          <option value="">ทุกสถานะ</option>
          {statuses.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={selected("departmentId")}
          onChange={(event) => setParam("departmentId", event.target.value)}
        >
          <option value="">ทุกกลุ่มบริหาร</option>
          {departments.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={selected("category")}
          onChange={(event) => setParam("category", event.target.value)}
        >
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <div className="relative">
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm"
            defaultValue={selected("q")}
            placeholder="ค้นหารายงาน..."
            onKeyDown={(event) => {
              if (event.key === "Enter") setParam("q", event.currentTarget.value.trim());
            }}
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
