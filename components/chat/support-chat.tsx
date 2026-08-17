"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useDismissOnRouteChange } from "@/hooks/use-dismiss-on-route-change";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

type ChatResponse = {
  sessionId: string;
  reply: string;
  source?: string;
  requireLogin?: boolean;
  suggestTicket?: boolean;
  ticketCategory?: "GENERAL" | "ORDER";
  ticket?: { ticketNumber: string; tatHours: number; dueAt: string };
  error?: string;
};

export function SupportChat({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const onProductDetail =
    Boolean(pathname?.startsWith("/products/")) && pathname !== "/products";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! I am Elorakart support. Ask about shipping, products, or policies. For your orders, please sign in first.",
    },
  ]);
  const [suggestTicket, setSuggestTicket] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<"GENERAL" | "ORDER">("GENERAL");
  const [requireLogin, setRequireLogin] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismissOnRouteChange(() => setOpen(false));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      const fab = document.getElementById("support-chat-fab");
      if (fab?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  async function send(message?: string) {
    const text = (message ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setSuggestTicket(false);
    setRequireLogin(false);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = (await res.json()) as ChatResponse;
      if (data.sessionId) setSessionId(data.sessionId);
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.error || "Something went wrong." },
        ]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setSuggestTicket(Boolean(data.suggestTicket));
      setTicketCategory(data.ticketCategory || "GENERAL");
      setRequireLogin(Boolean(data.requireLogin));
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    setLoading(true);
    setSuggestTicket(false);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmTicket: true,
          sessionId,
          ticketCategory,
          ticketSubject: "Chat support request",
        }),
      });
      const data = (await res.json()) as ChatResponse;
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Could not create ticket. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        id="support-chat-fab"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-sage text-white shadow-lg transition hover:bg-sage-muted",
          onProductDetail
            ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
            : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
        )}
        aria-label={open ? "Close chat" : "Open support chat"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={cn(
            "fixed right-5 z-[60] flex h-[min(560px,70vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-cream shadow-2xl",
            onProductDetail
              ? "bottom-[calc(10.25rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(6rem+env(safe-area-inset-bottom))]",
          )}
        >
          <div className="border-b border-border/50 bg-sage px-4 py-3 text-white">
            <p className="font-display text-lg">Elorakart Support</p>
            <p className="text-xs text-white/80">FAQs · products · your orders</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto bg-sage text-white"
                    : "bg-white text-foreground border border-border/40"
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <p className="text-xs text-muted px-1">Thinking…</p>
            )}
            <div ref={bottomRef} />
          </div>

          {(requireLogin || suggestTicket) && (
            <div className="flex flex-wrap gap-2 border-t border-border/40 bg-surface-low px-3 py-2">
              {requireLogin && !isLoggedIn && (
                <Button size="sm" onClick={() => signIn("google", { callbackUrl: "/" })}>
                  Sign in
                </Button>
              )}
              {suggestTicket && (
                <>
                  <Button size="sm" onClick={createTicket} disabled={loading}>
                    Create ticket
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSuggestTicket(false)}
                    disabled={loading}
                  >
                    No thanks
                  </Button>
                </>
              )}
            </div>
          )}

          <form
            className="flex items-center gap-2 border-t border-border/50 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="h-10 flex-1 rounded border border-border/50 bg-white px-3 text-sm"
              disabled={loading}
              maxLength={2000}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
