import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Block className="h-8 w-56" />
        <Block className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="space-y-4 p-4">
              <Block className="h-4 w-24" />
              <Block className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="space-y-3">
          <Block className="h-5 w-48" />
          <Block className="h-10 w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Block key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
