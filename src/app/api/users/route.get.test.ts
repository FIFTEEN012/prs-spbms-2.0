import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getServerSession } from "next-auth";
import { getUserList } from "@/lib/user-list-service";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/user-list-service", () => ({
  getUserList: vi.fn(),
}));

describe("Users GET API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin users", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "teacher-1", role: "TEACHER" },
    } as any);

    const res = await GET(new Request("http://localhost/api/users"));

    expect(res.status).toBe(403);
  });

  it("returns the paginated user list for super admins", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: "SUPER_ADMIN" },
    } as any);
    vi.mocked(getUserList).mockResolvedValue({
      data: [{ id: "user-1" }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      filters: {
        q: "",
        role: "",
        isActive: "",
        departmentId: "",
        sortBy: "fullName",
        sortDir: "asc",
        page: "1",
        limit: "10",
      },
    } as any);

    const res = await GET(new Request("http://localhost/api/users"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(getUserList).toHaveBeenCalled();
    expect(data.totalPages).toBe(1);
  });
});
