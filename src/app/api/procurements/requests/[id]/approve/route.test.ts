import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { calculateWalletBalance } from "@/lib/budget-wallets";
import { PUT } from "./route";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/budget-wallets", () => ({
  calculateWalletBalance: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    purchaseRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    procurement: {
      updateMany: vi.fn(),
    },
    budgetTransaction: {
      create: vi.fn(),
    },
    walletLedgerEntry: {
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  mockPrisma.$transaction.mockImplementation(
    (cb: (db: typeof mockPrisma) => unknown) => cb(mockPrisma),
  );

  return { prisma: mockPrisma };
});

describe("PurchaseRequest approve API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "executive-1", role: "EXECUTIVE" },
    } as any);
    vi.mocked(calculateWalletBalance).mockReturnValue({
      available: 0,
      allocated: 0,
      committed: 10_000,
      spent: 0,
      remaining: 0,
    } as any);
  });

  it("posts an expense once when director approves from BUDGET_REVIEWED", async () => {
    vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
      id: "request-1",
      projectId: "project-1",
      subject: "Test purchase request",
      requestedAmount: 1000,
      status: "BUDGET_REVIEWED",
      budgetWallet: null,
    } as any);
    vi.mocked(prisma.budgetTransaction.create).mockResolvedValue({
      id: "txn-1",
    } as any);
    vi.mocked(prisma.purchaseRequest.update).mockResolvedValue({
      id: "request-1",
      status: "APPROVED",
      items: [],
    } as any);

    const req = new Request(
      "http://localhost/api/procurements/requests/request-1/approve",
      {
        method: "PUT",
        body: JSON.stringify({
          step: "director",
          opinion: "",
          isApproved: true,
        }),
      },
    );
    const params = Promise.resolve({ id: "request-1" });

    const res = await PUT(req, { params });
    expect(res.status).toBe(200);
    expect(prisma.procurement.updateMany).toHaveBeenCalledWith({
      where: { purchaseRequestId: "request-1" },
      data: { status: "RECEIVED" },
    });
    expect(prisma.budgetTransaction.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        transactionType: "EXPENSE",
        amount: 1000,
        description:
          "จัดซื้อจัดจ้างตามใบขออนุมัติ: Test purchase request [PR:request-1]",
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "executive-1",
        action: "PURCHASE_REQUEST_POST_EXPENSE",
        entityName: "BudgetTransaction",
        entityId: "txn-1",
        metadata: {
          purchaseRequestId: "request-1",
          projectId: "project-1",
          transactionType: "EXPENSE",
          approvalStep: "director",
          transactionIds: ["txn-1"],
        },
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "executive-1",
        action: "PURCHASE_REQUEST_APPROVE_DIRECTOR",
        entityName: "PurchaseRequest",
        entityId: "request-1",
        metadata: { opinion: "", isApproved: true, newStatus: "APPROVED" },
      },
    });
  });

  it("returns 409 and does not post another expense when director approval is retried", async () => {
    vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
      id: "request-1",
      projectId: "project-1",
      subject: "Test purchase request",
      requestedAmount: 1000,
      status: "APPROVED",
      budgetWallet: null,
    } as any);

    const req = new Request(
      "http://localhost/api/procurements/requests/request-1/approve",
      {
        method: "PUT",
        body: JSON.stringify({
          step: "director",
          opinion: "",
          isApproved: true,
        }),
      },
    );
    const params = Promise.resolve({ id: "request-1" });

    const res = await PUT(req, { params });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("สถานะใบขอถูกเปลี่ยนแล้ว");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.budgetTransaction.create).not.toHaveBeenCalled();
  });
});
