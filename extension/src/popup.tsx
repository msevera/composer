import "@/style.css";

import { useEffect, useMemo, useState } from "react";
import type { SVGProps } from "react";
import { Loader2, LogIn, UserPlus, MessageSquare } from "lucide-react";
import { toast, Toaster } from "sonner";

import { authClient } from "./lib/better-auth-client";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

type SessionData = ReturnType<typeof authClient.useSession>["data"];

const WEBSITE_URL = process.env.PLASMO_PUBLIC_WEBSITE_URL || "http://localhost:3000";
const REQUIRED_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const GmailIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="52 42 88 66" aria-hidden="true" {...props}>
    <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
    <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
    <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
    <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
    <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
  </svg>
);

function IndexPopup() {
  const { data: session, error, isPending } = authClient.useSession();

  const content = useMemo(() => {
    if (isPending) {
      return <LoadingState />;
    }

    return session ? <AuthenticatedPanel session={session} /> : <AuthCtas />;
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
    <div className="min-w-[380px] w-[420px] bg-white text-neutral-900 relative">
      <Toaster position="top-center" />
      <div className="px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">Composer AI</h1>
              <p className="text-xs text-neutral-500">AI-powered reply composition</p>
            </div>
          </div>
          {session?.user && (
            <button
              onClick={handleAvatarClick}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
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

function AuthCtas() {
  const openDashboardPath = (path: string) => {
    window.open(`${WEBSITE_URL}${path}`, "_blank");
  };

  return (
    <div className="flex gap-2 items-center justify-center">
      <button
        className="flex-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 ring-1 ring-inset ring-slate-200"
        onClick={() => openDashboardPath("/login")}
      >
        <LogIn className="mr-2 h-4 w-4" />
        Login
      </button>
      <button
        className="flex-1 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        onClick={() => openDashboardPath("/signup")}
      >
        <UserPlus className="mr-2 h-4 w-4 text-white" />
        <span className='whitespace-nowrap'>
          Sign up
        </span>
      </button>
    </div>
  );
}

function AuthenticatedPanel({ session }: { session: SessionData }) {
  const [hasRequiredScopes, setHasRequiredScopes] = useState(false);
  const [isCheckingScopes, setIsCheckingScopes] = useState(true);

  useEffect(() => {
    let isActive = true;

    const verifyScopes = async () => {
      try {
        setIsCheckingScopes(true);
        const accounts = await authClient.listAccounts();
        const accountList = accounts.data ?? [];
        const gmailAccount = accountList.find(
          (account: any) => account.providerId === "google",
        );
        const gmailHasScopes = REQUIRED_GMAIL_SCOPES.every((scope) =>
          gmailAccount?.scopes?.includes?.(scope),
        );

        if (isActive) {
          setHasRequiredScopes(Boolean(gmailAccount && gmailHasScopes));
        }
      } catch (error) {
        console.error("Failed to verify Gmail scopes", error);
        if (isActive) {
          setHasRequiredScopes(false);
        }
      } finally {
        if (isActive) {
          setIsCheckingScopes(false);
        }
      }
    };

    void verifyScopes();

    return () => {
      isActive = false;
    };
  }, []);

  const handleOpenDashboard = () => {
    window.open(`${WEBSITE_URL}/dashboard`, "_blank");
  };

  const handleConnectGmail = () => {
    window.open(`${WEBSITE_URL}/dashboard`, "_blank");
  };

  return (
    <div>
      {(!isCheckingScopes && !hasRequiredScopes) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-800">
            Connect Gmail to see the assistant in your inbox.
          </p>
          <button
            className="inline-flex w-full min-w-[180px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            onClick={handleConnectGmail}
          >
            <GmailIcon className="h-4 w-4" />
            <span>Connect Gmail</span>
          </button>
        </div>
      ) : (
        <button
          className="inline-flex w-full min-w-[180px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          onClick={handleOpenDashboard}
        >
          <span>Open dashboard</span>
        </button>
      )}
    </div>
  );
}
