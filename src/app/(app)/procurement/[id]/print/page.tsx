/* eslint-disable @next/next/no-img-element -- print layout requires fixed physical image dimensions */
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Pencil,
  Printer,
} from "lucide-react";
import {
  PURCHASE_ITEM_CAPACITY_ERROR,
  formatMemoBudgetAmount,
  getPurchaseItemCapacityError,
  getPurchasePrintRows,
} from "@/lib/procurement-print";
import { PrintButton, PrintTrigger } from "./_trigger";

// Thai Baht Text conversion helper
function getBahtText(num: number): string {
  if (isNaN(num) || num <= 0) return "ศูนย์บาทถ้วน";
  num = Math.round(num * 100) / 100;
  const numStr = num.toFixed(2);
  const [integerPart, decimalPart] = numStr.split(".");

  const thNumbers = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const thPositions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  let result = "";

  if (Number(integerPart) > 0) {
    const len = integerPart.length;
    for (let i = 0; i < len; i++) {
      const digit = Number(integerPart[i]);
      if (digit !== 0) {
        const pos = len - 1 - i;
        if (pos % 6 === 0 && pos > 0) {
          result += "ล้าน";
        }
        const posName = thPositions[pos % 6];
        let digitName = thNumbers[digit];
        if (pos % 6 === 1 && digit === 1) digitName = "";
        if (pos % 6 === 1 && digit === 2) digitName = "ยี่";
        if (pos % 6 === 0 && digit === 1 && len > 1) digitName = "เอ็ด";
        result += digitName + posName;
      }
    }
    result += "บาท";
  }

  if (Number(decimalPart) === 0 || decimalPart === "00") {
    result += "ถ้วน";
  } else {
    const len = decimalPart.length;
    for (let i = 0; i < len; i++) {
      const digit = Number(decimalPart[i]);
      if (digit !== 0) {
        const pos = len - 1 - i;
        const posName = thPositions[pos];
        let digitName = thNumbers[digit];
        if (pos === 1 && digit === 1) digitName = "";
        if (pos === 1 && digit === 2) digitName = "ยี่";
        if (pos === 0 && digit === 1 && decimalPart[0] !== "0") digitName = "เอ็ด";
        result += digitName + posName;
      }
    }
    result += "สตางค์";
  }

  return result;
}

export default async function PrintPurchaseRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { id } = await params;
  await searchParams;
  if (!id) return notFound();

  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      project: {
        include: { department: true },
      },
      activity: true,
      fundSource: true,
      budgetWallet: {
        select: {
          name: true,
          code: true,
        },
      },
      items: true,
      createdBy: true,
    },
  });

  if (!request) return notFound();

  const capacityError = getPurchaseItemCapacityError(request.items.length);
  if (capacityError) {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950 print:hidden">
        <h1 className="text-xl font-bold">ไม่สามารถพิมพ์บันทึกข้อความได้</h1>
        <p className="mt-2">{PURCHASE_ITEM_CAPACITY_ERROR}</p>
        <p className="mt-2 text-sm">คำขอนี้มี {request.items.length} รายการ</p>
      </div>
    );
  }

  const printRows = getPurchasePrintRows(request.items);

  // Load approver users' profiles
  const approverIds = [
    request.planApprovedById,
    request.financeApprovedById,
    request.procurementApprovedById,
    request.budgetApprovedById,
    request.directorApprovedById,
  ].filter((uid): uid is string => uid !== null);

  const approvers = await prisma.user.findMany({
    where: { id: { in: approverIds } },
    select: { id: true, fullName: true, role: true },
  });

  const approverMap = approvers.reduce((map, user) => {
    map[user.id] = user.fullName;
    return map;
  }, {} as Record<string, string>);

  const committeeList = Array.isArray(request.committee)
    ? request.committee
    : JSON.parse((request.committee as string) || "[]");
  const committeeRows = Array.from({ length: 3 }, (_, index) => committeeList[index] ?? null);

  const documentDate = new Date(request.documentDate);
  const docDay = documentDate.getDate();
  const docMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const docMonth = docMonths[documentDate.getMonth()];
  const docYear = documentDate.getFullYear() + 543;
  const allocatedBudget = Number(request.allocatedBudget ?? request.project.budgetApproved ?? 0);
  const requestedAmount = Number(request.requestedAmount);
  const remainingBalance = Number(request.remainingBalance ?? 0);
  const previousBalance = Number(request.previousBalance ?? 0);
  const spentBefore = Math.max(0, allocatedBudget - previousBalance);
  const usedAfterPercent = allocatedBudget > 0
    ? Math.min(100, ((spentBefore + requestedAmount) / allocatedBudget) * 100)
    : 0;
  const remainingPercent = Math.max(0, 100 - usedAfterPercent);
  const approvalHistory = [
    {
      label: "สร้างเอกสาร",
      at: request.createdAt,
      by: request.createdBy?.fullName ?? "ไม่ระบุ",
      done: true,
    },
    {
      label: "งานแผนงานตรวจสอบ",
      at: request.planApprovedAt,
      by: request.planApprovedById ? approverMap[request.planApprovedById] : null,
      done: Boolean(request.planApprovedAt),
    },
    {
      label: "งานการเงินตรวจสอบ",
      at: request.financeApprovedAt,
      by: request.financeApprovedById ? approverMap[request.financeApprovedById] : null,
      done: Boolean(request.financeApprovedAt),
    },
    {
      label: "งานพัสดุตรวจสอบ",
      at: request.procurementApprovedAt,
      by: request.procurementApprovedById ? approverMap[request.procurementApprovedById] : null,
      done: Boolean(request.procurementApprovedAt),
    },
    {
      label: "หัวหน้างบเห็นชอบ",
      at: request.budgetApprovedAt,
      by: request.budgetApprovedById ? approverMap[request.budgetApprovedById] : null,
      done: Boolean(request.budgetApprovedAt),
    },
    {
      label: "ผู้บริหารอนุมัติ",
      at: request.directorApprovedAt,
      by: request.directorApprovedById ? approverMap[request.directorApprovedById] : null,
      done: Boolean(request.directorApprovedAt),
    },
  ];

  // Dotted underline helper
  const dots = (n: number) => ".".repeat(n);

  return (
    <>
      <PrintTrigger />

      <style dangerouslySetInnerHTML={{
        __html: `
        @font-face {
          font-family: 'TH Sarabun PSK';
          src: local('TH Sarabun PSK'), local('THSarabunPSK'), local('TH SarabunPSK');
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'Sarabun', sans-serif !important;
          font-size: 12pt;
          line-height: 1.05;
          color: #000 !important;
          background: #faf8ff;
        }

        .preview-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(0,45,118,0.08), transparent 30rem),
            radial-gradient(circle at bottom left, rgba(253,196,37,0.08), transparent 24rem),
            #faf8ff;
          color: #131b2e;
          font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important;
        }

        .preview-toolbar,
        .preview-rail {
          font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important;
        }

        .document-canvas {
          min-width: 0;
        }

        .print-page {
          background: #fff;
          width: 21cm;
          height: 29.7cm;
          max-height: 29.7cm;
          overflow: visible;
          padding: 1cm;
          margin: 10px auto;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          position: relative;
          break-after: page;
          page-break-after: always;
          page-break-inside: avoid;
        }

        .print-page:last-of-type {
          break-after: auto;
          page-break-after: auto;
        }

        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          html, body { background: #fff !important; margin: 0 !important; width: 21cm; }
          .no-print { display: none !important; }
          .preview-shell {
            min-height: auto !important;
            background: #fff !important;
            display: block !important;
          }
          .document-canvas {
            display: block !important;
            width: 21cm !important;
          }
          .print-page {
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always !important;
          }
          .print-page:last-of-type { page-break-after: auto !important; }
        }

        table { border-collapse: collapse; }
        td, th {
          font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'Sarabun', sans-serif !important;
          font-size: 12pt;
          color: #000 !important;
        }

        .cb { display: inline-block; width: 0.34cm; height: 0.34cm; border: 1px solid #000; text-align: center; line-height: 0.3cm; font-size: 9pt; vertical-align: -0.04cm; margin-right: 0.05cm; }
        .cb-checked::after { content: '✓'; }
        .dotline { border-bottom: 1px dotted #000; display: inline-block; min-width: 40px; }
        .opinion-table { width: 19cm; table-layout: fixed; }
        .opinion-table td { width: 9.5cm; border: 1px solid #000; padding: 0.1cm 0.16cm; vertical-align: top; }
        .item-table { width: 19.24cm; margin-left: -0.12cm; table-layout: fixed; }
        .item-table th, .item-table td { border: 1px solid #000; padding: 0.03cm 0.08cm; }
        .item-table .item-row { height: 0.62cm; }
      ` }} />

      <main className="preview-shell px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="no-print preview-toolbar mb-6 flex flex-col gap-4 rounded-xl border border-[#c3c6d4] bg-white/80 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <Link href={`/procurement/${request.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#434652] transition hover:text-[#002d76]">
                <ArrowLeft className="size-4" />
                กลับไปที่รายละเอียด
              </Link>
              <h1 className="mt-2 text-2xl font-extrabold text-[#131b2e]">
                ใบขอซื้อ/ขอจ้าง {request.documentNo ? `เลขที่ ${request.documentNo}` : ""}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-[#434652]">{request.subject}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/procurement/${request.id}/edit`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c3c6d4] bg-white px-4 text-sm font-semibold text-[#131b2e] transition hover:bg-[#f2f3ff]"
              >
                <Pencil className="size-4" />
                แก้ไขข้อมูล
              </Link>
              <PrintButton className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c3c6d4] bg-white px-4 text-sm font-semibold text-[#131b2e] transition hover:bg-[#f2f3ff]">
                <FileText className="size-4" />
                บันทึกเป็น PDF
              </PrintButton>
              <PrintButton className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002d76] px-5 text-sm font-bold text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#0842a1]">
                <Printer className="size-4" />
                พิมพ์เอกสาร
              </PrintButton>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="document-canvas min-w-0">
      {/* ============ PAGE 1: บันทึกข้อความ ============ */}
      <div className="print-page" data-print-page="1">

        {/* Header */}
        <div style={{ textAlign: 'center', position: 'relative', marginBottom: '4px' }}>
          <img src="/garuda.png" alt="ครุฑ" style={{ position: 'absolute', left: 0, top: 0, width: '1.52cm', height: '1.5cm', objectFit: 'contain' }} />
          <div style={{ fontSize: '18pt', fontWeight: 'bold', letterSpacing: '0.12cm', paddingTop: '0.25cm' }}>บันทึกข้อความ</div>
        </div>

        {/* ส่วนราชการ */}
        <div style={{ marginBottom: '2px', marginTop: '20px' }}>
          <b>ส่วนราชการ</b> <span className="dotline" style={{ minWidth: '80%' }}>โรงเรียนประชารัฐพัฒนศึกษา อำเภอสมเด็จ จังหวัดกาฬสินธุ์ สำนักงานเขตพื้นที่การศึกษามัธยมศึกษากาฬสินธุ์</span>
        </div>
        <div style={{ display: 'flex', marginBottom: '2px' }}>
          <span><b>ที่</b> <span className="dotline" style={{ minWidth: '200px' }}>{request.documentNo ?? dots(40)}</span></span>
          <span style={{ marginLeft: '20px' }}><b>วันที่</b> <span className="dotline" style={{ minWidth: '200px' }}>{docDay} เดือน {docMonth} พ.ศ. {docYear}</span></span>
        </div>
        <div style={{ marginBottom: '2px' }}>
          <b>เรื่อง</b> <span className="dotline" style={{ minWidth: '85%' }}>{request.subject}</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          <b>เรียน</b> ผู้อำนวยการโรงเรียนประชารัฐพัฒนศึกษา
        </div>

        {/* Body */}
        <div style={{ textIndent: '50px', textAlign: 'justify', marginBottom: '2px' }}>
          ด้วยกลุ่มบริหาร/กลุ่มสาระการเรียนรู้ <span className="dotline">{request.project.department?.name ?? dots(30)}</span> มีความประสงค์ดำเนินการ
        </div>
        <div style={{ paddingLeft: '20px', marginBottom: '2px' }}>
          <b>จัดซื้อ - จัดจ้าง และเบิกจ่ายเงินค่า</b>
        </div>

        {/* Category checkboxes follow the source template's two lines. */}
        <div style={{ paddingLeft: '0.5cm', marginBottom: '0.05cm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><span className={`cb ${request.category === "SUPPLIES" ? "cb-checked" : ""}`}></span>วัสดุ</span>
            <span><span className={`cb ${request.category === "EQUIPMENT" ? "cb-checked" : ""}`}></span>ครุภัณฑ์</span>
            <span><span className={`cb ${request.category === "FUEL" ? "cb-checked" : ""}`}></span>น้ำมันเชื้อเพลิง</span>
            <span><span className={`cb ${request.category === "RENOVATION" ? "cb-checked" : ""}`}></span>ปรับปรุง/ซ่อมแซม</span>
            <span><span className={`cb ${request.category === "REMUNERATION" ? "cb-checked" : ""}`}></span>เบิกค่าตอบแทน</span>
            <span><span className={`cb ${request.category === "EXPENSES" ? "cb-checked" : ""}`}></span>เบิกเงินค่าใช้สอย</span>
          </div>
          <div>
            <span><span className={`cb ${request.category === "TEMP_WAGE" ? "cb-checked" : ""}`}></span>ค่าจ้างชั่วคราว</span>
            <span style={{ marginLeft: '0.8cm' }}><span className={`cb ${request.category === "CONTRACT" ? "cb-checked" : ""}`}></span>จ้างเหมา</span>
            <span style={{ marginLeft: '2cm' }}><span className={`cb ${request.category === "OTHERS" ? "cb-checked" : ""}`}></span>อื่น ๆ (ระบุ) <span className="dotline">{request.categoryDetails ?? dots(35)}</span></span>
          </div>
        </div>

        {/* ตามแผนงาน */}
        <div style={{ textIndent: '30px', marginBottom: '2px' }}>
          ตามแผนงานโครงการ <span className="dotline">{request.project.projectName}</span>
          {request.activity && <> กิจกรรม <span className="dotline">{request.activity.name}</span></>}
          {' '}ซึ่งกำหนดไว้ในแผนฯ
          {request.borrowedFrom && (() => {
            const borrowedList = Array.isArray(request.borrowedFrom)
              ? (request.borrowedFrom as any[])
              : JSON.parse((request.borrowedFrom as string) || "[]");
            if (borrowedList.length === 0) return null;
            const details = borrowedList.map((b: any) => `${b.activityName} (ยืม ${formatBaht(Number(b.amount))} บาท)`).join(", ");
            return <> (ยืมงบประมาณเพิ่มเติมจาก: {details})</>;
          })()}
        </div>
        <div style={{ marginBottom: '2px' }}>
          หน้า <span className="dotline">{request.actionPlanPage ?? dots(10)}</span>
          {' '}<span className={`cb ${!request.isNotInPlan ? "cb-checked" : ""}`}></span>กำหนดไว้ในแผนฯ
          {' '}<span className={`cb ${request.isNotInPlan ? "cb-checked" : ""}`}></span>ไม่ได้กำหนดไว้ในแผนฯ แต่มีความจำเป็นดังนี้
          {request.isNotInPlan && <> <span className="dotline">{request.necessityDetails}</span></>}
        </div>

        {/* Fund source + checkboxes */}
        <div style={{ textIndent: '30px', marginBottom: '2px' }}>
          โดยใช้เงิน <span className={`cb ${request.fundSource?.name?.includes("อุดหนุน") ? "cb-checked" : ""}`}></span> เงินอุดหนุน
          {' '}<span className={`cb ${request.fundSource?.name?.includes("เรียนฟรี") || request.fundSource?.name?.includes("15 ปี") ? "cb-checked" : ""}`}></span> เงินอุดหนุน(เรียนฟรี 15 ปี)
          {' '}<span className={`cb ${request.fundSource?.name?.includes("รายได้") ? "cb-checked" : ""}`}></span> รายได้สถานศึกษา
          {' '}<span className={`cb ${request.category === "OTHERS" ? "cb-checked" : ""}`}></span> อื่น ๆ (ระบุ) <span className="dotline">{dots(15)}</span>
          {' '}จำนวนเงิน <span className="dotline" style={{ fontWeight: 'bold' }}>{formatBaht(Number(request.requestedAmount))}</span> บาท
        </div>

        {/* เสนอชื่อ */}
        <div style={{ marginBottom: '2px' }}>
          รายละเอียดตามตัวอย่างดังแนบ โดยเสนอชื่อคณะกรรมการตรวจรับ ดังนี้
        </div>

        {/* Committee */}
        <div style={{ paddingLeft: '40px', marginBottom: '2px' }}>
          {committeeRows.map((comm: any, idx: number) => (
            <div key={idx}>
              {idx + 1}. <span className="dotline" style={{ minWidth: '6.5cm' }}>{comm?.name ?? ""}</span>
              {' '}{idx === 0 ? "ประธานกรรมการ/ผู้ตรวจรับ" : "กรรมการ/ผู้ตรวจรับ"} รับทราบ
            </div>
          ))}
        </div>

        <div style={{ textIndent: '30px', marginBottom: '2px' }}>
          จึงเรียนมาเพื่อโปรดทราบพิจารณาต่อไป
        </div>

        {/* Plan checkboxes */}
        <div style={{ paddingLeft: '20px', marginBottom: '2px' }}>
          <span className={`cb ${!request.isNotInPlan ? "cb-checked" : ""}`}></span> มีในแผนปฏิบัติการ
          {' '}<span className={`cb ${request.isNotInPlan ? "cb-checked" : ""}`}></span> เปลี่ยนแปลงงบประมาณ
          {' '}<span className="cb"></span> ไม่มีในแผนปฏิบัติการ (แนบบันทึกข้อความขออนุมัติ)
        </div>

        {/* Requester signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0.8cm', marginBottom: '0.1cm', fontSize: '12pt' }}>
          <div style={{ textAlign: 'center' }}>
            <div>ลงชื่อ{dots(40)}ผู้ขออนุมัติ</div>
            <div>({request.createdBy?.fullName ?? dots(35)})</div>
            <div>วันที่{dots(5)}/{dots(5)}/{dots(5)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div>ลงชื่อ{dots(40)}หัวหน้ากลุ่มงาน/กลุ่มสาระฯ</div>
            <div>({dots(35)})</div>
            <div>วันที่{dots(5)}/{dots(5)}/{dots(5)}</div>
          </div>
        </div>

        {/* ============ Bottom Opinion Grid ============ */}
        <table className="opinion-table" style={{ fontSize: '12pt', lineHeight: '1.05' }}>
          <tbody>
            <tr>
              {/* Left-Top: บันทึกงานแผนงาน */}
              <td rowSpan={2} style={{ height: '7.86cm' }}>
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', textAlign: 'center', marginBottom: '2px' }}>บันทึกงานแผนงาน</div>
                <div><span className={`cb ${request.planApprovedById ? "cb-checked" : ""}`}></span> ถูกต้องตามแผนปฏิบัติการ</div>
                <div><span className="cb"></span> ถูกต้องตามบันทึกข้อความขออนุมัติ</div>
                <div><span className="cb"></span> ให้ทำบันทึก/ตามที่แจ้ง{dots(30)}</div>
                <div>ใช้งบประมาณประเภท <span className="dotline">{request.fundSource?.name ?? dots(25)}</span></div>
                <div>จำนวนเงินที่ได้รับจัดสรรทั้งหมด <span className="dotline">{formatMemoBudgetAmount(request.allocatedBudget)}</span> บาท</div>
                <div>ยอดเงินคงเหลือจากครั้งก่อน <span className="dotline">{formatMemoBudgetAmount(request.previousBalance)}</span> บาท</div>
                <div>ขออนุมัติใช้เงินในครั้งนี้ <span className="dotline">{formatMemoBudgetAmount(request.requestedAmount)}</span> บาท</div>
                <div>ยอดเงินคงเหลือสะสม <span className="dotline">{formatMemoBudgetAmount(request.remainingBalance, 25)}</span> บาท</div>
                <div style={{ textAlign: 'center', marginTop: '2px' }}>
                  ลงชื่อ{dots(30)}งานแผนงาน
                </div>
                <div style={{ textAlign: 'center' }}>({dots(30)})</div>
                <div style={{ fontWeight: 'bold', marginTop: '2px' }}>ความเห็นหัวหน้างานนโยบายและแผน:</div>
                <div>{dots(60)}</div>
                <div style={{ textAlign: 'center', marginTop: '2px' }}>
                  ลงชื่อ{dots(30)}หัวหน้างานนโยบายและแผน
                </div>
              </td>

              {/* Right-Top: ความเห็นงานการเงิน */}
              <td style={{ height: '4.76cm' }}>
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', textAlign: 'center', marginBottom: '2px' }}>ความเห็นงานการเงิน</div>
                <div>มีเงินคงเหลือ คงค้างอยู่จริงสะสม <span className="dotline">{formatMemoBudgetAmount(request.remainingBalance, 15)}</span> บาท</div>
                <div style={{ fontWeight: 'bold' }}>ประเภทงบประมาณที่ใช้:</div>
                <div>
                  <span className={`cb ${request.fundSource?.name?.includes("อุดหนุน") ? "cb-checked" : ""}`}></span> เงินอุดหนุน(สพฐ.จัดสรร)
                  {' '}<span className="cb"></span> รายได้สถานศึกษา
                </div>
                <div>
                  <span className="cb"></span> เงินอุดหนุน
                  {' '}<span className="cb"></span> อื่นๆ{dots(20)}
                </div>
                <div>
                  สามารถเบิกจ่ายเงินได้ <span className={`cb ${request.financeApprovedById ? "cb-checked" : ""}`}></span> ได้
                  {' '}<span className="cb"></span> ไม่ได้
                </div>
                <div>({dots(50)})</div>
                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  ลงชื่อ{dots(30)}เจ้าหน้าที่การเงิน
                </div>
                <div style={{ textAlign: 'center' }}>({dots(30)})</div>
              </td>
            </tr>

            <tr>
              {/* Right-Bottom: ความคิดเห็นหัวหน้ากลุ่มบริหารงานงบประมาณ */}
              <td style={{ height: '3.1cm' }}>
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', textAlign: 'center', marginBottom: '2px' }}>ความเห็นหัวหน้ากลุ่มบริหารงานงบประมาณ</div>
                <div>
                  <span className={`cb ${request.budgetApprovedById ? "cb-checked" : ""}`}></span> เห็นควรอนุมัติ
                  {' '}<span className="cb"></span> ไม่เห็นควรอนุมัติ
                  {' '}<span className="cb"></span> อื่น ๆ
                </div>
                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  ลงชื่อ{dots(30)}หัวหน้ากลุ่มบริหารงานงบประมาณ
                </div>
                <div style={{ textAlign: 'center' }}>({dots(30)})</div>
              </td>
            </tr>

            <tr>
              {/* Left-Bottom: ความเห็นงานพัสดุ */}
              <td style={{ height: '3.55cm' }}>
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', textAlign: 'center', marginBottom: '2px' }}>ความเห็นงานพัสดุ</div>
                <div><span className={`cb ${request.procurementApprovedById ? "cb-checked" : ""}`}></span> เห็นควรจัดซื้อ/จัดจ้างรายการดังกล่าว</div>
                <div><span className="cb"></span> ไม่เห็นควรจัดซื้อจัดจ้างเนื่องจาก{dots(15)}</div>
                <div>เพื่อทราบจัดซื้อ/จ้างจากร้าน{dots(20)}</div>
                <div style={{ textAlign: 'center', marginTop: '2px' }}>ลงชื่อ{dots(30)}เจ้าหน้าที่พัสดุ</div>
                <div style={{ textAlign: 'center' }}>({request.procurementApprovedById ? approverMap[request.procurementApprovedById] : dots(30)})</div>
              </td>

              {/* Right-Bottom2: ความคิดเห็นผู้อำนวยการ */}
              <td style={{ height: '3.55cm' }}>
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', textAlign: 'center', marginBottom: '2px' }}>ความคิดเห็นของผู้อำนวยการโรงเรียน</div>
                <div>
                  <span className={`cb ${request.directorApprovedById ? "cb-checked" : ""}`}></span> อนุมัติ
                  {' '}<span className="cb"></span> ไม่อนุมัติ
                  {' '}<span className="cb"></span> อื่น ๆ
                </div>
                <div>{dots(60)}</div>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginTop: '6px' }}>
                  ({request.directorApprovedById ? approverMap[request.directorApprovedById] : "นางชนิกา จำเริญสรรพ์"}) จังหวัดกาฬสินธุ์
                </div>
                <div style={{ textAlign: 'center' }}>{dots(50)}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ============ PAGE 2: รายละเอียดรายการจัดซื้อจัดจ้าง ============ */}
      <div className="print-page" data-print-page="2">

        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12pt', marginBottom: '0.12cm', textDecoration: 'underline' }}>
          รายละเอียดรายการวัสดุ/ครุภัณฑ์/จัดจ้าง
        </div>

        {/* Items Table */}
        <table className="item-table" style={{ fontSize: '12pt', lineHeight: '1' }}>
          <colgroup>
            <col style={{ width: '0.99cm' }} />
            <col style={{ width: '7cm' }} />
            <col style={{ width: '2.75cm' }} />
            <col style={{ width: '3cm' }} />
            <col style={{ width: '2.75cm' }} />
            <col style={{ width: '2.74cm' }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
              <th>ที่</th>
              <th style={{ textAlign: 'left' }}>รายการ</th>
              <th>จำนวนหน่วย</th>
              <th>ราคาต่อหน่วย</th>
              <th>จำนวนเงิน</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {printRows.map((item, index) => (
              <tr className="item-row" key={item?.id ?? `blank-${index}`}>
                <td style={{ textAlign: 'center' }}>{item ? index + 1 : <>&nbsp;</>}</td>
                <td>{item?.itemName ?? <>&nbsp;</>}</td>
                <td style={{ textAlign: 'center' }}>{item?.quantity ?? ""}</td>
                <td style={{ textAlign: 'right' }}>{item ? formatBaht(Number(item.unitPrice)) : ""}</td>
                <td style={{ textAlign: 'right' }}>{item ? formatBaht(Number(item.totalPrice)) : ""}</td>
                <td>{item?.remarks ?? ""}</td>
              </tr>
            ))}
            {/* Total row */}
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan={4} style={{ textAlign: 'right' }}>รวม</td>
              <td style={{ textAlign: 'right' }}>{formatBaht(Number(request.requestedAmount))}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={6} style={{ textAlign: 'center' }}>(ตัวบรรจง) {getBahtText(Number(request.requestedAmount))}</td>
            </tr>
          </tbody>
        </table>

        {/* Approver signature follows the source template. */}
        <div style={{ width: '9.5cm', marginLeft: 'auto', marginTop: '0.35cm', textAlign: 'center' }}>
          <div>ลงชื่อ{dots(38)}ผู้อนุมัติ</div>
          <div>({request.directorApprovedById ? approverMap[request.directorApprovedById] : "นางชนัฎฎา จำเริญสรรพ์"})</div>
          <div>ผู้อำนวยการโรงเรียนประชารัฐพัฒนศึกษา</div>
          <div>วันที่{dots(5)}/{dots(5)}/{dots(5)}</div>
        </div>

        {/* Footnotes */}
        <div style={{ marginTop: '1.8cm', fontSize: '12pt', lineHeight: '1.05' }}>
          <div><b>หมายเหตุ</b> 1. ในการอนุญาตจัดซื้อหรือจัดจ้างแต่ละครั้งในวงเงินเกิน 10,000 บาท ต้องมีใบเสนอราคามาด้วย</div>
          <div style={{ paddingLeft: '1.25cm' }}>2. ในกรณีที่เป็นเงินงบประมาณแผ่นดินต้องแนบใบเสนอราคามาทุกวงเงิน</div>
          <div style={{ paddingLeft: '1.25cm' }}>3. วงเงินที่ขออนุมัติซื้อหรือจ้างต้องรวมภาษีมูลค่าเพิ่ม (ถ้ามี)</div>
          <div style={{ paddingLeft: '1.25cm' }}>4. กรณีวงเงินเกิน 100,000 บาท แต่งตั้งคณะกรรมการตรวจรับ 3 คน ต่ำกว่า 100,000 บาท 1 คน</div>
        </div>
      </div>
            </div>

            <aside className="no-print preview-rail space-y-4 xl:sticky xl:top-6 xl:self-start">
              <section className="overflow-hidden rounded-xl border border-[#c3c6d4] bg-white shadow-sm">
                <div className="border-b border-[#c3c6d4] bg-[#e2e7ff] px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#002d76]">
                    <BarChart3 className="size-4" />
                    สรุปงบประมาณโครงการ
                  </h2>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <p className="text-xs font-semibold text-[#434652]">งบประมาณที่ได้รับจัดสรร</p>
                    <p className="mt-1 text-xl font-extrabold text-[#131b2e]">{formatBaht(allocatedBudget)}</p>
                  </div>
                  <div className="h-px bg-[#c3c6d4]" />
                  <div>
                    <p className="text-xs font-semibold text-[#434652]">ยอดขอซื้อครั้งนี้</p>
                    <p className="mt-1 text-lg font-extrabold text-[#002d76]">{formatBaht(requestedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#434652]">งบคงเหลือหลังหักรายการ</p>
                    <p className="mt-1 text-lg font-extrabold text-[#785a00]">{formatBaht(remainingBalance)}</p>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] font-bold text-[#434652]">
                      <span>ใช้ไปแล้ว {usedAfterPercent.toFixed(1)}%</span>
                      <span>คงเหลือ {remainingPercent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#dae2fd]">
                      <div className="h-full rounded-full bg-[#002d76]" style={{ width: `${usedAfterPercent}%` }} />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[#c3c6d4] bg-white/80 p-4 shadow-sm backdrop-blur">
                <h2 className="border-b border-[#c3c6d4] pb-2 text-sm font-extrabold text-[#131b2e]">ข้อมูลเอกสาร</h2>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#434652]">เลขเอกสาร</p>
                    <p className="font-bold text-[#131b2e]">{request.documentNo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#434652]">ประเภท</p>
                    <p className="font-bold text-[#131b2e]">{request.category}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#434652]">สร้างโดย</p>
                    <p className="font-bold text-[#131b2e]">{request.createdBy?.fullName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#434652]">สถานะ</p>
                    <span className="inline-flex rounded-full bg-[#dae2ff] px-2 py-0.5 text-[10px] font-bold text-[#001848]">
                      {request.status}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold uppercase text-[#434652]">กระเป๋างบประมาณ</p>
                    <p className="font-bold text-[#131b2e]">{request.budgetWallet?.name || "ไม่ได้ระบุ"}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[#c3c6d4] bg-white p-4 shadow-sm">
                <h2 className="mb-4 text-sm font-extrabold text-[#131b2e]">ประวัติการดำเนินงาน</h2>
                <div className="space-y-4">
                  {approvalHistory.map((item, index) => (
                    <div key={item.label} className="flex gap-3">
                      <div className="relative pt-1">
                        <div className={item.done ? "size-2 rounded-full bg-[#002d76]" : "size-2 rounded-full border-2 border-[#747784]"} />
                        {index < approvalHistory.length - 1 && (
                          <div className="absolute left-[3px] top-4 h-8 w-px bg-[#c3c6d4]" />
                        )}
                      </div>
                      <div className={item.done ? "" : "opacity-50"}>
                        <p className="text-xs font-extrabold text-[#131b2e]">{item.label}</p>
                        <p className="text-[11px] text-[#434652]">
                          {item.done && item.at ? formatThaiDate(item.at) : "ขั้นตอนถัดไป"}
                        </p>
                        {item.done && item.by && (
                          <p className="text-[11px] font-semibold text-[#434652]">โดย {item.by}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <PrintButton className="fixed bottom-6 right-6 inline-flex size-14 items-center justify-center rounded-full bg-[#002d76] text-white shadow-lg transition active:scale-95 md:hidden">
                <Printer className="size-6" />
              </PrintButton>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
