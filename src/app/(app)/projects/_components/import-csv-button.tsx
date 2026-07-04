"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBaht } from "@/lib/utils";

const HEADER_MAP: Record<string, string> = {
  "ปีการศึกษา": "yearName",
  "รหัสโครงการ": "projectCode",
  "ชื่อโครงการ": "projectName",
  "รหัสยุทธศาสตร์": "strategyCode",
  "ฝ่าย/กลุ่มงาน": "departmentName",
  "ฝ่าย": "departmentName",
  "กลุ่มงาน": "departmentName",
  "แหล่งงบประมาณ": "fundSourceName",
  "แหล่งเงิน": "fundSourceName",
  "ผู้รับผิดชอบ": "responsibleName",
  "งบประมาณเสนอขอ": "budgetRequested",
  "งบประมาณ": "budgetRequested",
  "หลักการและเหตุผล": "rationale",
  "วัตถุประสงค์": "objectives",
  "เป้าหมายเชิงปริมาณ": "quantitativeTarget",
  "เป้าหมายเชิงคุณภาพ": "qualitativeTarget",
  "ตัวชี้วัด": "indicators",
  "วิธีดำเนินการ": "method",
  "วิธีดำเนินงาน": "method",
  "ผลที่คาดว่าจะได้รับ": "expectedOutcome",
  "วันที่เริ่มต้น": "startDate",
  "วันที่เริ่ม": "startDate",
  "วันที่สิ้นสุด": "endDate",
  "กิจกรรมย่อย": "activityName",
  "กิจกรรม": "activityName",
  "งบประมาณกิจกรรม": "activityBudget",
  "งบกิจกรรม": "activityBudget",
  "แหล่งงบประมาณของกิจกรรม": "activityFundSource",
  "แหล่งงบประมาณย่อย": "activityFundSource",
};

const TEMPLATE_HEADERS = [
  "ปีการศึกษา",
  "รหัสโครงการ",
  "ชื่อโครงการ",
  "รหัสยุทธศาสตร์",
  "ฝ่าย/กลุ่มงาน",
  "แหล่งงบประมาณ",
  "ผู้รับผิดชอบ",
  "งบประมาณเสนอขอ",
  "หลักการและเหตุผล",
  "วัตถุประสงค์",
  "เป้าหมายเชิงปริมาณ",
  "เป้าหมายเชิงคุณภาพ",
  "ตัวชี้วัด",
  "วิธีดำเนินการ",
  "ผลที่คาดว่าจะได้รับ",
  "วันที่เริ่มต้น",
  "วันที่สิ้นสุด",
  "กิจกรรมย่อย",
  "งบประมาณกิจกรรม",
  "แหล่งงบประมาณย่อย",
];

type ParsedProject = Record<string, string>;

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = "";
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const nextChar = cleanText[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          entry += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        entry += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(entry.trim());
      entry = "";
    } else if (char === "\n") {
      row.push(entry.trim());
      result.push(row);
      row = [];
      entry = "";
    } else {
      entry += char;
    }
  }

  if (entry || row.length > 0) {
    row.push(entry.trim());
    result.push(row);
  }

  return result.filter((candidate) => candidate.length > 0 && candidate.some((cell) => cell !== ""));
}

function quoteCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function ImportCsvButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedProject[]>([]);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const rows = [
      TEMPLATE_HEADERS,
      [
        "2569",
        "PRJ-S1-001",
        "โครงการพัฒนาคุณภาพการเรียนการสอนคณิตศาสตร์",
        "S1",
        "กลุ่มบริหารวิชาการ",
        "เงินอุดหนุนรายหัว",
        "ครูสมชาย ใจดี",
        "50000.00",
        "ยกระดับผลสัมฤทธิ์ทางการเรียนและพัฒนากระบวนการคิดวิเคราะห์",
        "เพื่อยกระดับผลสัมฤทธิ์ทางการเรียนและส่งเสริมทักษะคณิตศาสตร์",
        "นักเรียนระดับชั้น ม.3 จำนวน 200 คน",
        "นักเรียนมีผลสัมฤทธิ์ผ่านเกณฑ์ไม่น้อยกว่าร้อยละ 70",
        "ร้อยละของนักเรียนที่มีผลสัมฤทธิ์ผ่านเกณฑ์",
        "จัดค่ายและคลินิกคณิตศาสตร์ พร้อมสรุปผลโครงการ",
        "นักเรียนมีทักษะและผลการเรียนเฉลี่ยสูงขึ้น",
        "2026-05-16",
        "2027-03-31",
        "",
        "",
        "",
      ],
      [
        "2569",
        "PRJ-S1-001",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "จัดซื้อสื่อการเรียนการสอนคณิตศาสตร์",
        "30000.00",
        "เงินอุดหนุนรายหัว",
      ],
      [
        "2569",
        "PRJ-S1-001",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "จัดกิจกรรมค่ายคณิตศาสตร์สร้างสรรค์",
        "20000.00",
        "เงินอุดหนุนการศึกษา",
      ],
    ];

    const csvContent = `\uFEFF${rows.map((row) => row.map(quoteCsvCell).join(",")).join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_projects.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setClientErrors([]);
    setServerErrors([]);
    setSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;

      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setClientErrors(["ไฟล์ CSV ต้องมีข้อมูลอย่างน้อย 1 แถว"]);
          setParsedData([]);
          return;
        }

        const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
        const headerIndices: Record<number, string> = {};
        headers.forEach((header, index) => {
          if (HEADER_MAP[header]) headerIndices[index] = HEADER_MAP[header];
        });

        const mappedProperties = Object.values(headerIndices);
        if (!mappedProperties.includes("projectCode") || !mappedProperties.includes("projectName")) {
          setClientErrors([
            "ไม่พบคอลัมน์บังคับในไฟล์ CSV: 'รหัสโครงการ' และ 'ชื่อโครงการ' กรุณาใช้ไฟล์แม่แบบ",
          ]);
          setParsedData([]);
          return;
        }

        const items: ParsedProject[] = [];
        const localErrors: string[] = [];

        rows.slice(1).forEach((row, rowIndex) => {
          const rowNum = rowIndex + 2;
          const item: ParsedProject = { projectCode: "", projectName: "" };

          row.forEach((cell, cellIndex) => {
            const propName = headerIndices[cellIndex];
            if (propName) item[propName] = cell;
          });

          if (!item.projectCode) localErrors.push(`แถวที่ ${rowNum}: ไม่ระบุรหัสโครงการ`);
          if (!item.projectName) localErrors.push(`แถวที่ ${rowNum}: ไม่ระบุชื่อโครงการ`);

          if (item.budgetRequested) {
            const cleanVal = String(item.budgetRequested).replace(/,/g, "").trim();
            if (cleanVal && Number.isNaN(Number(cleanVal))) {
              localErrors.push(`แถวที่ ${rowNum}: งบประมาณเสนอขอ '${item.budgetRequested}' ไม่ใช่ตัวเลขที่ถูกต้อง`);
            }
          }

          items.push(item);
        });

        setClientErrors(localErrors);
        setParsedData(items);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "ไม่สามารถอ่านไฟล์ CSV ได้";
        setClientErrors([`เกิดข้อผิดพลาดในการอ่านไฟล์: ${message}`]);
        setParsedData([]);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(event.type === "dragenter" || event.type === "dragover");
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      processFile(file);
    } else {
      setClientErrors(["กรุณาเลือกไฟล์รูปแบบ CSV (.csv) เท่านั้น"]);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0 || clientErrors.length > 0) return;

    setLoading(true);
    setServerErrors([]);

    try {
      const res = await fetch("/api/projects/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedData),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerErrors(
          data.errors && Array.isArray(data.errors)
            ? data.errors
            : [data.error || "เกิดข้อผิดพลาดไม่ทราบสาเหตุจากเซิร์ฟเวอร์"],
        );
        return;
      }

      setSuccessCount(data.count);
      setParsedData([]);
      setFileName("");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
      setServerErrors([message]);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setIsOpen(false);
    setParsedData([]);
    setClientErrors([]);
    setServerErrors([]);
    setSuccessCount(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <Button
        variant="outline"
        className="flex w-full items-center gap-2 rounded-lg bg-background/90 sm:w-auto"
        onClick={() => setIsOpen(true)}
      >
        <Upload className="h-4 w-4" />
        นำเข้าโครงการ (CSV)
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold">นำเข้าโครงการผ่านไฟล์ CSV</h2>
              </div>
              <button onClick={resetState} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="ปิด">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-900 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold">การกรอกข้อมูลในไฟล์ CSV</h4>
                  <p className="text-xs text-emerald-800/90">
                    หัวตารางต้องตรงตามเทมเพลต โดยคอลัมน์บังคับคือ <strong>รหัสโครงการ</strong> และ <strong>ชื่อโครงการ</strong>
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1.5 bg-white text-emerald-700" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" />
                  ดาวน์โหลดไฟล์แม่แบบ
                </Button>
              </div>

              {!fileName && successCount === null && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-all ${
                    isDragging
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-muted-foreground/25 hover:border-primary/55 hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                  <div className="rounded-full bg-muted p-3 text-muted-foreground">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ CSV มาวางที่นี่</p>
                    <p className="text-xs text-muted-foreground">รองรับไฟล์ CSV (.csv) ขนาดไม่เกิน 5MB</p>
                  </div>
                </div>
              )}

              {fileName && (
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3.5">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold">{fileName}</p>
                      <p className="text-xs text-muted-foreground">ตรวจพบข้อมูลจำนวน {parsedData.length} โครงการ</p>
                    </div>
                  </div>
                  {!loading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFileName("");
                        setParsedData([]);
                        setClientErrors([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}

              {successCount !== null && (
                <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
                  <div className="rounded-full bg-emerald-100 p-3 text-emerald-600">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">นำเข้าข้อมูลสำเร็จ</h3>
                    <p className="text-sm text-muted-foreground">นำเข้าโครงการเข้าระบบเรียบร้อยแล้วทั้งหมด {successCount} โครงการ</p>
                  </div>
                  <Button onClick={resetState}>ปิดหน้าต่าง</Button>
                </div>
              )}

              <ErrorList title="พบข้อผิดพลาดจากข้อมูลในไฟล์" errors={clientErrors} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} />
              <ErrorList title="ไม่สามารถนำเข้าข้อมูลได้จากเซิร์ฟเวอร์" errors={serverErrors} icon={<AlertCircle className="h-4 w-4 text-red-600" />} />

              {parsedData.length > 0 && clientErrors.length === 0 && serverErrors.length === 0 && (
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <h3 className="text-sm font-bold text-muted-foreground">ตัวอย่างข้อมูลที่จะนำเข้า (แสดงสูงสุด 5 โครงการ)</h3>
                  </div>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 font-bold text-muted-foreground">
                          <th className="p-2.5">รหัสโครงการ</th>
                          <th className="p-2.5">ชื่อโครงการ</th>
                          <th className="p-2.5">ปีงบฯ</th>
                          <th className="p-2.5">ฝ่าย/กลุ่มงาน</th>
                          <th className="p-2.5 text-right">งบเสนอขอ</th>
                          <th className="p-2.5">ผู้รับผิดชอบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 5).map((row, index) => (
                          <tr key={`${row.projectCode}-${index}`} className="border-b hover:bg-muted/10">
                            <td className="p-2.5 font-mono text-muted-foreground">{row.projectCode}</td>
                            <td className="p-2.5 font-medium">{row.projectName}</td>
                            <td className="p-2.5">{row.yearName || "(ปัจจุบัน)"}</td>
                            <td className="p-2.5">{row.departmentName || "-"}</td>
                            <td className="p-2.5 text-right font-medium">
                              {row.budgetRequested ? formatBaht(Number(String(row.budgetRequested).replace(/,/g, ""))) : "฿0.00"}
                            </td>
                            <td className="p-2.5">{row.responsibleName || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 5 && (
                    <p className="text-center text-xs text-muted-foreground">และอีก {parsedData.length - 5} โครงการ...</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t bg-muted/30 px-6 py-4">
              <Button variant="outline" onClick={resetState} disabled={loading}>
                ยกเลิก
              </Button>
              {parsedData.length > 0 && clientErrors.length === 0 && successCount === null && (
                <Button onClick={handleImport} disabled={loading} className="gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังนำเข้า...
                    </>
                  ) : (
                    <>นำเข้าข้อมูล ({parsedData.length})</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ErrorList({
  title,
  errors,
  icon,
}: {
  title: string;
  errors: string[];
  icon: React.ReactNode;
}) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
      <div className="flex items-center gap-2 text-sm font-bold">
        {icon}
        <span>{title} ({errors.length} จุด)</span>
      </div>
      <ul className="max-h-[180px] list-disc space-y-1 overflow-y-auto pl-5 text-xs">
        {errors.map((error, index) => (
          <li key={`${error}-${index}`}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
