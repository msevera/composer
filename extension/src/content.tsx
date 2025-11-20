import cssText from "data-text:~style.css";
import type { PlasmoCSConfig } from "plasmo";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast, Toaster } from "sonner";

import { authClient } from "./lib/better-auth-client";
import { Button } from "./components/ui/button";
import { COMPOSE_DRAFT_MUTATION } from "./lib/graphql/composition";
import { apolloClient } from "./lib/apollo-client";

export const config: PlasmoCSConfig = {
  matches: ["https://mail.google.com/*"],
};

export const getStyle = () => {
  const style = document.createElement("style");
  style.textContent = cssText;
  return style;
};

const MIN_TEXTAREA_HEIGHT = 21;

const PlasmoOverlay = () => {
  const { data: session, isPending } = authClient.useSession();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isThreadView = useIsGmailThreadView();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    const element = textareaRef.current;
    element.style.height = "auto";
    const nextHeight = Math.max(element.scrollHeight, MIN_TEXTAREA_HEIGHT);
    element.style.height = `${nextHeight}px`;
  }, [message]);

  const shouldRender = useMemo(
    () => Boolean(!isPending && session && isThreadView),
    [isPending, isThreadView, session],
  );

  if (!shouldRender) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    const threadId = getThreadIdFromDom();
    if (!threadId) {
      toast.error("Unable to find the Gmail thread. Please refresh the page and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await apolloClient.mutate({
        mutation: COMPOSE_DRAFT_MUTATION,
        variables: {
          input: {
            prompt: message.trim(),
            threadId,
          },
        },
      });

      const draft = data?.composeDraft?.content;
      if (draft) {
        toast.success("Draft composed");
        setMessage(draft);
      } else {
        toast.success("Compose request queued");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to compose draft. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[2147483646] flex justify-center px-4 pb-5">
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto w-full max-w-xl rounded-full bg-black/80 p-[2px] shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
        >
          <div className="flex w-full items-center gap-2 rounded-full bg-gradient-to-r from-stone-900 via-black to-stone-900 px-2.5 py-2.5 pl-4">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={1}
              placeholder="I will create a draft for you"
              className="max-h-40 min-h-[21px] flex-1 resize-none border-none bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none"
            />
            <Button
              disabled={!message.trim() || isSubmitting}
              type="submit"
              size="sm"
              className="self-end h-8 rounded-full bg-white/10 px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Composing
                </>
              ) : (
                "Compose"
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default PlasmoOverlay;

function useIsGmailThreadView() {
  const [isThreadView, setIsThreadView] = useState(() => checkThreadView());

  useEffect(() => {
    const updateView = () => setIsThreadView(checkThreadView());

    window.addEventListener("hashchange", updateView);
    window.addEventListener("popstate", updateView);

    const observer = new MutationObserver(() => {
      updateView();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("hashchange", updateView);
      window.removeEventListener("popstate", updateView);
      observer.disconnect();
    };
  }, []);

  return isThreadView;
}

function checkThreadView() {
  if (typeof window === "undefined") {
    return false;
  }

  const isGmail = window.location.hostname.includes("mail.google.com");
  if (!isGmail) {
    return false;
  }

  const hash = window.location.hash ?? "";
  const search = window.location.search ?? "";

  const hasThreadIdInHash = /#(?:inbox|sent|starred|drafts|imp|all|label\/[^/]+)\/[\w-]+/i.test(hash);
  const hasThreadViewParam = /[?&]view=pt/i.test(search);

  if (hasThreadIdInHash || hasThreadViewParam) {
    return true;
  }

  return hasThreadDomMarkers();
}

function hasThreadDomMarkers() {
  if (typeof document === "undefined") {
    return false;
  }

  return Boolean(
    document.querySelector(
      'div[role="main"] div[data-legacy-thread-id], div[role="main"] div[data-legacy-message-id], div[role="main"] .ha, div[role="main"] .h7',
    ),
  );
}

function getThreadIdFromDom() {
  if (typeof document === "undefined") {
    return undefined;
  }

  const heading = document.querySelector<HTMLHeadingElement>("h2[data-legacy-thread-id]");
  if (heading?.dataset.legacyThreadId) {
    return heading.dataset.legacyThreadId;
  }

  const legacyContainer = document.querySelector<HTMLElement>("[data-legacy-thread-id]");
  if (legacyContainer?.dataset.legacyThreadId) {
    return legacyContainer.dataset.legacyThreadId;
  }

  if (typeof window !== "undefined") {
    const hashMatch = window.location.hash.match(/\/([\w-]+)$/);
    if (hashMatch) {
      return hashMatch[1];
    }
  }

  return undefined;
}
