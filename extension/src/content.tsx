import cssText from "data-text:~style.css";
import type { PlasmoCSConfig } from "plasmo";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, RotateCcw, Square, Check, Minimize2, Maximize2 } from "lucide-react";

import { authClient } from "./lib/better-auth-client";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";
import { apolloClient } from "./lib/apollo-client";
import { ApolloProvider, useQuery, useMutation } from "@apollo/client";
import { GET_CONVERSATION_STATE_QUERY, COPY_DRAFT_MUTATION } from "./lib/graphql/composition";
import { fetchEventSource } from '@microsoft/fetch-event-source';

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
  `${process.env.PLASMO_PUBLIC_API_URL}/graphql`;
const API_BASE_URL = GRAPHQL_ENDPOINT.replace(/\/graphql$/i, "");
const COMPOSITION_STREAM_URL = `${API_BASE_URL}/composition/stream`;
const WEBSITE_URL = process.env.PLASMO_PUBLIC_WEB_URL;
const requiredGmailScopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const App = () => {
  const { data: session, isPending } = authClient.useSession();
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [agentMessages, setAgentMessages] = useState<
    Array<{ id: string; text: string; kind: "user" | "draft" }>
  >([]);
  const [draftIndicator, setDraftIndicator] = useState<string | null>(null);
  const isThreadView = useIsGmailThreadView();
  const gmailThreadId = useGmailThreadId();
  const currentGmailEmail = useCurrentGmailAccountEmail();
  const [isMinimized, setIsMinimized] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentDraftMessageIdRef = useRef<string | null>(null);
  const lastStreamedDraftIdRef = useRef<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<ComposeStreamEvent[]>([]);
  const [hasRequiredGmailScopes, setHasRequiredGmailScopes] = useState(false);
  const [isCheckingGmailScopes, setIsCheckingGmailScopes] = useState(false);
  const [isCurrentAccountConnected, setIsCurrentAccountConnected] = useState(false);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    const element = textareaRef.current;
    element.style.height = "auto";
    const nextHeight = Math.max(element.scrollHeight, MIN_TEXTAREA_HEIGHT);
    element.style.height = `${nextHeight}px`;
  }, [message]);


  const threadId = useMemo(() => {
    return gmailThreadId;
  }, [gmailThreadId]);

  const conversationId = useMemo(() => {
    if (!threadId) {
      return null;
    }

    return getConversationIdFromStorage(threadId);
  }, [threadId])

  const { data: conversationStateData } = useQuery(GET_CONVERSATION_STATE_QUERY, {
    variables: {
      conversationId
    },
    skip: !threadId || !conversationId,
  });

  const [copyDraft] = useMutation(COPY_DRAFT_MUTATION);

  useEffect(() => {
    if (!conversationId) {
      setAgentMessages([]);
      return;
    }

    if (conversationStateData?.getConversationState?.exists && conversationStateData.getConversationState.messages) {
      // Load conversation history
      const messages = conversationStateData.getConversationState.messages.map((msg: any) => ({
        id: generateMessageId(),
        text: msg.content,
        kind: msg.kind as "user" | "draft",
      }));
      setAgentMessages(messages);
    }
  }, [conversationStateData, conversationId])

  useEffect(() => {
    let isActive = true;

    const verifyGmailScopes = async () => {
      if (!session) {
        if (isActive) {
          setHasRequiredGmailScopes(false);
          setIsCheckingGmailScopes(false);
          setIsCurrentAccountConnected(false);
        }
        return;
      }

      if (isActive) {
        setIsCheckingGmailScopes(true);
      }

      try {
        const accounts = await authClient.listAccounts();
        const accountList = accounts.data ?? [];

        // Find the current Gmail account in the list
        const currentAccount = currentGmailEmail
          ? accountList.find(
            (account: any) =>
              account.providerId === "google" &&
              (account.email === currentGmailEmail ||
                account.accountEmail === currentGmailEmail)
          )
          : null;

        const currentAccountInList = Boolean(currentAccount);

        if (isActive) {
          setIsCurrentAccountConnected(currentAccountInList);
          setCurrentAccountId(currentAccount?.id || null);
        }

        // Find Gmail account with required scopes
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
          setIsCurrentAccountConnected(false);
          setCurrentAccountId(null);
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
  }, [session, currentGmailEmail]);

  const shouldRender = useMemo(
    () =>
      Boolean(
        !isPending &&
        !isCheckingGmailScopes &&
        session &&
        hasRequiredGmailScopes &&
        isThreadView &&
        threadId,
      ),
    [
      hasRequiredGmailScopes,
      isCheckingGmailScopes,
      isPending,
      isThreadView,
      threadId,
      session,
    ],
  );

  const shouldRenderConnectAccount = useMemo(
    () =>
      Boolean(
        !isPending &&
        !isCheckingGmailScopes &&
        session &&
        isThreadView &&
        threadId &&
        !isCurrentAccountConnected,
      ),
    [
      isCheckingGmailScopes,
      isPending,
      isThreadView,
      threadId,
      session,
      isCurrentAccountConnected,
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

  // Load minimized state when account ID changes
  useEffect(() => {
    if (currentAccountId) {
      const savedState = getSavedMinimizedState(currentAccountId);
      setIsMinimized(savedState);
    } else {
      setIsMinimized(false);
    }
  }, [currentAccountId]);

  // Persist minimized state when it changes
  useEffect(() => {
    if (currentAccountId !== null) {
      persistMinimizedState(isMinimized, currentAccountId);
    }
  }, [isMinimized, currentAccountId]);

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
          setErrorMessages((prev) => [...prev, event]);
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
        case "start":
          saveConversationIdToStorage(event.payload.threadId, event.payload.conversationId);
          break;
        case "error":
          console.error(event.message);
          closeEventSource();
          setDraftIndicator(null);
          setErrorMessages((prev) => [...prev, event]);
          setIsRunning(false);
          break;
        case "final":
          closeEventSource();
          setDraftIndicator(null);
          setIsRunning(false);
          break;
        default:
          break;
      }
    },
    [closeEventSource],
  );

  const startStream = useCallback(
    async (inputText: string) => {
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

      const session = await authClient.getSession();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session?.data?.session?.token}`
      };

      // Get accountId by matching email with listAccounts
      if (currentGmailEmail) {
        try {
          const accounts = await authClient.listAccounts();
          const accountList = accounts.data ?? [];
          const gmailAccount = accountList.find(
            (account: any) =>
              account.providerId === "google" &&
              (account.email === currentGmailEmail ||
                account.accountEmail === currentGmailEmail)
          );

          if (gmailAccount?.accountId) {
            headers['X-Account-Id'] = gmailAccount.id;
          }
        } catch (error) {
          console.error("Failed to get accountId for email", error);
        }
      }

      fetchEventSource(`${COMPOSITION_STREAM_URL}?${params.toString()}`, {
        headers,
        onmessage(event) {
          try {
            const payload = JSON.parse(event.data) as ComposeStreamEvent;
            handleStreamEvent(payload);
          } catch (error) {
            console.error(error);
          }
        },
        onerror() {
          closeEventSource();
          setIsRunning(false);
          console.error("Stream interrupted. Please try again.");
        }
      })
    },
    [handleStreamEvent, closeEventSource, currentGmailEmail],
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

      // Track Copy event in Segment
      try {
        await copyDraft({
          variables: {
            threadId: threadId || null,
            conversationId: conversationId || null,
          },
        });
      } catch (trackError) {
        // Don't fail the copy operation if tracking fails
        console.error("Failed to track copy event:", trackError);
      }
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Unable to copy draft. Please copy manually.";
      console.log(messageText);
    }
  }, [threadId, conversationId, copyDraft]);

  const handleConnectAccount = useCallback(() => {
    window.open(`${WEBSITE_URL}/dashboard`, "_blank");
  }, []);

  if (!shouldRender && !shouldRenderConnectAccount) {
    return null;
  }

  // Render Connect Account CTA when account is not connected
  if (shouldRenderConnectAccount) {
    if (isMinimized) {
      return (
        <div className="pointer-events-none fixed bottom-4 left-4 z-[2147483646] flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-[28px] bg-stone-900/95 px-4 py-2 pr-2 text-neutral-100 shadow-lg shadow-black/60">
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
   
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[2147483646] flex justify-center px-4 pb-5">
        <div className="pointer-events-auto w-full max-w-xl rounded-[28px] bg-stone-900 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Composer ai</p>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="ghost" className="text-neutral-500" onClick={handleMinimize}>
                <Minimize2 className="h-4 w-4" />
                minimize
              </Button>
            </div>
          </div>
          <div className="px-4 pb-4">           
            <p className="text-sm text-neutral-200 mb-4">
              Connect your Gmail account to start composing emails with AI.
            </p>
            <Button
              type="button"
              onClick={handleConnectAccount}
              variant="default"
              size="sm"
              className="w-full"
            >
              Connect Account
            </Button>
          </div>
        </div>
      </div>
    );
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
          {(agentMessages.length > 0 || isRunning || errorMessages.length > 0) && (
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
            agentMessages.length > 0 || draftIndicator || errorMessages.length > 0 ? "p-4 pt-0" : "p-0",
          )}
        >
          {(agentMessages.length > 0 || draftIndicator) && (
            <div className="space-y-2 text-xs text-neutral-100 flex flex-col">
              {agentMessages.map((messageEntry) =>
                messageEntry.kind === "user" ? (
                  <div
                    key={messageEntry.id}
                    className="self-end rounded-2xl border border-white/10 p-3 whitespace-pre-wrap bg-neutral-700 text-neutral-100 text-xs leading-5"
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
              {errorMessages.map((error, index) => error.type === 'error' && error.key === 'draft-limit-reached' ? (
                <div
                  key={`error-${index}`}
                >
                  {
                    error.title && (
                      <p dangerouslySetInnerHTML={{ __html: error.title }} className="text-xs text-white/60 mb-4 p-4 rounded-2xl border border-green-500/30 bg-green-500/10 text-green-100" />
                    )
                  }
                  <DraftBubble
                    key={error.key}
                    text={error.message}
                    copied={copiedDraftId === error.key}
                    onCopy={() => void handleCopyDraft(error.message, error.key)}
                    className="rounded-2xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-green-100"
                  />
                </div>
              ) : (
                <div
                  key={`error-${index}`}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-100"
                >
                  {error.message}
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
  className?: string;
}

const DraftBubble = ({ text, onCopy, indicator, copied, className }: DraftBubbleProps) => {
  const hasDraftText = Boolean(text);
  const indicatorLabel = indicator ?? "Preparing draft…";
  const showCopyButton = hasDraftText && onCopy;

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-100", className)}>
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
                ? "bg-emerald-500/60 text-emerald-100 hover:bg-emerald-500/60 hover:text-emerald-100"
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


const Root = () => {
  return (
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  );
};

export default Root;

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


function useGmailThreadId() {
  const [threadId, setThreadId] = useState(() => getThreadIdFromDom());

  useEffect(() => {
    const updateThreadId = () => setThreadId(getThreadIdFromDom());

    window.addEventListener("hashchange", updateThreadId);
    window.addEventListener("popstate", updateThreadId);

    const observer = new MutationObserver(() => {
      updateThreadId();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("hashchange", updateThreadId);
      window.removeEventListener("popstate", updateThreadId);
      observer.disconnect();
    };
  }, []);

  return threadId;
}

function useCurrentGmailAccountEmail() {
  const [email, setEmail] = useState(() => getCurrentGmailAccountEmail());

  useEffect(() => {
    const updateEmail = () => setEmail(getCurrentGmailAccountEmail());

    window.addEventListener("hashchange", updateEmail);
    window.addEventListener("popstate", updateEmail);

    const observer = new MutationObserver(() => {
      updateEmail();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("hashchange", updateEmail);
      window.removeEventListener("popstate", updateEmail);
      observer.disconnect();
    };
  }, []);

  return email;
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

function getCurrentGmailAccountEmail(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  // Try to find the email from Gmail's account switcher/profile area
  // Gmail stores account info in various places
  const accountSelectors = [
    'a[aria-label*="@"]', // Account switcher link
    '[data-ogab]', // Gmail account badge
    'div[data-email]', // Element with email data attribute
  ];

  for (const selector of accountSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const email = element.getAttribute('aria-label') ||
        element.getAttribute('data-email') ||
        element.textContent?.trim();
      if (email && email.includes('@')) {
        // Extract email from text if it contains other text
        const emailMatch = email.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          return emailMatch[0];
        }
      }
    }
  }

  // Try to get from Gmail's internal state (if accessible)
  try {
    const gmailData = (window as any).gmonkey?.data;
    if (gmailData?.userEmail) {
      return gmailData.userEmail;
    }
  } catch (e) {
    // Gmail API not available
  }

  // Try to extract from URL if it contains account info
  const urlParams = new URLSearchParams(window.location.search);
  const accountParam = urlParams.get('authuser');
  if (accountParam !== null) {
    // If we have multiple accounts, we might need to check which one is active
    // For now, we'll try to get it from the DOM
  }

  // Last resort: try to find any email-like text in the account area
  const accountArea = document.querySelector('[role="banner"]') ||
    document.querySelector('[data-testid="account-switcher"]');
  if (accountArea) {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    const emailMatch = accountArea.textContent?.match(emailRegex);
    if (emailMatch) {
      return emailMatch[0];
    }
  }

  return null;
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
  | { type: "start"; payload: { conversationId: string; threadId: string } }
  | { type: "final"; payload: Record<string, any> }
  | { type: "error"; key: string; message: string };


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

function getMinimizedStorageKey(accountId: string) {
  return `composerai-composer-minimized-${accountId}`;
}

function getSavedMinimizedState(accountId: string | null): boolean {
  if (typeof window === "undefined" || !accountId) {
    return false;
  }
  try {
    return window.localStorage.getItem(getMinimizedStorageKey(accountId)) === "true";
  } catch {
    return false;
  }
}

function persistMinimizedState(value: boolean, accountId: string | null) {
  if (typeof window === "undefined" || !accountId) {
    return;
  }
  try {
    window.localStorage.setItem(getMinimizedStorageKey(accountId), String(value));
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
