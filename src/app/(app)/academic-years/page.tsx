import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AcademicYearsClient } from "./_components/academic-years-client";

export default async function AcademicYearsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const years = await prisma.academicYear.findMany({
    orderBy: { yearName: "desc" },
    include: { _count: { select: { projects: true, strategies: true } } },
  });

  return (
    <AcademicYearsClient
      initialYears={years}
      role={session.user.role}
    />
  );
}
