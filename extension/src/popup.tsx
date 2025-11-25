import "@/style.css";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast, Toaster } from "sonner";

import { authClient } from "./lib/better-auth-client";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

type SessionData = ReturnType<typeof authClient.useSession>["data"];

function IndexPopup() {
  const { data: session, error, isPending } = authClient.useSession();

  const content = useMemo(() => {
    if (isPending) {
      return <LoadingState />;
    }

    if (!session) {
      return <LoginForm />;
    }

    return <AuthenticatedPanel session={session} />;
  }, [isPending, session]);

  return (
    <div className="min-w-[360px] w-[420px] min-h-[320px] bg-background text-foreground px-6 py-8">
      <Toaster position="top-center" />
      {error && (
        <p className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error.message}
        </p>
      )}
      {content}
    </div>
  );
}

export default IndexPopup;

function LoadingState() {
  return (
    <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Checking your session…
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Logged in");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border border-border/60 shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">Log in to Composer AI</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to continue.
        </p>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="popup-email">Email</Label>
            <Input
              id="popup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="popup-password">Password</Label>
            <Input
              id="popup-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className='w-full bg-neutral-800 hover:bg-neutral-900 normal-case tracking-[0]' disabled={isSubmitting || !email || !password}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in…
              </>
            ) : (
              "Log in"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AuthenticatedPanel({ session }: { session: SessionData }) {
  const email = session?.user?.email ?? "Unknown user";
  const name = session?.user?.name;

  const handleSignOut = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Signed out");
  };

  return (
    <Card className="border border-border/60 shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">You are signed in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-md border border-border px-4 py-3">
          <p className="text-muted-foreground">Logged in as</p>
          <p className="text-base font-medium">{name ?? email}</p>
          {name && <p className="text-muted-foreground">{email}</p>}
        </div>
        <Button variant="destructive" className='text-white' onClick={handleSignOut}>
          Log out
        </Button>
      </CardContent>
    </Card>
  );
}
