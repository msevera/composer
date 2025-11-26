import cssText from "data-text:~style.css";
import type { PlasmoCSConfig } from "plasmo";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, RotateCcw, Square, Check, Minimize2, Maximize2 } from "lucide-react";

import { authClient } from "./lib/better-auth-client";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";
import { apolloClient } from "./lib/apollo-client";
import { GET_CONVERSATION_STATE_QUERY } from "./lib/graphql/composition";

export const config: PlasmoCSConfig = {
  matches: ["https://mail.google.com/*"],
};


export const getStyle = () => {
  const style = document.createElement("style");
  style.textContent = cssText;
  return style;
};

const MIN_TEXTAREA_HEIGHT = 26;
const GRAPHQL_ENDPOINT =
  process.env.PLASMO_PUBLIC_API_URL ?? "http://localhost:4000/graphql";
const API_BASE_URL = GRAPHQL_ENDPOINT.replace(/\/graphql$/i, "");
const COMPOSITION_STREAM_URL = `${API_BASE_URL}/composition/stream`;
const requiredGmailScopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const PlasmoOverlay = () => {
  const { data: session, isPending } = authClient.useSession();
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [agentMessages, setAgentMessages] = useState<
    Array<{ id: string; text: string; kind: "user" | "draft" }>
  >([]);
  const [draftIndicator, setDraftIndicator] = useState<string | null>(null);
  const isThreadView = useIsGmailThreadView();
  const [isMinimized, setIsMinimized] = useState(() => getSavedMinimizedState());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentDraftMessageIdRef = useRef<string | null>(null);
  const lastStreamedDraftIdRef = useRef<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [hasRequiredGmailScopes, setHasRequiredGmailScopes] = useState(false);
  const [isCheckingGmailScopes, setIsCheckingGmailScopes] = useState(false);
  const previousThreadIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    const element = textareaRef.current;
    element.style.height = "auto";
    const nextHeight = Math.max(element.scrollHeight, MIN_TEXTAREA_HEIGHT);
    element.style.height = `${nextHeight}px`;
  }, [message]);

  useEffect(() => {
    const updateThreadContext = async () => {
      const threadId = getThreadIdFromDom();
      const previousThreadId = previousThreadIdRef.current;
      
      // If thread changed, clear messages
      if (previousThreadId !== threadId) {
        setAgentMessages([]);
        previousThreadIdRef.current = threadId;
      }
      
      if (!threadId) {
        setAgentMessages([]);
        return;
      }

      // Get conversationId from storage (if exists)
      const conversationId = getConversationIdFromStorage(threadId);
       
      // Only fetch conversation state if we have a conversationId
      // If no conversationId exists, the conversation should be empty (first visit)
      if (!conversationId) {
        // No conversationId - this is a first visit, keep conversation empty
        setAgentMessages([]);
        return;
      }

      // Fetch conversation state from API using the conversationId
      try {
        const { data } = await apolloClient.query({
          query: GET_CONVERSATION_STATE_QUERY,
          variables: { conversationId },
          fetchPolicy: "network-only", // Always fetch fresh data
        });

        if (data?.getConversationState?.exists && data.getConversationState.messages) {
          // Load conversation history
          const messages = data.getConversationState.messages.map((msg: any) => ({
            id: generateMessageId(),
            text: msg.content,
            kind: msg.kind as "user" | "draft",
          }));
          setAgentMessages(messages);
        } else {
          // No conversation exists - remove from storage and clear messages
          saveConversationIdToStorage(threadId, null);
          setAgentMessages([]);
        }
      } catch (error) {
        console.error("Failed to fetch conversation state:", error);
        // On error, remove from storage and clear messages
        saveConversationIdToStorage(threadId, null);
        setAgentMessages([]);
      }
    };

    void updateThreadContext();

    if (!isThreadView) {
      return;
    }

    const observer = new MutationObserver(() => {
      void updateThreadContext();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    const handleHashChange = () => {
      void updateThreadContext();
    };
    const handlePopState = () => {
      void updateThreadContext();
    };
    
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handlePopState);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isThreadView]);


  useEffect(() => {
    let isActive = true;

    const verifyGmailScopes = async () => {
      if (!session) {
        if (isActive) {
          setHasRequiredGmailScopes(false);
          setIsCheckingGmailScopes(false);
        }
        return;
      }

      if (isActive) {
        setIsCheckingGmailScopes(true);
      }

      try {
        const accounts = await authClient.listAccounts();
        const accountList = accounts.data ?? [];
        const gmailAccount = accountList.find(
          (account: any) => account.providerId === "google",
        );
        const gmailHasScopes = requiredGmailScopes.every((scope) =>
          gmailAccount?.scopes?.includes?.(scope),
        );

        if (isActive) {
          setHasRequiredGmailScopes(Boolean(gmailAccount && gmailHasScopes));
        }
      } catch (error) {
        console.error("Failed to verify Gmail scopes", error);
        if (isActive) {
          setHasRequiredGmailScopes(false);
        }
      } finally {
        if (isActive) {
          setIsCheckingGmailScopes(false);
        }
      }
    };

    void verifyGmailScopes();

    return () => {
      isActive = false;
    };
  }, [session]);

  const shouldRender = useMemo(
    () =>
      Boolean(
        !isPending &&
          !isCheckingGmailScopes &&
          session &&
          hasRequiredGmailScopes &&
          isThreadView &&
          getThreadIdFromDom(),
      ),
    [
      hasRequiredGmailScopes,
      isCheckingGmailScopes,
      isPending,
      isThreadView,
      session,
    ],
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (conversationScrollRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (conversationScrollRef.current) {
          conversationScrollRef.current.scrollTo({
            top: conversationScrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [agentMessages, draftIndicator, errorMessages]);

  const handleMaximize = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const handleMinimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const handleAgentResponse = useCallback(
    (response: Record<string, any>) => {
      if (!response) {
        throw new Error("Invalid response from composer agent");
      }

      const threadId = getThreadIdFromDom();
      const nextConversationId = response.conversationId ?? null;
      
      // Save conversationId to localStorage for this thread
      if (threadId && nextConversationId) {
        saveConversationIdToStorage(threadId, nextConversationId);
      }

      const latestActivity = getLatestActivity(response.activity);

      const hasFailure = activityHasFailure(response.activity);
      const draftText = "draftContent" in response ? response.draftContent : undefined;
      const isDraftResponse =
        response.status === "DRAFT_READY" &&
        Boolean(draftText) &&
        !hasFailure;
      const displayText = draftText;
      const streamedDraftId = lastStreamedDraftIdRef.current;

      if (displayText && isDraftResponse && !streamedDraftId) {
        setAgentMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            text: displayText,
            kind: "draft",
          },
        ]);
      }

      setDraftIndicator(null);
      lastStreamedDraftIdRef.current = null;

      if (!isDraftResponse && latestActivity) {
        setDraftIndicator(latestActivity);
      }

      setMessage("");
    },
    [],
  );

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, [closeEventSource]);

  useEffect(() => {
    persistMinimizedState(isMinimized);
  }, [isMinimized]);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  const handleStreamEvent = useCallback(
    (event: ComposeStreamEvent) => {
      switch (event.type) {
        case "activity":
          setDraftIndicator(event.message);
          break;
        case "tool_start": {
          const text = `Executing ${formatToolName(event.tool)}…`;
          setDraftIndicator(text);
          break;
        }
        case "tool_end": {
          const text = `${formatToolName(event.tool)} completed.`;
          setDraftIndicator(text);
          break;
        }
        case "tool_error": {
          const text = `${formatToolName(event.tool)} failed: ${event.message}`;
          console.error(text);
          setDraftIndicator(text);
          setErrorMessages((prev) => [...prev, text]);
          break;
        }
        case "draft_stream_started": {
          setDraftIndicator(null);
          const draftId = generateMessageId();
          currentDraftMessageIdRef.current = draftId;
          setAgentMessages((prev) => [
            ...prev,
            {
              id: draftId,
              text: "",
              kind: "draft",
            },
          ]);
          break;
        }
        case "draft_chunk": {
          setDraftIndicator(null);
          const draftId = currentDraftMessageIdRef.current;
          if (!draftId) {
            const fallbackId = generateMessageId();
            currentDraftMessageIdRef.current = fallbackId;
            setAgentMessages((prev) => [
              ...prev,
              {
                id: fallbackId,
                text: event.content,
                kind: "draft",
              },
            ]);
          } else {
            setAgentMessages((prev) =>
              prev.map((entry) =>
                entry.id === draftId
                  ? {
                    ...entry,
                    text: `${entry.text}${event.content}`,
                  }
                  : entry,
              ),
            );
          }
          break;
        }
        case "draft_stream_finished": {
          setDraftIndicator(null);
          const draftId = currentDraftMessageIdRef.current;
          if (!draftId) {
            const newId = generateMessageId();
            setAgentMessages((prev) => [
              ...prev,
              {
                id: newId,
                text: event.draft,
                kind: "draft",
              },
            ]);
            lastStreamedDraftIdRef.current = newId;
          } else {
            setAgentMessages((prev) =>
              prev.map((entry) =>
                entry.id === draftId
                  ? {
                    ...entry,
                    text: event.draft,
                  }
                  : entry,
              ),
            );
            lastStreamedDraftIdRef.current = draftId;
          }
          currentDraftMessageIdRef.current = null;
          break;
        }
        case "error":
          console.error(event.message);
          closeEventSource();
          setDraftIndicator(null);
          setErrorMessages((prev) => [...prev, event.message]);
          setIsRunning(false);
          break;
        case "final":
          handleAgentResponse(event.payload);
          closeEventSource();
          setDraftIndicator(null);
          setIsRunning(false);
          break;
        default:
          break;
      }
    },
    [closeEventSource, handleAgentResponse],
  );

  const startStream = useCallback(
    (inputText: string) => {
      const threadId = getThreadIdFromDom();
      if (!threadId) {
        console.error("Unable to find the Gmail thread. Please refresh and try again.");
        return;
      }
      
      const conversationId = getConversationIdFromStorage(threadId);
      
      setDraftIndicator(null);
      if (inputText.trim()) {
        setAgentMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            text: inputText,
            kind: "user",
          },
        ]);
      }
      const params = new URLSearchParams({
        threadId,
        userPrompt: inputText ?? "",
      });
      if (conversationId) {
        params.set("conversationId", conversationId);
      }

      const source = new EventSource(`${COMPOSITION_STREAM_URL}?${params.toString()}`, {
        withCredentials: true,
      });
      eventSourceRef.current = source;
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as ComposeStreamEvent;
          handleStreamEvent(payload);
        } catch (error) {
          console.error(error);
        }
      };
      source.onerror = () => {
        closeEventSource();
        setIsRunning(false);
        console.error("Stream interrupted. Please try again.");
      };
    },
    [handleStreamEvent, closeEventSource],
  );

  const handleSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (isRunning) {
        return;
      }

      const threadId = getThreadIdFromDom();
      if (!threadId) {
        console.error("Unable to find the Gmail thread. Please refresh and try again.");
        return;
      }

      setIsRunning(true);
      setDraftIndicator("Starting agent…");
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
      setErrorMessages([]);
      setCopiedDraftId(null);
      startStream(message.trim());
      setMessage("");
    },
    [isRunning, message, startStream],
  );

  const handleStop = useCallback(() => {
    closeEventSource();
    setIsRunning(false);
    setDraftIndicator(null);
    console.log("Agent stopped");
  }, [closeEventSource]);

  const handleStopClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      handleStop();
    },
    [handleStop],
  );

  const handleReset = useCallback(() => {
    if (isRunning) {
      closeEventSource();
      setIsRunning(false);
    }

    const threadId = getThreadIdFromDom();
    
    // Remove conversationId from storage
    if (threadId) {
      saveConversationIdToStorage(threadId, null);
    }

    // Clear local state
    setAgentMessages([]);
    setDraftIndicator(null);
    setCopiedDraftId(null);
    setErrorMessages([]);
    setMessage("");
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
    currentDraftMessageIdRef.current = null;
    lastStreamedDraftIdRef.current = null;
    console.log("Conversation reset - new conversationId will be generated on next compose");
  }, [closeEventSource, isRunning]);

  const handleCopyDraft = useCallback(async (content: string, messageId?: string) => {
    if (!content) {
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      console.log("Draft copied to clipboard");
      setCopiedDraftId(messageId ?? null);
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = setTimeout(() => {
        setCopiedDraftId(null);
        copiedTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Unable to copy draft. Please copy manually.";
      console.log(messageText);
    }
  }, []);

  if (!shouldRender) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="pointer-events-none fixed bottom-4 left-4 z-[2147483646] flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-[28px] bg-stone-900/95 px-4 py-2 pr-2 text-neutral-100 shadow-lg shadow-black/60">
          {
            isRunning && (
              <div className="w-1 h-1 rounded-full bg-emerald-400 pulsate animate-pulse mr-0.5" />
            )
          }
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Composer ai</p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-neutral-400"
            onClick={handleMaximize}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const renderMinimizeButton = !isMinimized && agentMessages.length === 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[2147483646] flex justify-center px-4 pb-5">
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto w-full max-w-xl rounded-[28px] bg-stone-900 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur flex flex-col max-h-[50vh]"
      >
        <div className="flex-shrink-0">
          {(agentMessages.length > 0 || isRunning) && (
            <div className="p-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Composer ai</p>
              <div className="flex items-center gap-2">
                <Button size="xs" variant="ghost" className="text-neutral-500" onClick={handleMinimize}>
                  <Minimize2 className="h-4 w-4" />
                  minimize
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={handleReset}
                  className="text-neutral-500"
                >
                  <RotateCcw className="mr-0.5 h-3 w-3" />
                  reset
                </Button>
              </div>
            </div>
          )}
        </div>

        <div
          ref={conversationScrollRef}
          className={cn(
            "flex-1 overflow-y-auto space-y-3 text-sm text-neutral-200",
            agentMessages.length > 0 || draftIndicator ? "p-4 pt-0" : "p-0",
          )}
        >
          {(agentMessages.length > 0 || draftIndicator) && (
            <div className="space-y-2 text-xs text-neutral-100 flex flex-col">
              {agentMessages.map((messageEntry) =>
                messageEntry.kind === "user" ? (
                  <div
                    key={messageEntry.id}
                    className="self-end rounded-2xl px-3 py-2 whitespace-pre-wrap bg-neutral-700 text-white text-xs"
                  >
                    {messageEntry.text}
                  </div>
                ) : (
                  <DraftBubble
                    key={messageEntry.id}
                    text={messageEntry.text}
                    copied={copiedDraftId === messageEntry.id}
                    onCopy={() => void handleCopyDraft(messageEntry.text, messageEntry.id)}
                  />
                ),
              )}
              {draftIndicator && <DraftBubble indicator={draftIndicator} />}
            </div>
          )}
          {errorMessages.length > 0 && (
            <div className="space-y-2 text-xs">
              {errorMessages.map((error, index) => (
                <div
                  key={`error-${index}`}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-100"
                >
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cn("flex-shrink-0 flex w-full items-end gap-2 rounded-[28px] p-2.5 bg-stone-900 px-3 py-3",
          !renderMinimizeButton ? "pl-5" : ""
        )}>
          {
            renderMinimizeButton && (
              <Button size="icon" className="text-neutral-500" type="button" onClick={handleMinimize}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            )
          }
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void (isRunning ? handleStop() : handleSubmit());
              }
            }}
            rows={1}
            placeholder="Write anything (optional)"
            className="max-h-40 min-h-[26px] flex-1 resize-none border-none bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none"
          />
          <Button
            type={isRunning ? "button" : "submit"}
            onClick={isRunning ? handleStopClick : undefined}
            variant={isRunning ? "destructive" : "default"}
            size="sm"
          >
            {isRunning ? (
              <>
                <Square className="mr-2 h-3.5 w-3.5" />
                Stop
              </>
            ) : (
              <>
                Compose
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

interface DraftBubbleProps {
  text?: string;
  onCopy?: () => void;
  indicator?: string | null;
  copied?: boolean;
}

const DraftBubble = ({ text, onCopy, indicator, copied }: DraftBubbleProps) => {
  const hasDraftText = Boolean(text);
  const indicatorLabel = indicator ?? "Preparing draft…";
  const showCopyButton = hasDraftText && onCopy;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-100">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Draft</p>
        {showCopyButton ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "text-[11px]",
              copied
                ? "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                : "text-neutral-100 hover:text-white",
            )}
            onClick={onCopy}
          >
            {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            {indicatorLabel}
          </span>
        )}
      </div>
      {hasDraftText ? (
        <pre className="whitespace-pre-wrap text-xs text-neutral-100">{text}</pre>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="h-3 rounded-md bg-white/10 animate-pulse" />
          <div className="h-3 rounded-md bg-white/10 animate-pulse delay-75" />
          <div className="h-3 rounded-md bg-white/10 animate-pulse delay-150 w-3/4" />
        </div>
      )}
    </div>
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


type ComposeStreamEvent =
  | { type: "activity"; message: string }
  | { type: "tool_start"; tool: string }
  | { type: "tool_end"; tool: string }
  | { type: "tool_error"; tool: string; message: string }
  | { type: "draft_stream_started" }
  | { type: "draft_chunk"; content: string }
  | { type: "draft_stream_finished"; draft: string }
  | { type: "final"; payload: Record<string, any> }
  | { type: "error"; message: string };

function getLatestActivity(activity?: string[] | null) {
  if (!activity?.length) {
    return null;
  }
  return activity[activity.length - 1] ?? null;
}

function activityHasFailure(activity?: string[] | null) {
  if (!activity?.length) {
    return false;
  }
  return activity.some((entry) => entry.toLowerCase().includes("failed"));
}

function looksLikeDraft(content: string) {
  const text = content.trim();
  if (text.length < 60) {
    return false;
  }
  const hasGreeting = /^hi |^hello |^dear /i.test(text);
  const hasFarewell = /thanks[, ]|regards|sincerely/i.test(text);
  const hasParagraphBreak = /\n\s*\n/.test(text);
  return hasGreeting || hasFarewell || hasParagraphBreak;
}


function generateMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatToolName(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const MINIMIZED_STORAGE_KEY = "composerai-composer-minimized";

function getSavedMinimizedState() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(MINIMIZED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistMinimizedState(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(MINIMIZED_STORAGE_KEY, String(value));
  } catch {
    // ignore write errors
  }
}

function getConversationStorageKey(threadId: string) {
  return `composerai-conversation-${threadId}`;
}

function getConversationIdFromStorage(threadId: string): string | null {
  if (typeof window === "undefined" || !threadId) {
    return null;
  }
  try {
    return window.localStorage.getItem(getConversationStorageKey(threadId));
  } catch {
    return null;
  }
}

function saveConversationIdToStorage(threadId: string, conversationId: string | null) {
  if (typeof window === "undefined" || !threadId) {
    return;
  }
  try {
    if (conversationId) {
      window.localStorage.setItem(getConversationStorageKey(threadId), conversationId);
    } else {
      window.localStorage.removeItem(getConversationStorageKey(threadId));
    }
  } catch {
    // ignore write errors
  }
}
