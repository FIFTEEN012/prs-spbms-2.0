import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(178,197,255,0.45),_transparent_34%),linear-gradient(180deg,_#faf8ff_0%,_#eef2ff_100%)] md:flex md:flex-row">
      <MobileNav />
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-4 pb-[max(5rem,env(safe-area-inset-bottom))] pt-4 md:px-6 md:py-6 print:w-full print:bg-white print:p-0">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
