import { vi, describe, it, expect, beforeEach } from "vitest";
import { PUT, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    purchaseRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    projectActivity: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    procurement: {
      deleteMany: vi.fn(),
    },
    budgetTransaction: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    walletLedgerEntry: {
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation((cb) => cb(mockPrisma));
  return { prisma: mockPrisma };
});

describe("PurchaseRequest [id] API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DELETE handler", () => {
    it("returns 401 if user is not logged in", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await DELETE(req, { params });

      expect(res.status).toBe(401);
    });

    it("returns 403 if user is not SUPER_ADMIN", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "TEACHER" },
      });

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await DELETE(req, { params });

      expect(res.status).toBe(403);
    });

    it("deletes a pending request if user is SUPER_ADMIN", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "admin-1", role: "SUPER_ADMIN" },
      });
      vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
        id: "request-1",
        projectId: "project-1",
        status: "PENDING",
        directorApprovedAt: null,
      } as any);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await DELETE(req, { params });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(prisma.budgetTransaction.findFirst).not.toHaveBeenCalled();
      expect(prisma.walletLedgerEntry.createMany).not.toHaveBeenCalled();
      expect(prisma.procurement.deleteMany).toHaveBeenCalledWith({
        where: { purchaseRequestId: "request-1" },
      });
      expect(prisma.purchaseRequest.delete).toHaveBeenCalledWith({
        where: { id: "request-1" },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: "admin-1",
          action: "PURCHASE_REQUEST_DELETE",
          entityName: "PurchaseRequest",
          entityId: "request-1",
        },
      });
    });

    it("deletes an approved request and removes its posted expense transaction", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "admin-1", role: "SUPER_ADMIN" },
      });
      vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
        id: "request-1",
        projectId: "project-1",
        subject: "Approved purchase",
        requestedAmount: 1000,
        status: "APPROVED",
        directorApprovedAt: new Date("2026-06-22T09:01:15.315Z"),
        budgetWallet: null,
      } as any);
      vi.mocked(prisma.budgetTransaction.findFirst).mockResolvedValue({
        id: "txn-1",
      } as any);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await DELETE(req, { params });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(prisma.budgetTransaction.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              projectId: "project-1",
              transactionType: "EXPENSE",
              amount: 1000,
              description: "จัดซื้อจัดจ้างตามใบขออนุมัติ: Approved purchase",
            },
            {
              description: {
                contains: "[PR:request-1]",
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      expect(prisma.budgetTransaction.delete).toHaveBeenCalledWith({
        where: { id: "txn-1" },
      });
      expect(prisma.procurement.deleteMany).toHaveBeenCalledWith({
        where: { purchaseRequestId: "request-1" },
      });
      expect(prisma.purchaseRequest.delete).toHaveBeenCalledWith({
        where: { id: "request-1" },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: "admin-1",
          action: "PURCHASE_REQUEST_DELETE_APPROVED_ROLLBACK",
          entityName: "PurchaseRequest",
          entityId: "request-1",
          metadata: {
            status: "APPROVED",
            budgetTransactionId: "txn-1",
            reversedLedgerEntryIds: [],
          },
        },
      });
    });

    it("creates wallet ledger reversals before deleting an approved request", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "admin-1", role: "SUPER_ADMIN" },
      });
      vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
        id: "request-1",
        projectId: "project-1",
        subject: "Approved purchase",
        requestedAmount: 1000,
        status: "APPROVED",
        directorApprovedAt: new Date("2026-06-22T09:01:15.315Z"),
        budgetWallet: {
          id: "wallet-1",
          ledgerEntries: [
            {
              id: "ledger-release",
              entryType: "COMMITMENT_RELEASE",
              amount: 1000,
              description: "Approved purchase",
              reversals: [],
            },
            {
              id: "ledger-disbursement",
              entryType: "DISBURSEMENT",
              amount: 1000,
              description: "Approved purchase",
              reversals: [],
            },
          ],
        },
      } as any);
      vi.mocked(prisma.budgetTransaction.findFirst).mockResolvedValue({
        id: "txn-1",
      } as any);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await DELETE(req, { params });

      expect(res.status).toBe(200);
      expect(prisma.walletLedgerEntry.createMany).toHaveBeenCalledWith({
        data: [
          {
            walletId: "wallet-1",
            entryType: "COMMITMENT",
            amount: 1000,
            description: "Rollback deletion: Approved purchase",
            referenceType: "REVERSAL",
            referenceId: "request-1:ledger-release",
            reversalOfId: "ledger-release",
            postedById: "admin-1",
          },
          {
            walletId: "wallet-1",
            entryType: "ADJUSTMENT_INCREASE",
            amount: 1000,
            description: "Rollback deletion: Approved purchase",
            referenceType: "REVERSAL",
            referenceId: "request-1:ledger-disbursement",
            reversalOfId: "ledger-disbursement",
            postedById: "admin-1",
          },
        ],
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: "admin-1",
          action: "PURCHASE_REQUEST_DELETE_APPROVED_ROLLBACK",
          entityName: "PurchaseRequest",
          entityId: "request-1",
          metadata: {
            status: "APPROVED",
            budgetTransactionId: "txn-1",
            reversedLedgerEntryIds: ["ledger-release", "ledger-disbursement"],
          },
        },
      });
    });

    it("does not create duplicate wallet reversals for entries already reversed", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "admin-1", role: "SUPER_ADMIN" },
      });
      vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
        id: "request-1",
        projectId: "project-1",
        subject: "Approved purchase",
        requestedAmount: 1000,
        status: "APPROVED",
        directorApprovedAt: new Date("2026-06-22T09:01:15.315Z"),
        budgetWallet: {
          id: "wallet-1",
          ledgerEntries: [
            {
              id: "ledger-release",
              entryType: "COMMITMENT_RELEASE",
              amount: 1000,
              description: "Approved purchase",
              reversals: [{ id: "existing-reversal" }],
            },
          ],
        },
      } as any);
      vi.mocked(prisma.budgetTransaction.findFirst).mockResolvedValue(null);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await DELETE(req, { params });

      expect(res.status).toBe(200);
      expect(prisma.walletLedgerEntry.createMany).not.toHaveBeenCalled();
    });
  });

  describe("PUT handler", () => {
    const validBody = {
      projectId: "project-1",
      activityId: "activity-1",
      documentNo: "PR-1234",
      documentDate: "2026-06-22",
      subject: "Test Purchase Request",
      category: "SUPPLIES",
      categoryDetails: "",
      fundSourceId: "fund-1",
      budgetWalletId: "wallet-1",
      actionPlanPage: "12",
      isNotInPlan: false,
      necessityDetails: "",
      committee: [{ name: "Comm 1", role: "CHAIRMAN", id: "user-comm" }],
      borrowedFrom: [],
      items: [
        { itemName: "Item 1", quantity: 10, unitPrice: 100, remarks: "" },
      ],
    };

    it("returns 401 if user is not logged in", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "PUT",
        body: JSON.stringify(validBody),
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await PUT(req, { params });
      expect(res.status).toBe(401);
    });

    it("returns 403 if user is not SUPER_ADMIN", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "TEACHER" },
      });

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "PUT",
        body: JSON.stringify(validBody),
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await PUT(req, { params });
      expect(res.status).toBe(403);
    });

    it("updates request when user is SUPER_ADMIN and budget is sufficient", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "admin-1", role: "SUPER_ADMIN" },
      });
      vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
        id: "request-1",
        projectId: "project-1",
      } as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: "project-1",
        budgetApproved: 50000,
        fundSourceId: "fund-1",
      } as any);
      vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
        { id: "activity-1", name: "Activity 1", budget: 10000, projectId: "project-1" },
      ] as any);
      vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.purchaseRequest.update).mockResolvedValue({
        id: "request-1",
        subject: "Test Purchase Request",
      } as any);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "PUT",
        body: JSON.stringify(validBody),
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await PUT(req, { params });

      expect(res.status).toBe(200);
      expect(prisma.procurement.deleteMany).toHaveBeenCalledWith({
        where: { purchaseRequestId: "request-1" },
      });
      expect(prisma.purchaseRequest.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "admin-1",
          action: "PURCHASE_REQUEST_ADMIN_CORRECTION",
          entityName: "PurchaseRequest",
          entityId: "request-1",
        }),
      });
    });

    it("posts a commitment delta when a BUDGET_REVIEWED request amount changes", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "admin-1", role: "SUPER_ADMIN" },
      });
      vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
        id: "request-1",
        projectId: "project-1",
        status: "BUDGET_REVIEWED",
        requestedAmount: 800,
        budgetWalletId: "wallet-1",
      } as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: "project-1",
        projectName: "Project 1",
        budgetApproved: 50000,
        fundSourceId: "fund-1",
      } as any);
      vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
        { id: "activity-1", name: "Activity 1", budget: 10000, projectId: "project-1" },
      ] as any);
      vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.purchaseRequest.update).mockResolvedValue({ id: "request-1" } as any);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "PUT",
        body: JSON.stringify(validBody),
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await PUT(req, { params });

      expect(res.status).toBe(200);
      expect(prisma.walletLedgerEntry.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            walletId: "wallet-1",
            entryType: "COMMITMENT",
            amount: 200,
            referenceType: "PURCHASE_REQUEST",
            postedById: "admin-1",
          }),
        ],
      });
    });

    it("recreates budget transactions and posts a refund delta when an APPROVED request amount decreases", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "admin-1", role: "SUPER_ADMIN" },
      });
      vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
        id: "request-1",
        projectId: "project-1",
        status: "APPROVED",
        requestedAmount: 1000,
        budgetWalletId: "wallet-1",
      } as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: "project-1",
        projectName: "Project 1",
        budgetApproved: 50000,
        fundSourceId: "fund-1",
      } as any);
      vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
        { id: "activity-1", name: "Activity 1", budget: 10000, projectId: "project-1" },
      ] as any);
      vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.purchaseRequest.update).mockResolvedValue({ id: "request-1" } as any);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "PUT",
        body: JSON.stringify({
          ...validBody,
          items: [{ itemName: "Item 1", quantity: 5, unitPrice: 100, remarks: "" }],
        }),
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await PUT(req, { params });

      expect(res.status).toBe(200);
      expect(prisma.budgetTransaction.deleteMany).toHaveBeenCalledWith({
        where: { description: { contains: "[PR:request-1]" } },
      });
      expect(prisma.budgetTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "project-1",
          transactionType: "EXPENSE",
          amount: 500,
        }),
      });
      expect(prisma.walletLedgerEntry.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            walletId: "wallet-1",
            entryType: "REFUND",
            amount: 500,
          }),
        ],
      });
    });

    it("fails validation if activity budget is insufficient and no borrowing is specified", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "admin-1", role: "SUPER_ADMIN" },
      });
      vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
        id: "request-1",
        projectId: "project-1",
      } as any);
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: "project-1",
        budgetApproved: 50000,
        fundSourceId: "fund-1",
      } as any);
      vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
        { id: "activity-1", name: "Activity 1", budget: 500, projectId: "project-1" },
      ] as any);
      vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([]);

      const req = new Request("http://localhost/api/procurements/requests/1", {
        method: "PUT",
        body: JSON.stringify(validBody),
      });
      const params = Promise.resolve({ id: "request-1" });

      const res = await PUT(req, { params });

      expect(res.status).toBe(400);
    });
  });
});

describe("PurchaseRequest update cross-project borrowing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a request when the activity deficit is covered by a cross-project borrow", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: "SUPER_ADMIN" },
    });
    vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
      id: "request-1",
      projectId: "project-1",
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      budgetApproved: 50000,
      fundSourceId: "fund-1",
    } as any);
    vi.mocked(prisma.projectActivity.findMany).mockImplementation((async (args: any) => {
      if (Array.isArray(args?.where?.projectId?.in)) {
        return [
          { id: "activity-1", name: "Activity 1", budget: 500, projectId: "project-1" },
          { id: "activity-2", name: "Other Activity", budget: 1000, projectId: "project-2" },
        ] as any;
      }

      return [
        { id: "activity-1", name: "Activity 1", budget: 500, projectId: "project-1" },
      ] as any;
    }) as any);
    vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([]);
    vi.mocked(prisma.purchaseRequest.update).mockResolvedValue({
      id: "request-1",
      subject: "Test Purchase Request",
    } as any);

    const req = new Request("http://localhost/api/procurements/requests/1", {
      method: "PUT",
      body: JSON.stringify({
        projectId: "project-1",
        activityId: "activity-1",
        documentNo: "PR-1234",
        documentDate: "2026-06-22",
        subject: "Test Purchase Request",
        category: "SUPPLIES",
        categoryDetails: "",
        fundSourceId: "fund-1",
        budgetWalletId: "",
        actionPlanPage: "12",
        isNotInPlan: false,
        necessityDetails: "",
        committee: [{ name: "Comm 1", role: "CHAIRMAN", id: "user-comm" }],
        items: [{ itemName: "Item 1", quantity: 10, unitPrice: 100, remarks: "" }],
        borrowedFrom: [
          {
            projectId: "project-2",
            projectName: "Other Project",
            activityId: "activity-2",
            activityName: "Other Activity",
            amount: 500,
          },
        ],
      }),
    });
    const params = Promise.resolve({ id: "request-1" });

    const res = await PUT(req, { params });

    expect(res.status).toBe(200);
    expect(prisma.purchaseRequest.update).toHaveBeenCalled();
  });
});
