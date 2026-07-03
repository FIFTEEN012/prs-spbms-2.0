import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getServerSession } from "next-auth";
import { getProjectList } from "@/lib/project-list-service";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/project-list-service", () => ({
  getProjectList: vi.fn(),
}));

describe("Projects GET API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not logged in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/projects"));

    expect(res.status).toBe(401);
  });

  it("returns the paginated project list", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "teacher-1", role: "TEACHER", departmentId: "dept-1" },
    } as any);
    vi.mocked(getProjectList).mockResolvedValue({
      data: [{ id: "project-1" }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      filters: {
        q: "math",
        status: "",
        departmentId: "",
        sortBy: "createdAt",
        sortDir: "desc",
        page: "1",
        limit: "10",
      },
    } as any);

    const res = await GET(new Request("http://localhost/api/projects?q=math"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(getProjectList).toHaveBeenCalled();
    expect(data.filters.q).toBe("math");
  });
});
