import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApprovalQueue } from "@/lib/approval-list-service";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const result = await getApprovalQueue(
    session.user,
    new URL(req.url).searchParams,
  );

  return NextResponse.json(result);
}
