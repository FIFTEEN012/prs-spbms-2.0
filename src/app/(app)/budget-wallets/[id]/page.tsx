import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateWalletBalance } from "@/lib/budget-wallets";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canViewBudgetWallet } from "@/lib/authorization";

const TYPE_LABELS: Record<string, string> = {
  ALLOCATION: "จัดสรร",
  COMMITMENT: "กันวงเงิน",
  COMMITMENT_RELEASE: "คืนวงเงินกัน",
  DISBURSEMENT: "จ่ายจริง",
  REFUND: "คืนเงิน",
  TRANSFER_IN: "โอนเข้า",
  TRANSFER_OUT: "โอนออก",
  ADJUSTMENT_INCREASE: "ปรับเพิ่ม",
  ADJUSTMENT_DECREASE: "ปรับลด",
};

export default async function WalletStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { id } = await params;
  const wallet = await prisma.budgetWallet.findUnique({
    where: { id },
    include: {
      budgetPlan: { include: { academicYear: true, fiscalYear: true } },
      ledgerEntries: { include: { postedBy: { select: { fullName: true } } }, orderBy: [{ postedAt: "desc" }, { id: "desc" }] },
      fundingAllocations: { include: { activity: { include: { project: true } } } },
    },
  });
  if (!wallet) notFound();
  if (!canViewBudgetWallet(session.user, wallet)) redirect("/dashboard");

  const balance = calculateWalletBalance(wallet.ledgerEntries);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Wallet statement</div>
        <h1 className="mt-1 text-2xl font-bold">{wallet.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{wallet.budgetPlan.name} · ปีการศึกษา {wallet.budgetPlan.academicYear.yearName} · ปีงบประมาณ {wallet.budgetPlan.fiscalYear.yearName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="จัดสรรสุทธิ" value={balance.allocated} />
        <Stat label="ผูก/กันไว้" value={balance.committed} />
        <Stat label="จ่ายสุทธิ" value={balance.netDisbursed} />
        <Stat label="คงเหลือทางบัญชี" value={balance.accountingBalance} />
        <Stat label="พร้อมใช้" value={balance.availableBalance} emphasis />
      </div>

      <Card>
        <CardHeader><CardTitle>รายการเดินบัญชี</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40 text-left text-muted-foreground"><th className="p-3">วันที่</th><th className="p-3">ประเภท</th><th className="p-3">รายละเอียด</th><th className="p-3">ผู้บันทึก</th><th className="p-3 text-right">จำนวนเงิน</th></tr></thead>
              <tbody>
                {wallet.ledgerEntries.map((entry) => {
                  const negative = ["COMMITMENT", "DISBURSEMENT", "TRANSFER_OUT", "ADJUSTMENT_DECREASE"].includes(entry.entryType);
                  return <tr key={entry.id} className="border-b last:border-0"><td className="whitespace-nowrap p-3">{formatThaiDate(entry.postedAt)}</td><td className="p-3"><span className="rounded-full border px-2 py-0.5 text-xs">{TYPE_LABELS[entry.entryType]}</span></td><td className="p-3">{entry.description}</td><td className="whitespace-nowrap p-3 text-muted-foreground">{entry.postedBy.fullName}</td><td className={`whitespace-nowrap p-3 text-right font-mono font-semibold ${negative ? "text-red-600" : "text-emerald-700"}`}>{negative ? "-" : "+"}{formatBaht(Number(entry.amount))}</td></tr>;
                })}
                {wallet.ledgerEntries.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">ยังไม่มีรายการในกระเป๋านี้</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>กิจกรรมโครงการที่ใช้กระเป๋านี้</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {wallet.fundingAllocations.map((allocation) => <div key={allocation.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><div className="font-semibold">{allocation.activity.project.projectCode} · {allocation.activity.project.projectName}</div><div className="text-xs text-muted-foreground">{allocation.activity.name}</div></div><div className="font-mono font-bold">{formatBaht(Number(allocation.approvedAmount ?? allocation.requestedAmount))}</div></div>)}
          {wallet.fundingAllocations.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีกิจกรรมที่ผูกกับกระเป๋านี้</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return <Card className={emphasis ? "border-emerald-300 bg-emerald-50/60" : ""}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-xl font-bold ${emphasis ? "text-emerald-800" : ""}`}>{formatBaht(value)}</div></CardContent></Card>;
}
