import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CreatePurchaseRequestForm } from "./_form";

export default async function NewProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string | string[] }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const query = await searchParams;
  const initialProjectId =
    typeof query.projectId === "string" && query.projectId.trim() !== ""
      ? query.projectId
      : null;

  // Fetch all approved projects
  const projects = await prisma.project.findMany({
    where: { status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] } },
    include: {
      activities: { include: { fundingAllocations: { include: { wallet: true } } } },
      fundSource: true,
      department: true,
    },
    orderBy: { projectCode: "asc" },
  });

  // Role-based filtering logic
  const role = session.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isProcurement = role === "PROCUREMENT";
  const isDeptStaff = role === "TEACHER" || role === "DEPT_HEAD";

  let availableProjects: typeof projects = [];

  if (isSuperAdmin || isProcurement) {
    availableProjects = projects;
  } else if (isDeptStaff && session.user.departmentId) {
    availableProjects = projects.filter(
      (p) => p.departmentId === session.user.departmentId
    );
  }

  // Fetch purchase requests to calculate spent amount per project
  const projectIds = availableProjects.map(p => p.id);
  const purchaseRequests = projectIds.length > 0 
    ? await prisma.purchaseRequest.findMany({
        where: {
          projectId: { in: projectIds },
          status: { not: "REJECTED" },
        },
        select: {
          projectId: true,
          requestedAmount: true,
        },
      })
    : [];

  const serializedProjects = availableProjects.map((project) => {
    const budgetApproved = Number(project.budgetApproved) || 0;
    
    // Sum requestedAmount for this project
    const spent = purchaseRequests
      .filter((pr) => pr.projectId === project.id)
      .reduce((sum, pr) => sum + Number(pr.requestedAmount), 0);
    
    const remaining = budgetApproved - spent;

    return {
      id: project.id,
      projectName: project.projectName,
      projectCode: project.projectCode,
      departmentName: project.department?.name || "",
      budgetApproved,
      spent,
      remaining,
    };
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <CreatePurchaseRequestForm
        availableProjects={serializedProjects}
        initialProjectId={initialProjectId}
        sessionRole={role}
      />
    </div>
  );
}
