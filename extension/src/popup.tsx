import "@/style.css";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Loader2, Mail, Lock, LogOut, User, MessageSquare } from "lucide-react";
import { toast, Toaster } from "sonner";

import { authClient } from "./lib/better-auth-client";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

type SessionData = ReturnType<typeof authClient.useSession>["data"];

const WEBSITE_URL = process.env.PLASMO_PUBLIC_WEBSITE_URL || "http://localhost:3000";

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

  const handleAvatarClick = () => {
    window.open(WEBSITE_URL, "_blank");
  };

  const getUserInitials = (name?: string | null, email?: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name[0].toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <div className="min-w-[380px] w-[420px] bg-gradient-to-br from-neutral-50 to-white text-neutral-900 relative">
      <Toaster position="top-center" />
      <div className="px-8 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">Composer AI</h1>
              <p className="text-xs text-neutral-500">AI-powered reply composition</p>
            </div>
          </div>
          {session?.user && (
            <button
              onClick={handleAvatarClick}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors cursor-pointer"
              title="Open Composer AI website"
            >
              <span className="text-sm font-semibold">
                {getUserInitials(session.user.name, session.user.email)}
              </span>
            </button>
          )}
        </div>
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error.message}
          </div>
        )}
        {content}
      </div>
    </div>
  );
}

export default IndexPopup;

function LoadingState() {
  return (
    <div className="flex h-48 items-center justify-center gap-3 rounded-xl bg-white/60 px-6 py-8">
      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
      <p className="text-sm font-medium text-neutral-600">Checking your session…</p>
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
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="popup-email" className="text-sm font-medium text-neutral-700">
            Email address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="popup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="pl-10 h-11 border-neutral-200 bg-white focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="popup-password" className="text-sm font-medium text-neutral-700">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="popup-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="pl-10 h-11 border-neutral-200 bg-white focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
        </div>
        <Button
          type="submit"
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting || !email || !password}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </div>
  )
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

    toast.success("Signed out successfully");
  };

  return (
    <div>
      <p className="text-sm text-neutral-500">
        You're signed in and ready to use Composer AI
      </p>
    </div>
  )
}
