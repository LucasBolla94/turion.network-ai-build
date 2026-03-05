"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, getUser, clearSession } from "@/lib/auth-store";

const API = "/api-backend/v1";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Session {
  id: string;
  title: string;
}

interface ParsedFile {
  path: string;
  lang: string;
  content: string;
}

// ── Parse code blocks from AI response ──────────────────
function parseFiles(content: string): ParsedFile[] {
  const regex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
  const files: ParsedFile[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    files.push({ lang: match[1], path: match[2].trim(), content: match[3] });
  }
  return files;
}

// ── Build preview HTML from parsed files ────────────────
function buildPreview(files: ParsedFile[]): string {
  const html = files.find(f => f.path.endsWith(".html"))?.content ?? "";
  const css  = files.find(f => f.path.endsWith(".css"))?.content ?? "";
  const js   = files.find(f => f.path.endsWith(".js"))?.content ?? "";

  if (!html) return "";

  return html
    .replace("</head>", `<style>${css}</style></head>`)
    .replace("</body>", `<script>${js}</script></body>`);
}

// ── Render message content with code blocks ──────────────
function MessageContent({ content, streaming }: { content: string; streaming?: boolean }) {
  const parts = content.split(/(```[\w]*:[^\n]*\n[\s\S]*?```)/g);

  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        const match = part.match(/```(\w+):([^\n]+)\n([\s\S]*?)```/);
        if (match) {
          return (
            <div key={i} className="rounded-xl overflow-hidden border border-[var(--border)]">
              <div className="flex items-center justify-between px-4 py-2 bg-[var(--background)] border-b border-[var(--border)]">
                <span className="text-xs text-[var(--muted)] font-mono">{match[2].trim()}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(match[3])}
                  className="text-xs text-[var(--muted)] hover:text-white transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-xs font-mono text-green-300 bg-[#0d1117] leading-relaxed">
                <code>{match[3]}</code>
              </pre>
            </div>
          );
        }
        if (!part.trim()) return null;
        return (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)]">
            {part}
            {streaming && i === parts.length - 1 && (
              <span className="inline-block w-1.5 h-4 bg-[var(--brand)] ml-0.5 animate-pulse rounded-sm" />
            )}
          </p>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function BuilderPage() {
  const router = useRouter();
  const user = getUser();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "preview" | "files">("chat");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewFiles, setPreviewFiles] = useState<ParsedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ParsedFile | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auth guard
  useEffect(() => {
    if (!getToken()) { clearSession(); router.replace("/login"); }
  }, [router]);

  // Load sessions
  useEffect(() => {
    fetchSessions();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update preview from last assistant message
  useEffect(() => {
    const last = [...messages].reverse().find(m => m.role === "assistant" && !m.streaming);
    if (last) {
      const files = parseFiles(last.content);
      setPreviewFiles(files);
      setPreviewHtml(buildPreview(files));
      if (files.length > 0 && !selectedFile) setSelectedFile(files[0]);
    }
  }, [messages]);

  async function fetchSessions() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${API}/builder/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSessions(data);
    }
  }

  async function createSession() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${API}/builder/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: "New App" }),
    });
    if (res.ok) {
      const session = await res.json();
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
      setPreviewHtml("");
      setPreviewFiles([]);
      setSelectedFile(null);
    }
  }

  async function loadSession(session: Session) {
    const token = getToken();
    if (!token) return;
    setActiveSession(session);
    setPreviewHtml("");
    setPreviewFiles([]);
    setSelectedFile(null);

    const res = await fetch(`${API}/builder/sessions/${session.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data: Message[] = await res.json();
      setMessages(data);
    }
  }

  async function deleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const token = getToken();
    if (!token) return;
    await fetch(`${API}/builder/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setMessages([]);
    }
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending) return;

    let session = activeSession;
    if (!session) {
      const token = getToken();
      const res = await fetch(`${API}/builder/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: input.slice(0, 60) }),
      });
      if (!res.ok) return;
      session = await res.json();
      setActiveSession(session);
      setSessions(prev => [session!, ...prev]);
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);
    setActiveTab("chat");

    const token = getToken();
    let buffer = "";

    try {
      const res = await fetch(`${API}/builder/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: session!.id, message: input }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: `Error: ${err.detail ?? "Something went wrong"}`, streaming: false }
            : m
        ));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              buffer += event.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: buffer } : m
              ));
            } else if (event.type === "done") {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? { ...m, streaming: false } : m
              ));
              // Refresh sessions to get updated title
              fetchSessions();
            } else if (event.type === "error") {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: `Error: ${event.text}`, streaming: false } : m
              ));
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } finally {
      setSending(false);
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id && m.streaming ? { ...m, streaming: false } : m
      ));
    }
  }, [input, sending, activeSession]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasFiles = previewFiles.length > 0;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>
      {/* ── Sidebar ── */}
      <aside className="w-60 border-r border-[var(--border)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--brand)] flex items-center justify-center">
              <span className="text-white font-bold text-xs">T</span>
            </div>
            <span className="text-white font-semibold text-sm">AI Builder</span>
          </div>
          <button onClick={createSession}
            className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm py-2 rounded-lg font-medium transition-colors">
            + New App
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 && (
            <p className="text-[var(--muted)] text-xs text-center mt-4 px-2">No apps yet. Click "+ New App" to start.</p>
          )}
          {sessions.map(s => (
            <div key={s.id} onClick={() => loadSession(s)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5 ${
                activeSession?.id === s.id
                  ? "bg-[var(--brand)]/20 text-white"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface)]"
              }`}>
              <span className="text-sm truncate flex-1">{s.title}</span>
              <button onClick={(e) => deleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-red-400 transition-all ml-1 text-xs">
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] p-3">
          <Link href="/dashboard"
            className="flex items-center gap-2 text-[var(--muted)] hover:text-white text-sm transition-colors">
            ← Dashboard
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Tabs */}
        <div className="border-b border-[var(--border)] px-4 flex items-center gap-1 h-12 shrink-0">
          {(["chat", "preview", "files"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              disabled={tab !== "chat" && !hasFiles}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize disabled:opacity-30 ${
                activeTab === tab
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)] hover:text-white"
              }`}>
              {tab === "preview" ? "👁 Preview" : tab === "files" ? `📁 Files ${hasFiles ? `(${previewFiles.length})` : ""}` : "💬 Chat"}
            </button>
          ))}
          {activeSession && (
            <span className="ml-auto text-xs text-[var(--muted)] truncate max-w-xs">{activeSession.title}</span>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* Chat tab */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-6 py-16">
                    <div className="text-6xl">🤖</div>
                    <div>
                      <h2 className="text-xl font-bold text-white mb-2">What do you want to build?</h2>
                      <p className="text-[var(--muted)] text-sm max-w-md">
                        Describe your app in plain language. I will generate the complete code for you — HTML, CSS, JavaScript — ready to deploy.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                      {SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => setInput(s)}
                          className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--brand)] text-[var(--muted)] hover:text-white text-sm px-4 py-3 rounded-xl text-left transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">AI</span>
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-5 py-4 ${
                      msg.role === "user"
                        ? "bg-[var(--brand)] text-white"
                        : "bg-[var(--surface)] border border-[var(--border)]"
                    }`}>
                      {msg.role === "user"
                        ? <p className="text-sm">{msg.content}</p>
                        : <MessageContent content={msg.content} streaming={msg.streaming} />
                      }
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[var(--border)] p-4">
                {!getToken() && (
                  <p className="text-red-400 text-sm text-center mb-3">Please sign in to use the AI Builder.</p>
                )}
                <div className="flex gap-3 items-end">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your app… (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-white placeholder-[var(--muted)] text-sm resize-none focus:outline-none focus:border-[var(--brand)] transition-colors"
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 shrink-0">
                    {sending
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : "Send →"
                    }
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)] mt-2 text-center">
                  {user ? `${user.plan} plan · ${user.tokens_used_month.toLocaleString()} tokens used this month` : ""}
                </p>
              </div>
            </>
          )}

          {/* Preview tab */}
          {activeTab === "preview" && (
            <div className="flex-1 overflow-hidden">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title="App Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
                  No preview available yet. Generate an app first.
                </div>
              )}
            </div>
          )}

          {/* Files tab */}
          {activeTab === "files" && (
            <div className="flex-1 flex overflow-hidden">
              {/* File list */}
              <div className="w-48 border-r border-[var(--border)] overflow-y-auto p-2 shrink-0">
                {previewFiles.map(f => (
                  <button key={f.path} onClick={() => setSelectedFile(f)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors mb-0.5 ${
                      selectedFile?.path === f.path
                        ? "bg-[var(--brand)]/20 text-white"
                        : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface)]"
                    }`}>
                    {f.path}
                  </button>
                ))}
              </div>
              {/* File content */}
              <div className="flex-1 overflow-auto bg-[#0d1117] p-5">
                {selectedFile ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-[var(--muted)] font-mono">{selectedFile.path}</span>
                      <button onClick={() => navigator.clipboard.writeText(selectedFile.content)}
                        className="text-xs text-[var(--muted)] hover:text-white transition-colors">
                        Copy all
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-green-300 leading-relaxed overflow-x-auto">
                      <code>{selectedFile.content}</code>
                    </pre>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
                    Select a file to view
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Landing page for a SaaS startup",
  "Dashboard with charts and stats",
  "Todo app with drag and drop",
  "Calculator with dark theme",
];
