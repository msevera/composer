import cssText from "data-text:~style.css";
import type { PlasmoCSConfig } from "plasmo";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Loader2, RotateCcw, Square } from "lucide-react";
import { toast, Toaster } from "sonner";

import { authClient } from "./lib/better-auth-client";
import { Button } from "./components/ui/button";
import {
	COMPOSE_DRAFT_AGENT_MUTATION,
	RESUME_DRAFT_COMPOSITION_MUTATION,
} from "./lib/graphql/composition";
import { apolloClient } from "./lib/apollo-client";
import { cn } from "./lib/utils";

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
	const [isRunning, setIsRunning] = useState(false);
	const [activityMessage, setActivityMessage] = useState<string | null>(null);
	const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
	const [draftContent, setDraftContent] = useState<string | null>(null);
	const [agentMessages, setAgentMessages] = useState<
		Array<{ id: string; text: string; kind: "info" | "draft" }>
	>([]);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [threadId, setThreadId] = useState<string | undefined>(() => getThreadIdFromDom());
  const isThreadView = useIsGmailThreadView();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

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
		const updateThreadContext = () => {
			const id = getThreadIdFromDom();
			setThreadId(id);
			if (id) {
				const storedConversation = safeLocalStorageGet(id);
				setConversationId(storedConversation);
			} else {
				setConversationId(null);
			}
		};

		updateThreadContext();

		if (!isThreadView) {
			return;
		}

		const observer = new MutationObserver(() => updateThreadContext());
		observer.observe(document.body, { childList: true, subtree: true });
		window.addEventListener("hashchange", updateThreadContext);
		window.addEventListener("popstate", updateThreadContext);

		return () => {
			observer.disconnect();
			window.removeEventListener("hashchange", updateThreadContext);
			window.removeEventListener("popstate", updateThreadContext);
		};
	}, [isThreadView]);

  const shouldRender = useMemo(
		() => Boolean(!isPending && session && isThreadView && threadId),
		[isPending, isThreadView, session, threadId],
  );

	const handleAgentResponse = useCallback(
		(response: Record<string, any>) => {
			if (!response) {
				throw new Error("Invalid response from composer agent");
			}

			const nextConversationId = response.conversationId ?? null;
			if (threadId && nextConversationId) {
				safeLocalStorageSet(threadId, nextConversationId);
			}
			setConversationId(nextConversationId);

			const latestActivity = getLatestActivity(response.activity);
			setActivityMessage(latestActivity);

			const hasFailure = activityHasFailure(response.activity);
			const questionText = "question" in response ? response.question : undefined;
			const draftText = "draftContent" in response ? response.draftContent : undefined;
			const isDraftResponse =
				response.status === "DRAFT_READY" &&
				Boolean(draftText) &&
				!hasFailure &&
				looksLikeDraft(draftText ?? "");
			const displayText = draftText ?? questionText ?? "";

			if (questionText) {
				setClarificationQuestion(questionText);
				setDraftContent(null);
				toast.message("Agent needs clarification");
			} else if (isDraftResponse && draftText) {
				setClarificationQuestion(null);
				setDraftContent(draftText);
				toast.success("Draft ready");
			} else {
				setClarificationQuestion(null);
				setDraftContent(null);
			}

			if (displayText && (!questionText || isDraftResponse)) {
				setAgentMessages((prev) => [
					...prev,
					{
						id: generateMessageId(),
						text: displayText,
						kind: isDraftResponse ? "draft" : "info",
					},
				]);
			}

			if (!questionText && !isDraftResponse) {
				setActivityMessage(latestActivity ?? "Agent idle.");
			}

			setMessage("");
		},
		[threadId],
	);

	const handleSubmit = useCallback(
		async (event?: FormEvent<HTMLFormElement>) => {
			event?.preventDefault();
			if (isRunning) {
				return;
			}

    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (!threadId) {
				toast.error("Unable to find the Gmail thread. Please refresh and try again.");
      return;
    }

			const isClarification = Boolean(clarificationQuestion && conversationId);
			setIsRunning(true);
			setActivityMessage(isClarification ? "Sending clarification…" : "Starting agent…");

			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			try {
				const variables = isClarification
					? {
							input: {
								conversationId: conversationId!,
								userResponse: message.trim(),
							},
					  }
					: {
          input: {
								userPrompt: message.trim(),
            threadId,
								conversationId: conversationId ?? undefined,
							},
					  };

				const { data } = await apolloClient.mutate({
					mutation: isClarification
						? RESUME_DRAFT_COMPOSITION_MUTATION
						: COMPOSE_DRAFT_AGENT_MUTATION,
					variables,
					context: {
						fetchOptions: {
							signal: abortController.signal,
          },
        },
      });

				const response = isClarification
					? data?.resumeDraftComposition
					: data?.composeDraftWithAgent;
				handleAgentResponse(response);
    } catch (error) {
				if ((error as Error)?.name === "AbortError") {
					toast.message("Agent stopped");
					return;
				}
				const messageText =
        error instanceof Error ? error.message : "Failed to compose draft. Please try again.";
				toast.error(messageText);
    } finally {
				setIsRunning(false);
				abortControllerRef.current = null;
			}
		},
		[
			clarificationQuestion,
			conversationId,
			handleAgentResponse,
			isRunning,
			message,
			threadId,
		],
	);

	const handleStop = useCallback(() => {
		abortControllerRef.current?.abort();
		abortControllerRef.current = null;
		setIsRunning(false);
		setActivityMessage("Stopped by user.");
	}, []);

	const handleReset = useCallback(() => {
		if (isRunning) {
			handleStop();
		}
		setConversationId(null);
		setActivityMessage(null);
		setClarificationQuestion(null);
		setDraftContent(null);
		setAgentMessages([]);
		setMessage("");
		if (threadId) {
			safeLocalStorageRemove(threadId);
		}
		toast.message("Conversation reset");
	}, [handleStop, isRunning, threadId]);

	const handleCopyDraft = useCallback(async () => {
		if (!draftContent) {
			return;
		}
		try {
			await navigator.clipboard.writeText(draftContent);
			toast.success("Draft copied to clipboard");
		} catch (error) {
			const messageText =
				error instanceof Error ? error.message : "Unable to copy draft. Please copy manually.";
			toast.error(messageText);
		}
	}, [draftContent]);

	if (!shouldRender) {
		return null;
	}

  return (
    <>
      <Toaster position="top-center" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[2147483646] flex justify-center px-4 pb-5">
        <form
          onSubmit={handleSubmit}
					className="pointer-events-auto w-full max-w-xl rounded-3xl bg-black/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
        >
					<div className="mb-3 flex items-center justify-between">
						<p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Snail Composer</p>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-300 hover:text-white"
							onClick={handleReset}
						>
							<RotateCcw className="mr-1 h-3 w-3" />
							Reset
						</Button>
					</div>

					<div className="space-y-3 text-sm text-neutral-200">
						{activityMessage && (
							<div className="flex items-center gap-2 rounded-2xl bg-white/5 p-3 text-xs text-neutral-200">
								<span className="h-2 w-2 rounded-full bg-emerald-300" />
								<span>{activityMessage}</span>
							</div>
						)}

						{agentMessages.length > 0 && (
							<div className="space-y-2 text-xs text-neutral-100">
								{agentMessages.map((messageEntry) => (
									<div
										key={messageEntry.id}
										className="rounded-2xl border border-white/5 bg-white/5 px-3 py-2"
									>
										{messageEntry.text}
									</div>
								))}
							</div>
						)}

						{clarificationQuestion && (
							<div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
								<p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">
									Clarification Needed
								</p>
								<p className="mt-1">{clarificationQuestion}</p>
							</div>
						)}

						{draftContent && (
							<div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-100">
								<div className="mb-2 flex items-center justify-between">
									<p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">
										Draft Output
									</p>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-100 hover:text-white"
										onClick={handleCopyDraft}
									>
										<Copy className="mr-1 h-3 w-3" />
										Copy
									</Button>
								</div>
								<pre className="whitespace-pre-wrap text-xs text-neutral-100">{draftContent}</pre>
							</div>
						)}
					</div>

					<div className="mt-4 flex w-full items-end gap-2 rounded-2xl bg-gradient-to-r from-stone-900 via-black to-stone-900 px-3 py-3">
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
							placeholder={
								clarificationQuestion
									? "Answer the agent's question..."
									: "Tell the agent what you need"
							}
              className="max-h-40 min-h-[21px] flex-1 resize-none border-none bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none"
            />
            <Button
							type={isRunning ? "button" : "submit"}
							onClick={isRunning ? handleStop : undefined}
							disabled={!message.trim() && !isRunning}
              size="sm"
							className={cn(
								"self-end h-9 rounded-full px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition",
								isRunning ? "bg-red-500/80 hover:bg-red-500" : "bg-white/10 hover:bg-white/20",
							)}
            >
							{isRunning ? (
                <>
									<Square className="mr-2 h-3.5 w-3.5" />
									Stop
                </>
              ) : (
								<>
									<Loader2 className="mr-2 h-3.5 w-3.5 opacity-0" />
									Send
								</>
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

function safeLocalStorageGet(threadId: string) {
	try {
		return window.localStorage.getItem(getConversationStorageKey(threadId));
	} catch {
		return null;
	}
}

function safeLocalStorageSet(threadId: string, conversationId: string) {
	try {
		window.localStorage.setItem(getConversationStorageKey(threadId), conversationId);
	} catch {
		// ignore write errors
	}
}

function safeLocalStorageRemove(threadId: string) {
	try {
		window.localStorage.removeItem(getConversationStorageKey(threadId));
	} catch {
		// ignore remove errors
	}
}

function getConversationStorageKey(threadId: string) {
	return `snail-conversation-${threadId}`;
}

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
