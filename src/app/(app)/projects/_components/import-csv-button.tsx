"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { formatBaht } from "@/lib/utils";

// Mapping Thai columns in CSV to English properties
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

// Custom simple & robust CSV parser
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = "";

  // Normalize line endings
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          entry += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        entry += char;
      }
    } else {
      if (char === '"') {
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
  }

  if (entry || row.length > 0) {
    row.push(entry.trim());
    result.push(row);
  }

  return result.filter((r) => r.length > 0 && r.some((cell) => cell !== ""));
}

export function ImportCsvButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate and download template CSV (UTF-8 with BOM)
  const downloadTemplate = () => {
    const headers = [
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

    const row1 = [
      "2569",
      "PRJ-S1-001",
      "โครงการพัฒนาคุณภาพการเรียนการสอนคณิตศาสตร์",
      "S1",
      "กลุ่มบริหารวิชาการ",
      "เงินอุดหนุนรายหัว",
      "ครูสมชาย ใจดี",
      "50000.00",
      "เนื่องจากผลสัมฤทธิ์ทางการเรียนวิชาคณิตศาสตร์ของนักเรียนต่ำกว่าเป้าหมาย...",
      "เพื่อยกระดับผลสัมฤทธิ์ทางการเรียน และส่งเสริมกระบวนการคิดวิเคราะห์...",
      "นักเรียนระดับชั้น ม.3 จำนวน 200 คน",
      "นักเรียนมีผลสัมฤทธิ์คณิตศาสตร์ผ่านเกณฑ์ไม่น้อยกว่าร้อยละ 70",
      "ร้อยละของนักเรียนที่มีผลสัมฤทธิ์ผ่านเกณฑ์",
      "1. ประชุมวางแผนชี้แจง\n2. จัดค่ายคณิตศาสตร์และคลินิกคณิตศาสตร์\n3. สรุปผลรายงานโครงการ",
      "นักเรียนมีทักษะกระบวนการคิดวิเคราะห์และผลการเรียนเฉลี่ยรายวิชาสูงขึ้น",
      "2026-05-16",
      "2027-03-31",
      "",
      "",
      "",
    ];

    const row2 = [
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
    ];

    const row3 = [
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
    ];

    const csvContent =
      "\uFEFF" +
      headers.join(",") +
      "\n" +
      [row1, row2, row3]
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_projects.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setClientErrors([]);
    setServerErrors([]);
    setSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setClientErrors(["ไฟล์ CSV ต้องมีข้อมูลอย่างน้อย 1 แถว (ไม่รวมหัวตาราง)"]);
          setParsedData([]);
          return;
        }

        const headers = rows[0].map((h) => h.trim().replace(/^"|"$/g, ""));
        const dataRows = rows.slice(1);

        // Map column index to English object property
        const headerIndices: Record<number, string> = {};
        headers.forEach((h, index) => {
          if (HEADER_MAP[h]) {
            headerIndices[index] = HEADER_MAP[h];
          }
        });

        // Ensure key fields exist in headers
        const mappedProperties = Object.values(headerIndices);
        if (!mappedProperties.includes("projectCode") || !mappedProperties.includes("projectName")) {
          setClientErrors([
            "ไม่พบคอลัมน์บังคับอย่างใดอย่างหนึ่งในไฟล์ CSV: 'รหัสโครงการ', 'ชื่อโครงการ' กรุณาใช้ไฟล์แม่แบบ",
          ]);
          setParsedData([]);
          return;
        }

        const items: any[] = [];
        const localErrors: string[] = [];

        dataRows.forEach((row, rowIndex) => {
          const rowNum = rowIndex + 2;
          const item: Record<string, any> = {};

          // Initialize fields
          item.projectCode = "";
          item.projectName = "";

          row.forEach((cell, cellIndex) => {
            const propName = headerIndices[cellIndex];
            if (propName) {
              item[propName] = cell;
            }
          });

          // Validation
          if (!item.projectCode) {
            localErrors.push(`แถวที่ ${rowNum}: ไม่ระบุรหัสโครงการ`);
          }
          if (!item.projectName) {
            localErrors.push(`แถวที่ ${rowNum}: ไม่ระบุชื่อโครงการ`);
          }

          if (item.budgetRequested) {
            const cleanVal = String(item.budgetRequested).replace(/,/g, "").trim();
            if (cleanVal && isNaN(Number(cleanVal))) {
              localErrors.push(`แถวที่ ${rowNum}: งบประมาณเสนอขอ '${item.budgetRequested}' ไม่ใช่ตัวเลขที่ถูกต้อง`);
            }
          }

          items.push(item);
        });

        setClientErrors(localErrors);
        setParsedData(items);
      } catch (err: any) {
        setClientErrors([`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`]);
        setParsedData([]);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        processFile(file);
      } else {
        setClientErrors(["กรุณาเลือกไฟล์รูปแบบ CSV (.csv) เท่านั้น"]);
      }
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
      setLoading(false);

      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          setServerErrors(data.errors);
        } else {
          setServerErrors([data.error || "เกิดข้อผิดพลาดไม่ทราบสาเหตุจากเซิร์ฟเวอร์"]);
        }
        return;
      }

      setSuccessCount(data.count);
      setParsedData([]);
      setFileName("");
      router.refresh();
    } catch (err: any) {
      setLoading(false);
      setServerErrors([`ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ${err.message}`]);
    }
  };

  const resetState = () => {
    setIsOpen(false);
    setParsedData([]);
    setClientErrors([]);
    setServerErrors([]);
    setSuccessCount(null);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="flex w-full items-center gap-2 sm:w-auto"
        onClick={() => setIsOpen(true)}
      >
        <Upload className="h-4 w-4" />
        นำเข้าโครงการ (CSV)
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200">
          <div className="bg-background border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">นำเข้าโครงการผ่านไฟล์ CSV</h2>
              </div>
              <button onClick={resetState} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Instructions and Download Template */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30">
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">การกรอกข้อมูลในไฟล์ CSV</h4>
                  <p className="text-xs text-emerald-700/90 dark:text-emerald-400/90">
                    หัวตารางต้องตรงตามเทมเพลต คอลัมน์ที่จำเป็นต้องระบุคือ <strong>รหัสโครงการ</strong> และ <strong>ชื่อโครงการ</strong>
                  </p>
                </div>
                <Button size="sm" variant="outline" className="bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300 gap-1.5 flex shrink-0" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" />
                  ดาวน์โหลดไฟล์แม่แบบ
                </Button>
              </div>

              {/* Drag and Drop Zone */}
              {!fileName && !successCount && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3 ${
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
                  <div className="p-3 rounded-full bg-muted text-muted-foreground">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์ CSV มาวางที่นี่</p>
                    <p className="text-xs text-muted-foreground">รองรับไฟล์รูปแบบ CSV (.csv) ขนาดไม่เกิน 5MB</p>
                  </div>
                </div>
              )}

              {/* File Info */}
              {fileName && (
                <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="font-medium text-sm">{fileName}</p>
                      <p className="text-xs text-muted-foreground">ตรวจพบข้อมูลจำนวน {parsedData.length} โครงการ</p>
                    </div>
                  </div>
                  {!loading && (
                    <Button variant="ghost" size="icon" onClick={() => { setFileName(""); setParsedData([]); setClientErrors([]); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* Success Screen */}
              {successCount !== null && (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full animate-bounce">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">นำเข้าข้อมูลสำเร็จ</h3>
                    <p className="text-sm text-muted-foreground">นำเข้าโครงการเข้าระบบเรียบร้อยแล้วทั้งหมด {successCount} โครงการ</p>
                  </div>
                  <Button onClick={resetState}>ปิดหน้าต่าง</Button>
                </div>
              )}

              {/* Client Validation Errors */}
              {clientErrors.length > 0 && (
                <div className="p-4 rounded-lg bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span>พบข้อผิดพลาดจากข้อมูลในไฟล์ ({clientErrors.length} จุด)</span>
                  </div>
                  <ul className="text-xs list-disc pl-5 space-y-1 max-h-[160px] overflow-y-auto">
                    {clientErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-2 font-medium">
                    *กรุณาแก้ไขข้อมูลในไฟล์ CSV ให้ถูกต้องแล้วอัปโหลดใหม่อีกครั้ง
                  </p>
                </div>
              )}

              {/* Server Validation Errors */}
              {serverErrors.length > 0 && (
                <div className="p-4 rounded-lg bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span>ไม่สามารถนำเข้าข้อมูลได้ เนื่องจากตรวจพบข้อผิดพลาดบนเซิร์ฟเวอร์</span>
                  </div>
                  <ul className="text-xs list-disc pl-5 space-y-1 max-h-[200px] overflow-y-auto font-mono">
                    {serverErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-2 font-medium">
                    *เนื่องจากโครงสร้างระบบความปลอดภัย ข้อมูลทั้งหมดจะไม่ถูกบันทึกหากมีจุดที่ผิดพลาด กรุณาแก้ไขไฟล์แล้วทำการอัปโหลดใหม่อีกครั้ง
                  </p>
                </div>
              )}

              {/* Preview Table */}
              {parsedData.length > 0 && clientErrors.length === 0 && serverErrors.length === 0 && (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm text-muted-foreground">ตัวอย่างตารางข้อมูลที่จะนำเข้า (แสดงสูงสุด 5 โครงการ)</h3>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b bg-muted/50 font-medium text-muted-foreground">
                          <th className="p-2.5">รหัสโครงการ</th>
                          <th className="p-2.5">ชื่อโครงการ</th>
                          <th className="p-2.5">ปีงบฯ</th>
                          <th className="p-2.5">ฝ่าย/กลุ่มงาน</th>
                          <th className="p-2.5 text-right">งบเสนอขอ (บาท)</th>
                          <th className="p-2.5">ผู้รับผิดชอบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-muted/10">
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
                    <p className="text-xs text-muted-foreground text-center">และอีก {parsedData.length - 5} โครงการ...</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-2">
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
                    <>
                      นำเข้าข้อมูล ({parsedData.length})
                    </>
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
