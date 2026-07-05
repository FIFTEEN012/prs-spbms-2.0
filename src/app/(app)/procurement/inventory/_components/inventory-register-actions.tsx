"use client";

import { FileSpreadsheet, Filter, Printer, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export type InventoryFilterOption = {
  value: string;
  label: string;
};

export type InventoryCsvRow = {
  code: string;
  itemName: string;
  projectName: string;
  departmentName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  createdAt: string;
};

export function InventoryRegisterActions({ rows }: { rows: InventoryCsvRow[] }) {
  const downloadCsv = () => {
    const header = [
      "รหัส/เลขที่",
      "รายการสินค้า/วัสดุ",
      "โครงการ",
      "กลุ่มบริหาร",
      "หมวด",
      "จำนวน",
      "ราคาต่อหน่วย",
      "มูลค่ารวม",
      "สถานะ",
      "วันที่บันทึก",
    ];
    const escapeCell = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      header.map(escapeCell).join(","),
      ...rows.map((row) =>
        [
          row.code,
          row.itemName,
          row.projectName,
          row.departmentName,
          row.category,
          row.quantity,
          row.unitPrice,
          row.totalPrice,
          row.status,
          row.createdAt,
        ].map(escapeCell).join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "inventory-register.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button variant="outline" className="gap-2 rounded-lg bg-white" onClick={downloadCsv}>
        <FileSpreadsheet className="size-4" />
        ส่งออกรายงาน
      </Button>
      <Button className="gap-2 rounded-lg bg-primary text-white hover:bg-primary/90" onClick={() => window.print()}>
        <Printer className="size-4" />
        พิมพ์ทะเบียน
      </Button>
    </div>
  );
}

export function InventoryRegisterFilters({
  fiscalYears,
  departments,
  statuses,
  categories,
}: {
  fiscalYears: InventoryFilterOption[];
  departments: InventoryFilterOption[];
  statuses: InventoryFilterOption[];
  categories: InventoryFilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selected = (key: string) => searchParams.get(key) ?? "";
  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/procurement/inventory?${params.toString()}`);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm print:hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <Filter className="size-4 text-primary" />
          ตัวกรองทะเบียนสินค้าและวัสดุ
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "ทั้งหมด", value: "" },
            { label: "กำลังดำเนินการ", value: "REQUESTED" },
            { label: "สั่งซื้อแล้ว", value: "ORDERED" },
            { label: "รับเข้าแล้ว", value: "RECEIVED" },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                selected("status") === chip.value
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-primary-fixed"
              }`}
              onClick={() => setParam("status", chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Select label="ปีงบประมาณ" value={selected("fiscalYearId")} options={fiscalYears} onChange={(value) => setParam("fiscalYearId", value)} />
        <Select label="สถานะ" value={selected("status")} options={statuses} placeholder="ทุกสถานะ" onChange={(value) => setParam("status", value)} />
        <Select label="หมวดพัสดุ" value={selected("category")} options={categories} placeholder="ทุกหมวด" onChange={(value) => setParam("category", value)} />
        <Select label="กลุ่มบริหาร" value={selected("departmentId")} options={departments} placeholder="ทุกกลุ่มบริหาร" onChange={(value) => setParam("departmentId", value)} />
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500">ค้นหา</label>
          <div className="relative">
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              defaultValue={selected("q")}
              placeholder="ชื่อ/เลขที่เอกสาร..."
              onKeyDown={(event) => {
                if (event.key === "Enter") setParam("q", event.currentTarget.value.trim());
              }}
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: InventoryFilterOption[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-slate-500">{label}</label>
      <select
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
