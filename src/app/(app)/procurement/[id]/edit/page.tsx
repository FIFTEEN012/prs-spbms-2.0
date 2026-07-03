import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { EditPurchaseRequestForm } from "./_form";

export default async function EditProcurementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  // Only SUPER_ADMIN can edit any request
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/procurement");
  }

  const { id } = await params;
  if (!id) {
    notFound();
  }

  // Fetch the purchase request
  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });

  if (!request) {
    notFound();
  }

  // Fetch project details
  const project = await prisma.project.findUnique({
    where: { id: request.projectId },
    include: {
      activities: { include: { fundingAllocations: { include: { wallet: true } } } },
      fundSource: true,
    },
  });

  if (!project) {
    redirect("/procurement");
  }

  // Fetch active users for committee selection
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
  });

  // Fetch all fund sources
  const fundSources = await prisma.fundSource.findMany({
    orderBy: { name: "asc" },
  });

  const wallets = await prisma.budgetWallet.findMany({
    where: { budgetPlan: { status: "LOCKED", academicYearId: project.academicYearId } },
    orderBy: { name: "asc" },
  }).catch(() => []);

  // Fetch existing purchase requests (excluding rejected and the CURRENT request) to calculate remaining budget for each activity
  const purchaseRequests = await prisma.purchaseRequest.findMany({
    where: {
      projectId: project.id,
      id: { not: id }, // Exclude current request
      status: { not: "REJECTED" },
    },
    select: {
      activityId: true,
      requestedAmount: true,
      borrowedFrom: true,
    },
  });

  // Calculate net remaining budget for each activity
  const serializedActivities = project.activities.map((act) => {
    const budget = Number(act.budget);
    let netSpent = 0;

    for (const req of purchaseRequests) {
      const reqAmount = Number(req.requestedAmount);
      const borrowedList = Array.isArray(req.borrowedFrom)
        ? (req.borrowedFrom as any[])
        : JSON.parse((req.borrowedFrom as string) || "[]");

      const totalBorrowed = borrowedList.reduce((sum: number, b: any) => sum + Number(b.amount), 0);

      if (req.activityId === act.id) {
        netSpent += (reqAmount - totalBorrowed);
      }

      const borrowFromThis = borrowedList.find((b: any) => b.activityId === act.id);
      if (borrowFromThis) {
        netSpent += Number(borrowFromThis.amount);
      }
    }

    return {
      id: act.id,
      name: act.name,
      budget,
      remaining: budget - netSpent,
      walletIds: act.fundingAllocations.map((funding) => funding.walletId),
    };
  });

  // ---- Fetch other approved projects for cross-project borrowing ----
  const otherProjectsRaw = await prisma.project.findMany({
    where: {
      id: { not: project.id },
      status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] },
    },
    include: {
      activities: true,
    },
    orderBy: { projectCode: "asc" },
  });

  const otherProjectIds = otherProjectsRaw.map((p) => p.id);
  const otherPurchaseRequests = otherProjectIds.length > 0
    ? await prisma.purchaseRequest.findMany({
        where: {
          projectId: { in: otherProjectIds },
          status: { not: "REJECTED" },
        },
        select: {
          projectId: true,
          activityId: true,
          requestedAmount: true,
          borrowedFrom: true,
        },
      })
    : [];

  const otherProjects = otherProjectsRaw
    .map((p) => {
      const projectRequests = otherPurchaseRequests.filter((r) => r.projectId === p.id);

      const activities = p.activities
        .map((act) => {
          const budget = Number(act.budget);
          let netSpent = 0;

          for (const req of projectRequests) {
            const reqAmount = Number(req.requestedAmount);
            const borrowedList = Array.isArray(req.borrowedFrom)
              ? (req.borrowedFrom as any[])
              : JSON.parse((req.borrowedFrom as string) || "[]");

            const totalBorrowed = borrowedList.reduce((sum: number, b: any) => sum + Number(b.amount), 0);

            if (req.activityId === act.id) {
              netSpent += reqAmount - totalBorrowed;
            }

            const borrowFromThis = borrowedList.find((b: any) => b.activityId === act.id);
            if (borrowFromThis) {
              netSpent += Number(borrowFromThis.amount);
            }
          }

          return { id: act.id, name: act.name, budget, remaining: budget - netSpent };
        })
        .filter((act) => act.remaining > 0);

      return {
        id: p.id,
        projectName: p.projectName,
        projectCode: p.projectCode,
        activities,
      };
    })
    .filter((p) => p.activities.length > 0);

  // Serialize Decimal objects to plain numbers/strings for Client Component
  const serializedProject = {
    id: project.id,
    projectName: project.projectName,
    projectCode: project.projectCode,
    budgetApproved: Number(project.budgetApproved),
    fundSourceId: project.fundSourceId,
    activities: serializedActivities,
  };

  const serializedFundSources = fundSources.map((fs) => ({
    id: fs.id,
    name: fs.name,
  }));

  const serializedUsers = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    role: u.role,
  }));

  // Map Decimal items to serializable numbers/strings
  const serializedRequest = {
    id: request.id,
    projectId: request.projectId,
    activityId: request.activityId ?? "",
    documentNo: request.documentNo ?? "",
    documentDate: request.documentDate ? new Date(request.documentDate).toISOString().split("T")[0] : "",
    subject: request.subject,
    category: request.category,
    categoryDetails: request.categoryDetails ?? "",
    fundSourceId: request.fundSourceId ?? "",
    budgetWalletId: request.budgetWalletId ?? "",
    actionPlanPage: request.actionPlanPage ?? "",
    isNotInPlan: request.isNotInPlan,
    necessityDetails: request.necessityDetails ?? "",
    committee: request.committee,
    borrowedFrom: request.borrowedFrom,
    items: request.items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      quantity: String(item.quantity),
      unitPrice: String(Number(item.unitPrice)),
      remarks: item.remarks ?? "",
    })),
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold">แก้ไขใบขออนุมัติจัดซื้อจัดจ้าง</h1>
        <p className="text-muted-foreground">
          แก้ไขรายละเอียดบันทึกข้อความขอซื้อ/จ้าง สำหรับโครงการ: <span className="font-semibold text-primary">{project.projectName}</span>
        </p>
      </div>

      <EditPurchaseRequestForm
        project={serializedProject}
        users={serializedUsers}
        fundSources={serializedFundSources}
        wallets={wallets.map((wallet) => ({ id: wallet.id, name: wallet.name }))}
        initialRequest={serializedRequest}
        otherProjects={otherProjects}
      />
    </div>
  );
}
