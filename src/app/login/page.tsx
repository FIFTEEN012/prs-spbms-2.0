"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MOCK_ACCOUNTS = [
  { username: "admin", label: "Super Admin" },
  { username: "director", label: "Executive" },
  { username: "depthead", label: "Dept Head" },
  { username: "teacher1", label: "Teacher" },
  { username: "finance", label: "Finance" },
  { username: "procurement", label: "Procurement" },
  { username: "committee", label: "Committee" },
] as const;

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginCardFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    const callbackUrl = params.get("callbackUrl");
    router.push(callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(178,197,255,0.5),_transparent_36%),linear-gradient(180deg,_#faf8ff_0%,_#eef2ff_100%)] p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/25">
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <School className="size-5" />
            </span>
            <div>
              <CardTitle className="text-2xl text-primary">เข้าสู่ระบบ</CardTitle>
              <div className="text-sm font-semibold text-foreground">PRS SPBMS</div>
            </div>
          </div>
          <CardDescription>
            ระบบบริหารแผนปฏิบัติการประจำปีและงบประมาณของโรงเรียน
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">ชื่อผู้ใช้</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">รหัสผ่าน</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>

            <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                บัญชีทดลองแบบคลิกเดียว
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MOCK_ACCOUNTS.map((account) => (
                  <Button
                    key={account.username}
                    type="button"
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setUsername(account.username);
                      setPassword("password123");
                    }}
                  >
                    {account.label}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              ใช้รหัสผ่านเดียวกันทุกบัญชี: <code>password123</code>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function LoginCardFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center text-muted-foreground">
          กำลังโหลดหน้าเข้าสู่ระบบ...
        </CardContent>
      </Card>
    </main>
  );
}
