import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

vi.mock("server-only", () => ({}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    budgetPlan: {
      findFirst: vi.fn(),
    },
  },
}));

function session(role = "FINANCE", departmentId: string | null = null) {
  return {
    user: { id: "user-1", role, departmentId },
  } as any;
}

function lockedPlan(wallets: any[]) {
  return {
    id: "plan-1",
    name: "แผนจัดสรรงบ 2569",
    status: "LOCKED",
    academicYear: { yearName: "2569" },
    fiscalYear: { yearName: "2569" },
    wallets,
  };
}

describe("Budget wallet summary API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not signed in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "กรุณาเข้าสู่ระบบ" });
  });

  it("returns an empty summary when no locked plan exists", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session());
    vi.mocked(prisma.budgetPlan.findFirst).mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.plan).toBeNull();
    expect(body.wallets).toEqual([]);
  });

  it("calculates wallet balances from ledger entries", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session("FINANCE"));
    vi.mocked(prisma.budgetPlan.findFirst).mockResolvedValue(
      lockedPlan([
        {
          id: "wallet-1",
          code: "CENTRAL",
          name: "งบกลาง",
          percentage: 20,
          spendMode: "OPERATING",
          departmentId: null,
          ledgerEntries: [
            { entryType: "ALLOCATION", amount: 100000 },
            { entryType: "COMMITMENT", amount: 25000 },
            { entryType: "DISBURSEMENT", amount: 10000 },
            { entryType: "REFUND", amount: 3000 },
          ],
        },
      ]) as any,
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.wallets).toHaveLength(1);
    expect(body.wallets[0].balance).toMatchObject({
      allocated: 100000,
      committed: 25000,
      netDisbursed: 7000,
      availableBalance: 68000,
    });
  });

  it("filters wallets using the existing budget wallet authorization rule", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session("TEACHER", "academic"));
    vi.mocked(prisma.budgetPlan.findFirst).mockResolvedValue(
      lockedPlan([
        {
          id: "wallet-1",
          code: "ACADEMIC",
          name: "กลุ่มบริหารวิชาการ",
          percentage: 20,
          spendMode: "PROJECT_ACTIVITY",
          departmentId: "academic",
          ledgerEntries: [{ entryType: "ALLOCATION", amount: 50000 }],
        },
        {
          id: "wallet-2",
          code: "GENERAL",
          name: "กลุ่มบริหารทั่วไป",
          percentage: 17.5,
          spendMode: "PROJECT_ACTIVITY",
          departmentId: "general",
          ledgerEntries: [{ entryType: "ALLOCATION", amount: 40000 }],
        },
      ]) as any,
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.wallets.map((wallet: { code: string }) => wallet.code)).toEqual(["ACADEMIC"]);
  });
});
