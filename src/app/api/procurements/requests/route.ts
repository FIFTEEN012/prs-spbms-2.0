import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getPurchaseRequestList } from "@/lib/purchase-request-list-service";
import { getPurchaseItemCapacityError } from "@/lib/procurement-print";
import { validateBorrowingBudget } from "./budget-validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  const body = await req.json();
  const {
    projectId,
    activityId,
    documentNo,
    documentDate,
    subject,
    category,
    categoryDetails,
    fundSourceId,
    budgetWalletId,
    actionPlanPage,
    isNotInPlan,
    necessityDetails,
    committee,
    items,
    borrowedFrom,
  } = body;

  if (
    !projectId ||
    !subject?.trim() ||
    !items ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json(
      { error: "ข้อมูลไม่ถูกต้องหรือขาดฟิลด์สำคัญ" },
      { status: 400 },
    );
  }

  const capacityError = getPurchaseItemCapacityError(items.length);
  if (capacityError) {
    return NextResponse.json({ error: capacityError }, { status: 400 });
  }

  for (const item of items) {
    if (
      !item.itemName?.trim() ||
      !item.quantity ||
      Number(item.quantity) <= 0 ||
      !item.unitPrice ||
      Number(item.unitPrice) <= 0
    ) {
      return NextResponse.json(
        { error: "ข้อมูลรายการพัสดุไม่ถูกต้อง" },
        { status: 400 },
      );
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project)
    return NextResponse.json({ error: "ไม่พบโครงการ" }, { status: 404 });

  const role = session.user.role;
  const isDeptStaff =
    session.user.departmentId &&
    session.user.departmentId === project.departmentId &&
    (role === "TEACHER" || role === "DEPT_HEAD");

  const hasProcureAccess =
    can(role, "procurement.record") || role === "SUPER_ADMIN" || isDeptStaff;
  if (!hasProcureAccess) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์บันทึกคำขอนี้" },
      { status: 403 },
    );
  }

  const requestedAmount = items.reduce((sum, item) => {
    return sum + Number(item.quantity) * Number(item.unitPrice);
  }, 0);

  let allocatedBudget = Number(project.budgetApproved);
  let previousBalance = allocatedBudget;
  let remainingBalance = previousBalance - requestedAmount;

  if (activityId) {
    const budgetValidation = await validateBorrowingBudget({
      db: prisma,
      projectId,
      activityId,
      requestedAmount,
      borrowedFrom,
    });

    if (!budgetValidation.ok) {
      return NextResponse.json(
        { error: budgetValidation.error },
        { status: budgetValidation.status },
      );
    }

    let originalAllocated = Number(budgetValidation.mainActivity.budget);
    if (budgetWalletId) {
      const actWithWallet = await prisma.projectActivity.findUnique({
        where: { id: activityId },
        include: { fundingAllocations: true },
      });
      const walletFunding = actWithWallet?.fundingAllocations.find(
        (funding: any) => funding.walletId === budgetWalletId,
      );
      if (walletFunding) {
        originalAllocated = Number(
          walletFunding.approvedAmount ?? walletFunding.requestedAmount,
        );
      }
    }

    allocatedBudget = originalAllocated;
    previousBalance = budgetValidation.mainRemaining;
    remainingBalance =
      budgetValidation.mainRemaining -
      requestedAmount +
      budgetValidation.totalBorrowedAmount;
  }

  try {
    const request = await prisma.purchaseRequest.create({
      data: {
        projectId,
        activityId: activityId || null,
        documentNo: documentNo?.trim() || null,
        documentDate: documentDate ? new Date(documentDate) : new Date(),
        subject: subject.trim(),
        category: category || "SUPPLIES",
        categoryDetails: categoryDetails?.trim() || null,
        fundSourceId: fundSourceId || project.fundSourceId,
        budgetWalletId: budgetWalletId || null,
        actionPlanPage: actionPlanPage?.trim() || null,
        isNotInPlan: !!isNotInPlan,
        necessityDetails: necessityDetails?.trim() || null,
        committee: committee || [],
        borrowedFrom: borrowedFrom || [],
        status: "PENDING",
        allocatedBudget,
        previousBalance,
        requestedAmount,
        remainingBalance,
        createdById: session.user.id,
        items: {
          create: items.map((item: any) => ({
            projectId,
            itemName: item.itemName.trim(),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.quantity) * Number(item.unitPrice),
            status: "REQUESTED",
            remarks: item.remarks?.trim() || null,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PURCHASE_REQUEST_CREATE",
        entityName: "PurchaseRequest",
        entityId: request.id,
      },
    });

    return NextResponse.json(request);
  } catch (error: any) {
    console.error("Failed to create PurchaseRequest:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  try {
    const projectId = searchParams.get("projectId");
    if (projectId) {
      const requests = await prisma.purchaseRequest.findMany({
        where: { projectId },
        include: {
          project: true,
          activity: true,
          createdBy: {
            select: { fullName: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(requests);
    }

    const result = await getPurchaseRequestList(searchParams, {
      role: session.user.role,
    });
    return NextResponse.json(result);
  } catch (_error) {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 },
    );
  }
}
