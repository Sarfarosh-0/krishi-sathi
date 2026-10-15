"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatHeader from "@/components/ChatHeader";
import ChipRow from "@/components/ChipRow";
import Composer from "@/components/Composer";
import DashboardModal from "@/components/DashboardModal";
import MessageList from "@/components/MessageList";
import Toast from "@/components/Toast";
import {
  answerWithAdvisory,
  EMPTY_HISTORY,
  EMPTY_IMPACT,
  HISTORY_KEY,
  HISTORY_LIMIT,
  IMPACT_KEY,
  newMessageId,
  sourcesFromIds,
  type ChatMessage,
} from "@/lib/chat";
import { useLang } from "@/lib/hooks/useLang";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useSpeech } from "@/lib/hooks/useSpeech";
import { UI_STRINGS } from "@/lib/ui-strings";
import type {
  AskErrorBody,
  HistoryEntry,
  ImpactStats,
  KBSource,
  Lang,
  StreamEvent,
} from "@/lib/types";

const MAX_QUESTION_CHARS = 500;

/** Parse one NDJSON line; ignore anything that is not a stream event. */
function parseEvent(line: string): StreamEvent | null {
  try {
    const parsed = JSON.parse(line) as StreamEvent;
    return parsed && typeof parsed === "object" && "type" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [lang, setLang] = useLang();
  const strings = UI_STRINGS[lang];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "amber" | "danger" } | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // Device-local impact + history (FR12). Caps/try-catch live in the hook.
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>(HISTORY_KEY, EMPTY_HISTORY);
  const [impact, setImpact] = useLocalStorage<ImpactStats>(IMPACT_KEY, EMPTY_IMPACT);

  const abortRef = useRef<AbortController | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardButtonRef = useRef<HTMLButtonElement>(null);
  const { supported: speechSupported, speakingKey, toggle: toggleSpeech, stop: stopSpeech } =
    useSpeech();

  // Warm the serverless function on load (PRD §9, DESIGN §5) — no state, no key.
  useEffect(() => {
    void fetch("/api/health").catch(() => {});
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    []
  );

  const showToast = useCallback((message: string, tone: "amber" | "danger") => {
    setToast({ message, tone });
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const updateMessage = useCallback(
    (
      id: string,
      patch: Partial<ChatMessage> | ((current: ChatMessage) => Partial<ChatMessage>)
    ) => {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === id
            ? { ...message, ...(typeof patch === "function" ? patch(message) : patch) }
            : message
        )
      );
    },
    []
  );

  const send = useCallback(
    async (rawQuestion: string, forcedLang?: Lang) => {
      const question = rawQuestion.trim().slice(0, MAX_QUESTION_CHARS);
      if (!question || abortRef.current) {
        return;
      }
      const messageLang = forcedLang ?? lang;
      const contentStrings = UI_STRINGS[messageLang];

      stopSpeech(); // a new answer cancels any read-aloud
      setDraft("");

      // A question was asked from this device — count it even if the answer
      // later fails (FR12; honesty: "asked", not "answered").
      setImpact((current) => ({ ...current, asked: current.asked + 1, lastTs: Date.now() }));

      const assistantId = newMessageId();
      setMessages((previous) => [
        ...previous,
        {
          id: `${assistantId}-q`,
          role: "user",
          lang: messageLang,
          question,
          text: question,
          sources: [],
          advisory: null,
          status: "done",
        },
        {
          id: assistantId,
          role: "assistant",
          lang: messageLang,
          question,
          text: "",
          sources: [],
          advisory: null,
          status: "streaming",
        },
      ]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let terminated = false;

      // Tracked for the device-local history entry at `done` (no server storage).
      let answerText = "";
      let collectedSources: KBSource[] = [];

      const applyEvent = (event: StreamEvent) => {
        switch (event.type) {
          case "sources":
            collectedSources = event.sources;
            updateMessage(assistantId, { sources: event.sources });
            break;
          case "token":
            answerText += event.text;
            updateMessage(assistantId, (current) => ({ text: current.text + event.text }));
            break;
          case "done": {
            const refused = event.refused;
            // A refusal counts as asked + refused, never answered (FR12).
            const hasAnswer = refused || answerText.trim().length > 0;
            updateMessage(assistantId, {
              status: refused ? "refused" : "done",
              advisory: event.advisory,
            });
            setImpact((current) => ({
              ...current,
              answered: current.answered + (!refused && hasAnswer ? 1 : 0),
              refused: current.refused + (refused ? 1 : 0),
            }));
            if (hasAnswer) {
              const entry: HistoryEntry = {
                id: assistantId,
                q: question,
                answer: answerWithAdvisory(answerText, event.advisory),
                sources: collectedSources.map((source) => source.id),
                lang: messageLang,
                ts: Date.now(),
                refused,
              };
              // Newest first, oldest dropped past the cap of 50.
              setHistory((current) => [entry, ...current].slice(0, HISTORY_LIMIT));
            }
            break;
          }
          case "error":
            updateMessage(assistantId, { status: "upstream" });
            break;
        }
      };

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question, lang: messageLang }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // Pre-stream failures are plain JSON (DESIGN §5).
          let body: AskErrorBody | null = null;
          try {
            body = (await response.json()) as AskErrorBody;
          } catch {
            /* non-JSON error body */
          }
          if (response.status === 429 && body?.error === "rate_limit") {
            showToast(contentStrings.rateLimitToast, "amber");
          }
          updateMessage(assistantId, { status: "upstream" });
          return;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("x-ndjson") || !response.body) {
          updateMessage(assistantId, { status: "upstream" });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line) {
              const event = parseEvent(line);
              if (event) {
                applyEvent(event);
                if (event.type === "done" || event.type === "error") {
                  terminated = true;
                }
              }
            }
            newline = buffer.indexOf("\n");
          }
        }

        const tail = buffer.trim();
        if (tail) {
          const event = parseEvent(tail);
          if (event) {
            applyEvent(event);
            if (event.type === "done" || event.type === "error") {
              terminated = true;
            }
          }
        }

        // A stream ending without done/error is an upstream failure (DESIGN §5).
        if (!terminated) {
          updateMessage(assistantId, { status: "upstream" });
        }
      } catch {
        if (controller.signal.aborted) {
          // User pressed stop: keep a partial answer, drop an empty placeholder.
          setMessages((previous) => {
            const target = previous.find((message) => message.id === assistantId);
            if (!target || target.text.length === 0) {
              return previous.filter((message) => message.id !== assistantId);
            }
            return previous.map((message) =>
              message.id === assistantId ? { ...message, status: "stopped" } : message
            );
          });
        } else {
          updateMessage(assistantId, { status: "upstream" });
          showToast(contentStrings.offlineToast, "danger");
        }
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
    },
    [lang, setHistory, setImpact, showToast, stopSpeech, updateMessage]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(
    (message: ChatMessage) => {
      void send(message.question, message.lang);
    },
    [send]
  );

  // ------------------------------------------------- dashboard + history (FR12)

  const openDashboard = useCallback(() => setDashboardOpen(true), []);

  const closeDashboard = useCallback(() => {
    setDashboardOpen(false);
    dashboardButtonRef.current?.focus(); // return focus to the trigger (a11y)
  }, []);

  const deleteEntry = useCallback(
    (id: string) => {
      setHistory((current) => current.filter((entry) => entry.id !== id));
    },
    [setHistory]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  /** Replay a stored turn into the transcript — localStorage only, no network. */
  const reopenEntry = useCallback(
    (entry: HistoryEntry) => {
      stopSpeech();
      const assistantId = newMessageId();
      setMessages((previous) => [
        ...previous,
        {
          id: `${assistantId}-q`,
          role: "user",
          lang: entry.lang,
          question: entry.q,
          text: entry.q,
          sources: [],
          advisory: null,
          status: "done",
        },
        {
          id: assistantId,
          role: "assistant",
          lang: entry.lang,
          question: entry.q,
          text: entry.answer, // includes the server advisory, stored verbatim
          sources: sourcesFromIds(entry.sources, entry.lang),
          advisory: null,
          status: entry.refused ? "refused" : "done",
        },
      ]);
      setDashboardOpen(false);
    },
    [stopSpeech]
  );

  return (
    <div className="flex h-dvh flex-col">
      <ChatHeader
        lang={lang}
        strings={strings}
        onLangChange={setLang}
        onOpenDashboard={openDashboard}
        dashboardButtonRef={dashboardButtonRef}
      />
      <ChipRow
        lang={lang}
        label={strings.chipsLabel}
        disabled={loading}
        onPick={(question) => void send(question)}
      />
      <MessageList
        messages={messages}
        lang={lang}
        strings={strings}
        loading={loading}
        speechSupported={speechSupported}
        speakingKey={speakingKey}
        onToggleSpeak={toggleSpeech}
        onRetry={retry}
      />
      <Composer
        lang={lang}
        strings={strings}
        value={draft}
        loading={loading}
        onChange={setDraft}
        onSubmit={() => void send(draft)}
        onStop={stop}
      />
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      {dashboardOpen && (
        <DashboardModal
          lang={lang}
          strings={strings}
          impact={impact}
          history={history}
          onClose={closeDashboard}
          onDelete={deleteEntry}
          onClearAll={clearHistory}
          onReopen={reopenEntry}
        />
      )}
    </div>
  );
}
