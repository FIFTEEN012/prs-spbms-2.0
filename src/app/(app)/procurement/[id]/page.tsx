import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PurchaseRequestDetailClient } from "./_client";

function serializeDecimals(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj === "object" && typeof obj.toNumber === "function") {
    return obj.toNumber();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals);
  }
  if (typeof obj === "object") {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = serializeDecimals(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export default async function PurchaseRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  if (!id) {
    redirect("/procurement");
  }

  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      project: {
        include: { department: true },
      },
      activity: true,
      fundSource: true,
      budgetWallet: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      items: true,
      createdBy: {
        select: { fullName: true, username: true, role: true },
      },
    },
  });

  if (!request) {
    redirect("/procurement");
  }

  // Fetch name maps or details for approvers if needed
  const approverIds = [
    request.planApprovedById,
    request.financeApprovedById,
    request.procurementApprovedById,
    request.budgetApprovedById,
    request.directorApprovedById,
  ].filter((id): id is string => id !== null);

  const approvers = await prisma.user.findMany({
    where: { id: { in: approverIds } },
    select: { id: true, fullName: true, role: true },
  });

  const approverMap = approvers.reduce((map, user) => {
    map[user.id] = user.fullName;
    return map;
  }, {} as Record<string, string>);

  const serializedRequest = serializeDecimals(request);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-12">
      <PurchaseRequestDetailClient
        request={serializedRequest as any}
        currentUser={{ id: session.user.id, role: session.user.role, departmentId: session.user.departmentId ?? null }}
        approverMap={approverMap}
      />
    </div>
  );
}
