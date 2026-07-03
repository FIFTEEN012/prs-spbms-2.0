import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPurchaseRequestList } from "@/lib/purchase-request-list-service";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/purchase-request-list-service", () => ({
  getPurchaseRequestList: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchaseRequest: {
      findMany: vi.fn(),
    },
  },
}));

describe("PurchaseRequest GET API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not logged in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/procurements/requests"),
    );

    expect(res.status).toBe(401);
  });

  it("returns the paginated list when no projectId filter is present", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
    } as any);
    vi.mocked(getPurchaseRequestList).mockResolvedValue({
      data: [{ id: "request-1" }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      filters: {
        q: "",
        status: "",
        month: "",
        dateFrom: "",
        dateTo: "",
        minAmount: "",
        maxAmount: "",
        sortBy: "createdAt",
        sortDir: "desc",
        page: "1",
        limit: "10",
      },
    } as any);

    const res = await GET(
      new Request("http://localhost/api/procurements/requests?q=paper"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(getPurchaseRequestList).toHaveBeenCalled();
    expect(data.total).toBe(1);
  });

  it("keeps the projectId shortcut behavior for detail pages", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
    } as any);
    vi.mocked(prisma.purchaseRequest.findMany).mockResolvedValue([
      { id: "request-1" },
    ] as any);

    const res = await GET(
      new Request(
        "http://localhost/api/procurements/requests?projectId=project-1",
      ),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prisma.purchaseRequest.findMany).toHaveBeenCalled();
    expect(data).toEqual([{ id: "request-1" }]);
  });
});
