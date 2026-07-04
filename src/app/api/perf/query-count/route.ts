import { NextResponse } from "next/server";

import { getPrismaQueryCount, resetPrismaQueryCount } from "@/lib/prisma";

function isEnabled() {
  return process.env.PERF_QUERY_COUNT === "1";
}

export async function GET() {
  if (!isEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ count: getPrismaQueryCount() });
}

export async function POST() {
  if (!isEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  resetPrismaQueryCount();
  return NextResponse.json({ count: 0 });
}
