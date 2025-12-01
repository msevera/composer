'use client';
import React, { useState, useEffect, useRef } from 'react';

const USER_INPUT = 'Hey John, of course!';
const DRAFT_TEXT = `Hi John,\n\nGreat to hear from you! I've attached the project timeline we went over.\n\nLet me know if you have any questions or need any adjustments. Looking forward to moving this forward together.\n\nBest,\nMike`;

// Animation timing constants
const TYPEWRITER_DELAY = 100; // ms per character
const COMPOSE_BLINK_DURATION = 400; // ms
const LOADER_DURATION = 1000; // ms
const DRAFT_FADE_DURATION = 1000; // ms
const RESET_DELAY = 4000; // ms before restarting

export default function ComposerAIDemo() {
  const [inputText, setInputText] = useState(''); // Text in the input field
  const [messageBubbleText, setMessageBubbleText] = useState(''); // Text in the message bubble
  const [showComposeBlink, setShowComposeBlink] = useState(false);
  const [showDraftBubble, setShowDraftBubble] = useState(false); // Show draft bubble section
  const [showLoader, setShowLoader] = useState(false); // Show loader inside draft bubble
  const [showDraft, setShowDraft] = useState(false); // Show actual draft text
  const timersRef = useRef<Array<NodeJS.Timeout | number>>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const clearAllTimers = () => {
      timersRef.current.forEach(timer => {
        clearTimeout(timer as NodeJS.Timeout);
        clearInterval(timer as NodeJS.Timeout);
      });
      timersRef.current = [];
    };

    const runAnimationSequence = () => {
      if (!isMountedRef.current) return;

      clearAllTimers();

      // Reset all states
      setInputText('');
      setMessageBubbleText('');
      setShowComposeBlink(false);
      setShowDraftBubble(false);
      setShowLoader(false);
      setShowDraft(false);

      // Calculate timing
      const typewriterDuration = USER_INPUT.length * TYPEWRITER_DELAY;
      const composeStartTime = typewriterDuration + 300; // Small delay after typing
      const messageBubbleTime = composeStartTime + COMPOSE_BLINK_DURATION + 200; // Show message bubble after compose
      const draftBubbleTime = messageBubbleTime + 300; // Show draft bubble after message bubble
      const loaderStartTime = draftBubbleTime + 200; // Show loader immediately when draft bubble appears
      const draftStartTime = loaderStartTime + LOADER_DURATION;
      const resetTime = draftStartTime + DRAFT_FADE_DURATION + RESET_DELAY;

      // 1. Typewriter effect in input field
      let charIndex = 0;
      const typewriterInterval = setInterval(() => {
        if (!isMountedRef.current) {
          clearInterval(typewriterInterval);
          return;
        }
        if (charIndex < USER_INPUT.length) {
          setInputText(USER_INPUT.substring(0, charIndex + 1));
          charIndex++;
        } else {
          clearInterval(typewriterInterval);
        }
      }, TYPEWRITER_DELAY);
      timersRef.current.push(typewriterInterval);

      // 2. Compose button blink
      const composeTimer1 = setTimeout(() => {
        if (isMountedRef.current) {
          setShowComposeBlink(true);
          const composeTimer2 = setTimeout(() => {
            if (isMountedRef.current) {
              setShowComposeBlink(false);
            }
          }, COMPOSE_BLINK_DURATION);
          timersRef.current.push(composeTimer2);
        }
      }, composeStartTime);
      timersRef.current.push(composeTimer1);

      // 3. Clear input and show message bubble
      const messageBubbleTimer = setTimeout(() => {
        if (isMountedRef.current) {
          setInputText('');
          setMessageBubbleText(USER_INPUT);
        }
      }, messageBubbleTime);
      timersRef.current.push(messageBubbleTimer);

      // 4. Show draft bubble with loader
      const draftBubbleTimer = setTimeout(() => {
        if (isMountedRef.current) {
          setShowDraftBubble(true);
          setShowLoader(true);
        }
      }, draftBubbleTime);
      timersRef.current.push(draftBubbleTimer);

      // 5. Show draft text (hide loader, show draft)
      const draftTimer = setTimeout(() => {
        if (isMountedRef.current) {
          setShowLoader(false);
          setShowDraft(true);
        }
      }, draftStartTime);
      timersRef.current.push(draftTimer);

      // 6. Reset and loop
      const resetTimer = setTimeout(() => {
        if (isMountedRef.current) {
          // Small delay before restarting
          const loopTimer = setTimeout(() => {
            if (isMountedRef.current) {
              runAnimationSequence();
            }
          }, 500);
          timersRef.current.push(loopTimer);
        }
      }, resetTime);
      timersRef.current.push(resetTimer);
    };

    // Start the animation sequence
    runAnimationSequence();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      clearAllTimers();
    };
  }, []); // Empty dependency array - only run on mount

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-blue-900/20 to-violet-900/20 rounded-3xl p-4 border border-blue-500/20">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-[0.3em] text-gray-300 text-neutral-400">Composer AI</span>
        </div>
        <div className="flex flex-col gap-2">
          {/* User Message Bubble Section */}
          {messageBubbleText && (
            <div className="self-end mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">You</div>
              </div>
              <div className="whitespace-pre-wrap text-xs text-neutral-100 rounded-xl p-4 border border-blue-500/20">
                {messageBubbleText}
              </div>
            </div>
          )}

          {/* Draft Section - Only appears after compose button click */}
          {showDraftBubble && (
            <div className="rounded-xl p-4 border border-blue-500/20 min-h-[8rem]">
              <div className="flex items-center mb-4 gap-2">
                <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">DRAFT</div>
                {showDraft && (
                  <span className="text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">
                    Generated
                  </span>
                )}
              </div>

              {showLoader ? (
                <div className="space-y-3">
                  {/* Skeleton lines that mimic the draft message structure */}
                  {[
                    { width: '60%' }, // "Hi John,"
                    // { width: '100%' }, // "Hi John,"
                    { width: '85%' }, // "Great to hear from you! I've attached..."
                    // { width: '100%' }, // "Hi John,"
                    { width: '90%' }, // "Let me know if you have any questions..."

                    { width: '40%' }, // "Best,"
                    { width: '25%' }, // "Mike"
                  ].map((line, index) => (
                    <div
                      key={index}
                      className="h-3 rounded bg-gray-700/50"
                      style={{ width: line.width }}
                    />
                  ))}
                </div>
              ) : showDraft ? (
                <pre className="whitespace-pre-wrap text-xs text-neutral-100">
                  {DRAFT_TEXT}
                </pre>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {/* Bottom Section with Input Field and Compose Button */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex-1 text-sm text-gray-400 relative">
          <div className="absolute inset-0 flex items-center">
            {!inputText && (
              <span className="text-gray-500">Write anything (optional)</span>
            )}
          </div>
          <div className="relative min-h-[1.5rem] flex items-center">
            {inputText}
          </div>
        </div>
        <div className="text-sm text-gray-400 p-2 px-4 rounded-full bg-blue-500/20 text-[11px] font-semibold uppercase tracking-[0.2em] ml-4">
          Compose
        </div>
      </div>
    </div>
  );
}

