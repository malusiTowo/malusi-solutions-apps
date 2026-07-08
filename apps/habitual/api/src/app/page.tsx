import { Button, Card, CardContent, CardTitle } from "@repo/ui";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent">
          <span className="text-2xl">✅</span>
        </div>
        <span className="text-2xl font-bold">Habitual</span>
      </div>

      <div className="space-y-4">
        <h1 className="text-5xl font-extrabold leading-tight">
          Build habits <span className="text-accent">that actually stick.</span>
        </h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          Track anything, earn XP as you go, and let your AI coach keep you on streak. A universal
          habit tracker — gamified &amp; AI-powered.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/sign-in">I already have an account</Link>
        </Button>
      </div>

      <Card className="w-full max-w-sm text-left">
        <CardTitle className="mb-2 text-base">API status</CardTitle>
        <CardContent className="text-muted-foreground">
          tRPC is live at{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 text-accent">
            /api/trpc/health
          </code>
          . Mobile app talks to this server.
        </CardContent>
      </Card>
    </main>
  );
}
