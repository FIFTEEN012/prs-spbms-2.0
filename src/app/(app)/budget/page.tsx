import { WalletLedgerEntryType, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BudgetClient } from "./_components/budget-client";
import { authOptions } from "@/lib/auth";
import {
  canManageBudgetPlan,
  canViewBudgetWallet,
  canViewProjectBudgetHistory,
  type Actor,
} from "@/lib/authorization";
import { summarizeProjectBudget } from "@/lib/budget-summary";
import { calculateWalletBalance } from "@/lib/budget-wallets";
import { prisma } from "@/lib/prisma";

const walletLedgerEntryTypes = Object.values(WalletLedgerEntryType);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositivePage(value: string | string[] | undefined) {
  const page = Number(firstParam(value) ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parseDateParam(value: string | string[] | undefined) {
  const raw = firstParam(value)?.trim() ?? "";
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : raw;
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const userId = session.user.id;
  const userDeptId = session.user.departmentId || null;
  const actor: Actor = { id: userId, role, departmentId: userDeptId };

  const resolvedSearchParams = await searchParams;
  const requestedYearId = firstParam(resolvedSearchParams.yearId)?.trim() || undefined;
  const page = parsePositivePage(resolvedSearchParams.page);
  const search = (firstParam(resolvedSearchParams.search)?.trim() || "").slice(0, 120);
  const requestedEntryType = firstParam(resolvedSearchParams.type)?.trim() || "";
  const entryType = walletLedgerEntryTypes.includes(requestedEntryType as WalletLedgerEntryType)
    ? (requestedEntryType as WalletLedgerEntryType)
    : undefined;
  const requestedWalletId = firstParam(resolvedSearchParams.walletId)?.trim() || undefined;
  const startDateStr = parseDateParam(resolvedSearchParams.startDate);
  const endDateStr = parseDateParam(resolvedSearchParams.endDate);

  const academicYears = await prisma.academicYear.findMany({
    orderBy: { yearName: "desc" },
    select: { id: true, yearName: true, isActive: true },
  });

  const activeYear = academicYears.find((year) => year.isActive);
  const yearExists = requestedYearId
    ? academicYears.some((year) => year.id === requestedYearId)
    : false;
  const selectedYearId =
    yearExists && requestedYearId
      ? requestedYearId
      : activeYear?.id || academicYears[0]?.id || "";

  const lockedPlan = selectedYearId
    ? await prisma.budgetPlan.findFirst({
        where: {
          status: "LOCKED",
          academicYearId: selectedYearId,
        },
        include: {
          academicYear: true,
          fiscalYear: true,
          wallets: {
            include: {
              ledgerEntries: {
                select: { entryType: true, amount: true },
              },
            },
            orderBy: { code: "asc" },
          },
        },
      })
    : null;

  const projects = selectedYearId
    ? await prisma.project.findMany({
        where: {
          academicYearId: selectedYearId,
          status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] },
        },
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          departmentId: true,
          budgetApproved: true,
          status: true,
          department: { select: { id: true, name: true } },
          responsibleUserId: true,
        },
        orderBy: { projectCode: "asc" },
      })
    : [];

  const projectIds = projects.map((project) => project.id);
  const projectTransactions = projectIds.length
    ? await prisma.budgetTransaction.findMany({
        where: { projectId: { in: projectIds } },
        select: { projectId: true, transactionType: true, amount: true },
      })
    : [];

  const transactionsByProject = new Map<
    string,
    Array<{ transactionType: "ALLOCATE" | "EXPENSE" | "REFUND" | "ADJUST"; amount: number }>
  >();

  for (const transaction of projectTransactions) {
    const items = transactionsByProject.get(transaction.projectId) || [];
    items.push({
      transactionType: transaction.transactionType,
      amount: Number(transaction.amount),
    });
    transactionsByProject.set(transaction.projectId, items);
  }

  const allProjects = projects.map((project) => {
    const budgetSummary = summarizeProjectBudget(
      project.budgetApproved,
      transactionsByProject.get(project.id) || [],
    );

    return {
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      departmentName: project.department?.name ?? "ไม่ระบุกลุ่มงาน",
      budgetApproved: Number(project.budgetApproved),
      spent: budgetSummary.netSpent,
      remaining: budgetSummary.remaining,
      spentPct:
        Number(project.budgetApproved) > 0
          ? (budgetSummary.netSpent / Number(project.budgetApproved)) * 100
          : 0,
      departmentId: project.departmentId,
      responsibleUserId: project.responsibleUserId,
      status: project.status,
    };
  });

  const visibleProjects = allProjects.filter((project) =>
    canViewProjectBudgetHistory(actor, project),
  );

  const allMappedWallets =
    lockedPlan?.wallets.map((wallet) => {
      const balance = calculateWalletBalance(
        wallet.ledgerEntries.map((entry) => ({
          entryType: entry.entryType as WalletLedgerEntryType,
          amount: entry.amount,
        })),
      );

      let status = "NORMAL";
      const availableRatio =
        balance.allocated > 0 ? balance.availableBalance / balance.allocated : 0;

      if (balance.availableBalance < 0) {
        status = "CRITICAL";
      } else if (availableRatio < 0.15) {
        status = "CRITICAL";
      } else if (availableRatio < 0.3) {
        status = "WARNING";
      }

      return {
        id: wallet.id,
        code: wallet.code,
        name: wallet.name,
        spendMode: wallet.spendMode,
        allocated: balance.allocated,
        committed: balance.committed,
        spent: balance.netDisbursed,
        available: balance.availableBalance,
        progress:
          balance.allocated > 0 ? (balance.netDisbursed / balance.allocated) * 100 : 0,
        status,
        departmentId: wallet.departmentId,
      };
    }) || [];

  const mappedWallets = allMappedWallets.filter((wallet) =>
    canViewBudgetWallet(actor, wallet),
  );

  const totalProjectApproved = visibleProjects.reduce(
    (sum, project) => sum + project.budgetApproved,
    0,
  );

  const totalBudget = mappedWallets.reduce((sum, wallet) => sum + wallet.allocated, 0);
  const committed = mappedWallets.reduce((sum, wallet) => sum + wallet.committed, 0);
  const spent = mappedWallets.reduce((sum, wallet) => sum + wallet.spent, 0);
  const available = mappedWallets.reduce((sum, wallet) => sum + wallet.available, 0);

  const topProjects = [...visibleProjects]
    .filter((project) => project.spent > 0)
    .sort((left, right) => right.spentPct - left.spentPct)
    .slice(0, 5);

  const departmentCodes = ["ACADEMIC", "BUDGET", "PERSONNEL", "GENERAL"];
  const mappedDepartments = departmentCodes.map((code) => {
    const wallet = mappedWallets.find((item) => item.code === code);
    return {
      name:
        code === "ACADEMIC"
          ? "กลุ่มบริหารวิชาการ"
          : code === "BUDGET"
            ? "กลุ่มบริหารงบประมาณ"
            : code === "PERSONNEL"
              ? "กลุ่มบริหารงานบุคคล"
              : "กลุ่มบริหารทั่วไป",
      code,
      allocated: wallet?.allocated || 0,
      committed: wallet?.committed || 0,
      spent: wallet?.spent || 0,
      available: wallet?.available || 0,
      progress: wallet?.progress || 0,
      status: wallet?.status || "NORMAL",
      departmentId: wallet?.departmentId || null,
    };
  });

  if (userDeptId) {
    mappedDepartments.sort((left, right) => {
      if (left.departmentId === userDeptId) return -1;
      if (right.departmentId === userDeptId) return 1;
      return 0;
    });
  }

  const warnings: Array<{
    id: string;
    type: "wallet" | "project" | "pr";
    name: string;
    reason: string;
    severity: "warning" | "danger" | "info";
    amount: number;
  }> = [];

  for (const wallet of mappedWallets) {
    if (wallet.available < 0) {
      warnings.push({
        id: `w-${wallet.id}`,
        type: "wallet",
        name: wallet.name,
        reason: `ยอดคงเหลือติดลบในกระเป๋างบ (${Math.abs(wallet.available).toLocaleString()} บาท)`,
        severity: "danger",
        amount: Math.abs(wallet.available),
      });
    } else if (wallet.allocated > 0 && wallet.available / wallet.allocated < 0.15) {
      warnings.push({
        id: `w-${wallet.id}`,
        type: "wallet",
        name: wallet.name,
        reason: `งบคงเหลือต่ำกว่า 15% (เหลือ ${wallet.available.toLocaleString()} บาท)`,
        severity: "warning",
        amount: wallet.available,
      });
    }
  }

  for (const project of visibleProjects) {
    if (project.spentPct >= 85) {
      warnings.push({
        id: `p-${project.id}`,
        type: "project",
        name: project.projectName,
        reason: `ใช้งบไปแล้ว ${project.spentPct.toFixed(1)}% และคงเหลือ ${project.remaining.toLocaleString()} บาท`,
        severity: "warning",
        amount: project.remaining,
      });
    }
  }

  const visibleProjectIds = visibleProjects.map((project) => project.id);
  const canViewPendingPurchaseRequests =
    role === "SUPER_ADMIN" ||
    role === "EXECUTIVE" ||
    role === "FINANCE" ||
    role === "PROCUREMENT";

  const pendingPurchaseRequests = selectedYearId && canViewPendingPurchaseRequests
    ? await prisma.purchaseRequest.findMany({
        where: {
          project: {
            academicYearId: selectedYearId,
            ...(visibleProjectIds.length ? { id: { in: visibleProjectIds } } : {}),
          },
          status: { notIn: ["APPROVED", "REJECTED"] },
        },
        select: {
          id: true,
          documentNo: true,
          subject: true,
          requestedAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const now = new Date();
  for (const request of pendingPurchaseRequests) {
    const diffDays = Math.floor((now.getTime() - request.createdAt.getTime()) / 86400000);
    if (diffDays >= 7) {
      warnings.push({
        id: `pr-${request.id}`,
        type: "pr",
        name: request.documentNo || request.subject,
        reason: `คำขอจัดซื้อค้างอนุมัตินาน ${diffDays} วัน (วงเงิน ${Number(request.requestedAmount).toLocaleString()} บาท)`,
        severity: "info",
        amount: Number(request.requestedAmount),
      });
    }
  }

  const visibleWalletIds = mappedWallets.map((wallet) => wallet.id);
  const walletId = requestedWalletId && visibleWalletIds.includes(requestedWalletId)
    ? requestedWalletId
    : undefined;

  const whereClause: Prisma.WalletLedgerEntryWhereInput = {
    wallet: {
      id: { in: visibleWalletIds },
      budgetPlan: {
        academicYearId: selectedYearId,
      },
    },
  };

  if (walletId) {
    whereClause.walletId = walletId;
  }
  if (entryType) {
    whereClause.entryType = entryType;
  }
  if (search) {
    whereClause.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { wallet: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (startDateStr || endDateStr) {
    whereClause.postedAt = {};
    if (startDateStr) {
      whereClause.postedAt.gte = new Date(startDateStr);
    }
    if (endDateStr) {
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      whereClause.postedAt.lte = end;
    }
  }

  const totalTransactions = selectedYearId && visibleWalletIds.length > 0
    ? await prisma.walletLedgerEntry.count({ where: whereClause })
    : 0;
  const totalTransactionPages = Math.max(1, Math.ceil(totalTransactions / 10));
  const currentTransactionPage = Math.min(page, totalTransactionPages);
  const ledgerEntries = selectedYearId && visibleWalletIds.length > 0
    ? await prisma.walletLedgerEntry.findMany({
        where: whereClause,
        include: {
          postedBy: { select: { fullName: true, role: true } },
          wallet: { select: { code: true, name: true } },
        },
        orderBy: { postedAt: "desc" },
        skip: (currentTransactionPage - 1) * 10,
        take: 10,
      })
    : [];

  const transactions = ledgerEntries.map((entry) => ({
    id: entry.id,
    postedAt: entry.postedAt.toISOString(),
    entryType: entry.entryType,
    description: entry.description,
    amount: Number(entry.amount),
    walletName: entry.wallet.name,
    walletCode: entry.wallet.code,
    postedByName: entry.postedBy.fullName,
    postedByRole: entry.postedBy.role,
  }));

  const spentPct = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
  const committedPct = totalBudget > 0 ? (committed / totalBudget) * 100 : 0;
  const availablePct = totalBudget > 0 ? (available / totalBudget) * 100 : 0;

  return (
    <BudgetClient
      role={role}
      userId={userId}
      userDeptId={userDeptId}
      canViewAllocation={canManageBudgetPlan(actor) || role === "EXECUTIVE"}
      academicYears={academicYears.map((year) => ({
        id: year.id,
        yearName: year.yearName,
      }))}
      selectedYearId={selectedYearId}
      hasLockedPlan={Boolean(lockedPlan)}
      planName={lockedPlan?.name || null}
      fiscalYearName={lockedPlan?.fiscalYear.yearName || null}
      summary={{
        totalBudget,
        projectApproved: totalProjectApproved,
        committed,
        spent,
        available,
        spentPct,
        committedPct,
        availablePct,
      }}
      wallets={mappedWallets}
      departments={mappedDepartments}
      topProjects={topProjects}
      allProjects={visibleProjects}
      transactions={transactions}
      totalTransactions={totalTransactions}
      currentPage={currentTransactionPage}
      warnings={warnings}
    />
  );
}
