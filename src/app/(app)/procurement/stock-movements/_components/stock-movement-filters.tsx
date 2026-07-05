"use client";

import { Filter, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export type MovementFilterOption = {
  value: string;
  label: string;
};

export function StockMovementFilters({
  fiscalYears,
  departments,
  statuses,
  categories,
}: {
  fiscalYears: MovementFilterOption[];
  departments: MovementFilterOption[];
  statuses: MovementFilterOption[];
  categories: MovementFilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selected = (key: string) => searchParams.get(key) ?? "";
  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/procurement/stock-movements?${params.toString()}`);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <Filter className="size-4 text-primary" />
          ตัวกรองความเคลื่อนไหววัสดุ
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "ทั้งหมด", value: "" },
            { label: "รับเข้า", value: "RECEIVE" },
            { label: "เบิกออก", value: "ISSUE" },
            { label: "ปรับยอด", value: "ADJUST" },
            { label: "ยกเลิก", value: "CANCEL" },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                selected("movementType") === chip.value
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-primary-fixed"
              }`}
              onClick={() => setParam("movementType", chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Select label="ปีงบประมาณ" value={selected("fiscalYearId")} options={fiscalYears} onChange={(value) => setParam("fiscalYearId", value)} />
        <Select
          label="ประเภท"
          value={selected("movementType")}
          placeholder="ทุกประเภท"
          options={[
            { value: "RECEIVE", label: "รับเข้า" },
            { value: "ISSUE", label: "เบิกออก" },
            { value: "ADJUST", label: "ปรับยอด" },
            { value: "CANCEL", label: "ยกเลิก" },
          ]}
          onChange={(value) => setParam("movementType", value)}
        />
        <Select label="สถานะพัสดุ" value={selected("status")} options={statuses} placeholder="ทุกสถานะ" onChange={(value) => setParam("status", value)} />
        <Select label="หมวดพัสดุ" value={selected("category")} options={categories} placeholder="ทุกหมวด" onChange={(value) => setParam("category", value)} />
        <Select label="กลุ่มบริหาร" value={selected("departmentId")} options={departments} placeholder="ทุกกลุ่ม" onChange={(value) => setParam("departmentId", value)} />
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500">ค้นหา</label>
          <div className="relative">
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              defaultValue={selected("q")}
              placeholder="ชื่อวัสดุ / เลขที่เอกสาร..."
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
  options: MovementFilterOption[];
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
