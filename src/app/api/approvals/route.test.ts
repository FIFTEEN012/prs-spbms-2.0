import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getServerSession } from "next-auth";
import { getApprovalQueue } from "@/lib/approval-list-service";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/approval-list-service", () => ({
  getApprovalQueue: vi.fn(),
}));

describe("Approvals collection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not logged in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/approvals"));

    expect(res.status).toBe(401);
  });

  it("returns the paginated approval queue", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "head-1", role: "DEPT_HEAD", departmentId: "dept-1" },
    } as any);
    vi.mocked(getApprovalQueue).mockResolvedValue({
      data: [{ id: "project-1" }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      filters: {
        q: "",
        status: "",
        departmentId: "",
        sortBy: "updatedAt",
        sortDir: "desc",
        page: "1",
        limit: "10",
      },
    } as any);

    const res = await GET(
      new Request("http://localhost/api/approvals?q=test&page=2"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(getApprovalQueue).toHaveBeenCalled();
    expect(data.total).toBe(1);
  });
});
