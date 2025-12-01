import "@/style.css";

import { useEffect, useMemo, useState } from "react";
import type { SVGProps } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Toaster } from "sonner";
import { authClient } from "./lib/better-auth-client";

type SessionData = ReturnType<typeof authClient.useSession>["data"];

const WEBSITE_URL = process.env.PLASMO_PUBLIC_WEB_URL;
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
    <div className="min-w-[380px] w-[420px] relative overflow-hidden bg-gradient-to-br from-blue-50/40 via-white to-violet-50/40">
      <div className="relative">
        <Toaster position="top-center" />
        <div className="px-8 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Composer AI</h1>
                <p className="text-xs text-slate-500">AI-Powered Email Assistant</p>
              </div>
            </div>
            {session?.user && (
              <button
                onClick={handleAvatarClick}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all cursor-pointer"
                title="Open Composer AI website"
              >
                <span className="text-sm font-semibold">
                  {getUserInitials(session.user.name, session.user.email)}
                </span>
              </button>
            )}
          </div>
          {error && (
            <div className="mb-6 rounded-2xl border border-amber-200/50 bg-amber-50/80 backdrop-blur-sm px-4 py-3 text-sm text-amber-800 shadow-sm">
              {error.message}
            </div>
          )}
          {content}
        </div>
      </div>
    </div>
  );
}

export default IndexPopup;

function LoadingState() {
  return (
    <div className="flex h-48 items-center justify-center gap-3 rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm px-6 py-8 shadow-sm">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      <p className="text-sm font-medium text-slate-600">Checking your session…</p>
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
        className="flex-1 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50/80"
        onClick={() => openDashboardPath("/login")}
      >
        <LogIn className="mr-2 h-4 w-4" />
        Login
      </button>
      <button
        className="flex-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-violet-500"
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
        <div className="rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-4 text-sm text-slate-600 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-800">
            Connect Gmail to see the assistant in your inbox.
          </p>
          <button
            className="inline-flex w-full min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-violet-500"
            onClick={handleConnectGmail}
          >
            <GmailIcon className="h-4 w-4" />
            <span>Connect Gmail</span>
          </button>
        </div>
      ) : (
        <button
          className="inline-flex w-full min-w-[180px] items-center justify-center gap-2 rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50/80"
          onClick={handleOpenDashboard}
        >
          <span>Open dashboard</span>
        </button>
      )}
    </div>
  );
}
