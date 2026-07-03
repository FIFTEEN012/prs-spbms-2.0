"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Option = { id: string; label: string };
type FundingAllocation = { key: string; walletId: string; amount: string };
type ActivityRow = {
  key: string;
  name: string;
  fundingAllocations: FundingAllocation[];
};

export function ProjectForm({
  academicYearId,
  strategies,
  departments,
  fundSources,
  users,
  wallets,
  initial,
}: {
  academicYearId: string;
  strategies: Option[];
  departments: Option[];
  fundSources: Option[];
  users: Option[];
  wallets: Option[];
  initial?: any;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>(
    () => initial?.activities ?? [],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    const url = initial ? `/api/projects/${initial.id}` : "/api/projects";
    const res = await fetch(url, {
      method: initial ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        academicYearId,
        activities: activities.map((activity) => ({
          name: activity.name,
          fundingAllocations: activity.fundingAllocations.map((funding) => ({
            walletId: funding.walletId,
            amount: Number(funding.amount || 0),
          })),
        })),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    const j = await res.json();
    router.push(`/projects/${j.id}`);
    router.refresh();
  }

  const addActivity = () => {
    setActivities((current) => [
      ...current,
      {
        key: newKey(),
        name: "",
        fundingAllocations: [{ key: newKey(), walletId: "", amount: "" }],
      },
    ]);
  };

  const updateActivity = (activityKey: string, updater: (activity: ActivityRow) => ActivityRow) => {
    setActivities((current) =>
      current.map((activity) =>
        activity.key === activityKey ? updater(activity) : activity,
      ),
    );
  };

  const addFundingAllocation = (activityKey: string) => {
    updateActivity(activityKey, (activity) => ({
      ...activity,
      fundingAllocations: [
        ...activity.fundingAllocations,
        { key: newKey(), walletId: "", amount: "" },
      ],
    }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-24 md:pb-0">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>ข้อมูลทั่วไป</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="รหัสโครงการ"
            name="projectCode"
            defaultValue={initial?.projectCode}
            required
          />
          <Field
            label="ชื่อโครงการ"
            name="projectName"
            defaultValue={initial?.projectName}
            required
          />
          <SelectField
            label="กลยุทธ์"
            name="strategyId"
            options={strategies}
            defaultValue={initial?.strategyId}
          />
          <SelectField
            label="ฝ่าย/กลุ่มงาน"
            name="departmentId"
            options={departments}
            defaultValue={initial?.departmentId}
          />
          <SelectField
            label="แหล่งงบประมาณ"
            name="fundSourceId"
            options={fundSources}
            defaultValue={initial?.fundSourceId}
          />
          <SelectField
            label="ผู้รับผิดชอบ"
            name="responsibleUserId"
            options={users}
            defaultValue={initial?.responsibleUserId}
          />
          <Field
            label="วันที่เริ่ม"
            name="startDate"
            type="date"
            defaultValue={initial?.startDate?.slice(0, 10)}
          />
          <Field
            label="วันที่สิ้นสุด"
            name="endDate"
            type="date"
            defaultValue={initial?.endDate?.slice(0, 10)}
          />
          <Field
            label="งบประมาณที่เสนอขอ (บาท)"
            name="budgetRequested"
            type="number"
            step="0.01"
            defaultValue={initial?.budgetRequested}
          />
        </CardContent>
      </Card>

      {wallets.length > 0 && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>กิจกรรมและกระเป๋างบประมาณ</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                หนึ่งกิจกรรมเลือกใช้หลายกระเป๋าได้ ยอดเสนอจะคำนวณจากรายการเหล่านี้
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={addActivity}
            >
              + เพิ่มกิจกรรม
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.map((activity, activityIndex) => (
              <div
                key={activity.key}
                className="space-y-3 rounded-2xl border border-border/70 bg-background p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder={`ชื่อกิจกรรมที่ ${activityIndex + 1}`}
                    value={activity.name}
                    onChange={(event) =>
                      updateActivity(activity.key, (current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      setActivities((current) =>
                        current.filter((item) => item.key !== activity.key),
                      )
                    }
                  >
                    ลบ
                  </Button>
                </div>
                <div className="space-y-2">
                  {activity.fundingAllocations.map((funding) => (
                    <div
                      key={funding.key}
                      className="grid gap-2 md:grid-cols-[1fr_180px_auto]"
                    >
                      <select
                        className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                        value={funding.walletId}
                        onChange={(event) =>
                          updateActivity(activity.key, (current) => ({
                            ...current,
                            fundingAllocations: current.fundingAllocations.map((line) =>
                              line.key === funding.key
                                ? { ...line, walletId: event.target.value }
                                : line,
                            ),
                          }))
                        }
                      >
                        <option value="">— เลือกกระเป๋า —</option>
                        {wallets.map((wallet) => (
                          <option key={wallet.id} value={wallet.id}>
                            {wallet.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="วงเงิน"
                        value={funding.amount}
                        onChange={(event) =>
                          updateActivity(activity.key, (current) => ({
                            ...current,
                            fundingAllocations: current.fundingAllocations.map((line) =>
                              line.key === funding.key
                                ? { ...line, amount: event.target.value }
                                : line,
                            ),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full md:w-auto"
                        onClick={() =>
                          updateActivity(activity.key, (current) => ({
                            ...current,
                            fundingAllocations: current.fundingAllocations.filter(
                              (line) => line.key !== funding.key,
                            ),
                          }))
                        }
                      >
                        ลบแหล่ง
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full justify-center rounded-xl border border-dashed border-border px-4 py-2 text-sm sm:w-auto"
                    onClick={() => addFundingAllocation(activity.key)}
                  >
                    + เพิ่มกระเป๋าในกิจกรรม
                  </Button>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                ยังไม่มีกิจกรรม กด “เพิ่มกิจกรรม” เพื่อกำหนดกระเป๋างบประมาณ
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>รายละเอียดโครงการ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            label="หลักการและเหตุผล"
            name="rationale"
            defaultValue={initial?.rationale}
          />
          <TextField
            label="วัตถุประสงค์"
            name="objectives"
            defaultValue={initial?.objectives}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="เป้าหมายเชิงปริมาณ"
              name="quantitativeTarget"
              defaultValue={initial?.quantitativeTarget}
            />
            <TextField
              label="เป้าหมายเชิงคุณภาพ"
              name="qualitativeTarget"
              defaultValue={initial?.qualitativeTarget}
            />
          </div>
          <TextField
            label="ตัวชี้วัด"
            name="indicators"
            defaultValue={initial?.indicators}
          />
          <TextField
            label="วิธีดำเนินงาน"
            name="method"
            defaultValue={initial?.method}
          />
          <TextField
            label="ผลที่คาดว่าจะได้รับ"
            name="expectedOutcome"
            defaultValue={initial?.expectedOutcome}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 md:flex-row md:justify-start">
          <Button type="submit" disabled={loading} className="w-full md:w-auto">
            {loading ? "กำลังบันทึก..." : initial ? "บันทึกการแก้ไข" : "บันทึก"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full md:w-auto"
            onClick={() => router.back()}
          >
            ยกเลิก
          </Button>
        </div>
      </div>
    </form>
  );
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function Field({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Input {...props} className="h-11 rounded-xl" />
    </div>
  );
}

function TextField({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Textarea rows={4} {...props} className="min-h-[120px] rounded-xl" />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">— เลือก —</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
