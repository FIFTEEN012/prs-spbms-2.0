import { vi, describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  can: vi.fn(() => true),
}));

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    purchaseRequest: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    projectActivity: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe("PurchaseRequest collection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
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
    borrowedFrom: [],
    items: [{ itemName: "Item 1", quantity: 10, unitPrice: 100, remarks: "" }],
  };

  it("creates a request when the activity deficit is covered by a cross-project borrow", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN", departmentId: null },
    });

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      budgetApproved: 50000,
      fundSourceId: "fund-1",
      departmentId: "dept-1",
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
    vi.mocked(prisma.purchaseRequest.create).mockResolvedValue({
      id: "request-1",
      subject: "Test Purchase Request",
    } as any);

    const req = new Request("http://localhost/api/procurements/requests", {
      method: "POST",
      body: JSON.stringify({
        ...validBody,
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

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(prisma.purchaseRequest.create).toHaveBeenCalled();
  });

  it("creates a request when the activity deficit is covered by a same-project borrow", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN", departmentId: null },
    });

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      budgetApproved: 50000,
      fundSourceId: "fund-1",
      departmentId: "dept-1",
    } as any);
    vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
      { id: "activity-1", name: "Activity 1", budget: 500, projectId: "project-1" },
      { id: "activity-2", name: "Activity 2", budget: 1000, projectId: "project-1" },
    ] as any);
    vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([]);
    vi.mocked(prisma.purchaseRequest.create).mockResolvedValue({ id: "request-1" } as any);

    const req = new Request("http://localhost/api/procurements/requests", {
      method: "POST",
      body: JSON.stringify({
        ...validBody,
        borrowedFrom: [{ activityId: "activity-2", activityName: "Activity 2", amount: 500 }],
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(prisma.purchaseRequest.create).toHaveBeenCalled();
  });

  it("rejects a cross-project borrow when the source activity does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN", departmentId: null },
    });
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      budgetApproved: 50000,
      fundSourceId: "fund-1",
      departmentId: "dept-1",
    } as any);
    vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
      { id: "activity-1", name: "Activity 1", budget: 500, projectId: "project-1" },
    ] as any);
    vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([]);

    const req = new Request("http://localhost/api/procurements/requests", {
      method: "POST",
      body: JSON.stringify({
        ...validBody,
        borrowedFrom: [
          {
            projectId: "project-2",
            projectName: "Other Project",
            activityId: "missing-activity",
            activityName: "Missing Activity",
            amount: 500,
          },
        ],
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("ไม่พบกิจกรรมย่อยที่ต้องการยืม");
    expect(prisma.purchaseRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a cross-project borrow when the requested borrow exceeds source remaining budget", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN", departmentId: null },
    });
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      budgetApproved: 50000,
      fundSourceId: "fund-1",
      departmentId: "dept-1",
    } as any);
    vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
      { id: "activity-1", name: "Activity 1", budget: 500, projectId: "project-1" },
      { id: "activity-2", name: "Other Activity", budget: 300, projectId: "project-2" },
    ] as any);
    vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([]);

    const req = new Request("http://localhost/api/procurements/requests", {
      method: "POST",
      body: JSON.stringify({
        ...validBody,
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

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("มีงบไม่พอให้ยืม");
    expect(prisma.purchaseRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a borrow list that does not cover the full activity deficit", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN", departmentId: null },
    });
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      budgetApproved: 50000,
      fundSourceId: "fund-1",
      departmentId: "dept-1",
    } as any);
    vi.mocked(prisma.projectActivity.findMany).mockResolvedValue([
      { id: "activity-1", name: "Activity 1", budget: 500, projectId: "project-1" },
      { id: "activity-2", name: "Other Activity", budget: 1000, projectId: "project-2" },
    ] as any);
    vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([]);

    const req = new Request("http://localhost/api/procurements/requests", {
      method: "POST",
      body: JSON.stringify({
        ...validBody,
        borrowedFrom: [
          {
            projectId: "project-2",
            projectName: "Other Project",
            activityId: "activity-2",
            activityName: "Other Activity",
            amount: 100,
          },
        ],
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("ยังไม่เพียงพอ");
    expect(prisma.purchaseRequest.create).not.toHaveBeenCalled();
  });
});
