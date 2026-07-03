import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBaht } from "@/lib/utils";
import { can } from "@/lib/rbac";
import { BudgetEntry } from "./_entry";
import { BudgetDeleteButton } from "./_delete-button";
import { summarizeProjectBudget } from "@/lib/budget-summary";

export default async function BudgetPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  const projects = await prisma.project.findMany({
    where: { status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] } },
    include: {
      department: true,
      fundSource: true,
      transactions: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows = projects.map((p) => {
    const budget = summarizeProjectBudget(p.budgetApproved, p.transactions);
    return {
      ...p,
      spent: budget.netSpent,
      remaining: budget.remaining,
    };
  });

  const canRecord = (r: any) => {
    if (can(role, "budget.record")) return true;
    return (
      (role === "TEACHER" || role === "DEPT_HEAD") &&
      session?.user?.departmentId != null &&
      session.user.departmentId === r.departmentId
    );
  };
  const showRecordCol = rows.some(canRecord);

  const totalApproved = rows.reduce((s, r) => s + Number(r.budgetApproved), 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">งบประมาณ</h1>
        <p className="text-muted-foreground">รายการโครงการที่ได้รับอนุมัติงบประมาณแล้ว</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="งบที่อนุมัติทั้งหมด" value={formatBaht(totalApproved)} />
        <Stat label="ใช้ไป" value={formatBaht(totalSpent)} />
        <Stat label="คงเหลือ" value={formatBaht(totalApproved - totalSpent)} />
      </div>

      <Card>
        <CardHeader><CardTitle>งบประมาณรายโครงการ</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-left">
                <th className="p-3">รหัส</th>
                <th className="p-3">โครงการ</th>
                <th className="p-3">ฝ่าย</th>
                <th className="p-3 text-right">งบอนุมัติ</th>
                <th className="p-3 text-right">ใช้ไป</th>
                <th className="p-3 text-right">คงเหลือ</th>
                {showRecordCol && <th className="p-3">บันทึกเบิกจ่าย</th>}
                {role === "SUPER_ADMIN" && <th className="p-3 text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6 + (showRecordCol ? 1 : 0) + (role === "SUPER_ADMIN" ? 1 : 0)}
                    className="p-6 text-center text-muted-foreground"
                  >
                    ยังไม่มีโครงการที่อนุมัติ
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-mono text-xs">{r.projectCode}</td>
                  <td className="p-3">{r.projectName}</td>
                  <td className="p-3">{r.department?.name ?? "-"}</td>
                  <td className="p-3 text-right">{formatBaht(Number(r.budgetApproved))}</td>
                  <td className="p-3 text-right">{formatBaht(r.spent)}</td>
                  <td className="p-3 text-right">{formatBaht(r.remaining)}</td>
                  {showRecordCol && (
                    <td className="p-3">
                      {canRecord(r) ? (
                        <BudgetEntry projectId={r.id} max={r.remaining} />
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
                  {role === "SUPER_ADMIN" && (
                    <td className="p-3 text-center">
                      <BudgetDeleteButton
                        projectId={r.id}
                        projectName={r.projectName}
                        projectCode={r.projectCode}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </CardContent></Card>
  );
}
