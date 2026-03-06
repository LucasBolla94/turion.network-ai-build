"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, appsApi, type UserPublic } from "@/lib/api";
import { getToken, getUser, clearSession } from "@/lib/auth-store";

const API = "/api-backend/v1";
// 1 displayed token = 100 real AI tokens (matches pricing.py TOKENS_PER_CREDIT)
const TOKENS_PER_DISPLAY = 100;
const ACTIVE_SESSION_KEY = "turion_active_session";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  tokens?: number;        // total display tokens (real / TOKENS_PER_DISPLAY)
  input_tokens?: number;  // raw input tokens from provider
  output_tokens?: number; // raw output tokens from provider
  model?: string;
  task_type?: string;     // task type from router v2
}

interface Session { id: string; title: string; }
interface ParsedFile { path: string; lang: string; content: string; }

// ── Parse ```lang:path blocks ──────────────────────────────────────────────
function parseFiles(content: string): ParsedFile[] {
  const regex = /```([\w-]+):([^\n]+)\n([\s\S]*?)```/g;
  const files: ParsedFile[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    files.push({ lang: m[1], path: m[2].trim(), content: m[3] });
  }
  return files;
}

function buildPreview(files: ParsedFile[]): string {
  const html = files.find(f => f.path.endsWith(".html"))?.content ?? "";
  const css  = files.find(f => f.path.endsWith(".css"))?.content ?? "";
  const js   = files.find(f => f.path.endsWith(".js"))?.content ?? "";
  if (!html) return "";
  return html
    .replace("</head>", `<style>${css}</style></head>`)
    .replace("</body>", `<script>${js}</script></body>`);
}

// ── Thinking Animation ─────────────────────────────────────────────────────
function ThinkingDots({ label }: { label?: string }) {
  return (
    <div className="flex gap-3 justify-start items-start px-1">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--brand)] to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-white text-xs font-bold">AI</span>
      </div>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-4">
        <div className="flex items-end gap-1.5 h-5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[var(--brand)]"
              style={{ animation: `thinking-dot 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <span className="text-xs text-[var(--muted)]">{label || "Thinking\u2026"}</span>
      </div>
    </div>
  );
}

// ── File icon by language ──────────────────────────────────────────────────
function fileIcon(lang: string) {
  const icons: Record<string, { color: string; label: string }> = {
    html:       { color: "#e34c26", label: "HTML" },
    css:        { color: "#264de4", label: "CSS" },
    javascript: { color: "#f7df1e", label: "JS" },
    js:         { color: "#f7df1e", label: "JS" },
    typescript: { color: "#3178c6", label: "TS" },
    ts:         { color: "#3178c6", label: "TS" },
    sql:        { color: "#336791", label: "SQL" },
    json:       { color: "#8bc34a", label: "JSON" },
    python:     { color: "#3572A5", label: "PY" },
    py:         { color: "#3572A5", label: "PY" },
  };
  return icons[lang.toLowerCase()] ?? { color: "#4c6ef5", label: lang.toUpperCase().slice(0, 4) };
}

// ── Collapsible Code File Card ─────────────────────────────────────────────
function CodeFileCard({ lang, path, code, streaming }: { lang: string; path: string; code: string; streaming?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { color, label } = fileIcon(lang);
  const lines = code.trim().split("\n").length;

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)] transition-all duration-200"
      style={{ background: "var(--background)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left group"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px]"
          style={{ background: color + "22", color }}>
          {label}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {streaming ? (
              <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
                Creating
              </span>
            ) : (
              <span className="text-xs text-[var(--muted)]">
                {open ? "Viewing" : "Generated"}
              </span>
            )}
            <span className="text-xs font-mono font-semibold text-white truncate">{path.trim()}</span>
          </div>
          {!streaming && (
            <p className="text-[10px] text-[var(--muted)] mt-0.5">{lines} line{lines !== 1 ? "s" : ""}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!streaming && (
            <span onClick={copy}
              className="text-[10px] text-[var(--muted)] hover:text-white border border-[var(--border)] px-2 py-1 rounded-md transition-colors opacity-0 group-hover:opacity-100">
              {copied ? "Copied!" : "Copy"}
            </span>
          )}
          {!streaming && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className={`text-[var(--muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>
      </button>
      {open && !streaming && (
        <div className="border-t border-[var(--border)]">
          <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[400px] overflow-y-auto"
            style={{ color: "#86efac", background: "#060910" }}>
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Message Content Renderer ───────────────────────────────────────────────
function MessageContent({ content, streaming }: { content: string; streaming?: boolean }) {
  const parts = content.split(/(```[\w-]*:[^\n]+\n[\s\S]*?```)/g);

  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        const m = part.match(/```([\w-]+):([^\n]+)\n([\s\S]*?)```/);
        if (m) {
          const [, lang, path, code] = m;
          if (path.trim().toLowerCase().endsWith(".sh")) return null;
          return (
            <CodeFileCard key={i} lang={lang} path={path} code={code} streaming={false} />
          );
        }
        const partial = part.match(/```([\w-]+):([^\n]+)\n([\s\S]*)$/);
        if (partial && streaming) {
          const [, lang, path] = partial;
          if (path.trim().toLowerCase().endsWith(".sh")) return null;
          return <CodeFileCard key={i} lang={lang} path={path} code="" streaming={true} />;
        }
        const text = part.trim();
        if (!text) return null;
        return (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)]">
            {text}
            {streaming && i === parts.length - 1 && (
              <span className="inline-block w-1.5 h-4 bg-[var(--brand)] ml-0.5 animate-pulse rounded-sm" />
            )}
          </p>
        );
      })}
    </div>
  );
}

// ── Plan Card ──────────────────────────────────────────────────────────────
function PlanCard({
  planText,
  streaming,
  onApprove,
  onEdit,
  onSkip,
}: {
  planText: string;
  streaming: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex gap-3 justify-start items-start px-1">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <div className="flex-1 bg-[var(--surface)] border border-amber-500/30 rounded-2xl rounded-tl-sm px-5 py-4 max-w-[95%] sm:max-w-[80%]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-amber-400">Build Plan</span>
          {streaming && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        </div>
        <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
          {planText}
          {streaming && (
            <span className="inline-block w-1.5 h-4 bg-amber-400 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>
        {!streaming && planText && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-[var(--border)]">
            <button onClick={onApprove}
              className="btn-shine bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Build this
            </button>
            <button onClick={onEdit}
              className="text-xs text-[var(--muted)] hover:text-white px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition-colors">
              Adjust plan
            </button>
            <button onClick={onSkip}
              className="text-xs text-[var(--muted)] hover:text-white px-3 py-2 rounded-lg transition-colors">
              Skip plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Task Type Badge ────────────────────────────────────────────────────────
const TASK_LABELS: Record<string, { label: string; color: string }> = {
  create_static:    { label: "Build", color: "text-green-400" },
  create_fullstack: { label: "Full-Stack", color: "text-purple-400" },
  edit:             { label: "Edit", color: "text-blue-400" },
  debug:            { label: "Debug", color: "text-red-400" },
  explain:          { label: "Explain", color: "text-yellow-400" },
  chat:             { label: "Chat", color: "text-[var(--muted)]" },
};

// ── Suggestions ────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Landing page for a SaaS startup",
  "Admin dashboard with charts and KPIs",
  "E-commerce product page with cart",
  "Portfolio site with dark theme",
  "Todo app with drag and drop",
  "Calculator with history log",
];

// ── Main Component ─────────────────────────────────────────────────────────
export default function BuilderPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(getUser());
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState("");
  const [sending, setSending]           = useState(false);
  const [activeTab, setActiveTab]       = useState<"chat" | "preview" | "files">("chat");
  const [previewHtml, setPreviewHtml]   = useState("");
  const [previewFiles, setPreviewFiles] = useState<ParsedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ParsedFile | null>(null);
  const [modelUsed, setModelUsed]       = useState<string | null>(null);
  const [complexity, setComplexity]     = useState<string | null>(null);
  const [taskType, setTaskType]         = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [deployedUrl, setDeployedUrl]   = useState<string | null>(null);
  const [deployError, setDeployError]   = useState<string | null>(null);
  const [isNextjsProject, setIsNextjsProject] = useState(false);
  const [newFiles, setNewFiles]         = useState(false);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Plan Mode state
  const [planMode, setPlanMode]         = useState<"idle" | "planning" | "plan_ready" | "building">("idle");
  const [planText, setPlanText]         = useState("");
  const [planPrompt, setPlanPrompt]     = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const abortRef       = useRef<AbortController | null>(null);

  // Auth + refresh user + restore active session
  useEffect(() => {
    if (!getToken()) { clearSession(); router.replace("/login"); return; }
    auth.me().then(setUser).catch(() => {});

    (async () => {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API}/builder/sessions`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const list: Session[] = await res.json();
      setSessions(list);

      try {
        const saved = localStorage.getItem(ACTIVE_SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Session;
          const match = list.find(s => s.id === parsed.id);
          if (match) {
            setActiveSession(match);
            const msgRes = await fetch(`${API}/builder/sessions/${match.id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
            if (msgRes.ok) setMessages(await msgRes.json());
          } else {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
          }
        }
      } catch {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (activeSession) {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeSession));
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, planText]);

  // Rebuild preview when last AI message completes
  useEffect(() => {
    const last = [...messages].reverse().find(m => m.role === "assistant" && !m.streaming);
    if (!last) return;
    const files = parseFiles(last.content);
    setPreviewFiles(files);
    setPreviewHtml(buildPreview(files));
    const visible = files.filter(f => !f.path.toLowerCase().endsWith(".sh"));
    if (visible.length > 0) {
      if (!selectedFile || !visible.find(f => f.path === selectedFile.path)) {
        setSelectedFile(visible[0]);
      }
      setNewFiles(true);
    }
  }, [messages]);

  async function fetchSessions() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${API}/builder/sessions`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setSessions(await res.json());
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
      const s = await res.json();
      setSessions(prev => [s, ...prev]);
      setActiveSession(s);
      setMessages([]);
      setPreviewHtml("");
      setPreviewFiles([]);
      setSelectedFile(null);
      setNewFiles(false);
      setPlanMode("idle");
      setPlanText("");
    }
  }

  async function loadSession(s: Session) {
    const token = getToken();
    if (!token) return;
    setActiveSession(s);
    setPreviewHtml(""); setPreviewFiles([]); setSelectedFile(null); setNewFiles(false);
    setPlanMode("idle"); setPlanText("");
    const res = await fetch(`${API}/builder/sessions/${s.id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setMessages(await res.json());
  }

  function openDeleteModal(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletePendingId(sessionId);
    setDeleteConfirmText("");
  }

  async function confirmDelete() {
    if (!deletePendingId) return;
    const token = getToken();
    if (!token) return;
    await fetch(`${API}/builder/sessions/${deletePendingId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setSessions(prev => prev.filter(s => s.id !== deletePendingId));
    if (activeSession?.id === deletePendingId) {
      setActiveSession(null); setMessages([]); setPreviewHtml(""); setPreviewFiles([]); setNewFiles(false);
    }
    setDeletePendingId(null);
    setDeleteConfirmText("");
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setPlanMode(pm => pm === "planning" ? "idle" : pm === "building" ? "idle" : pm);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  }

  // ── Plan Mode: request a plan ────────────────────────────────────────────
  async function requestPlan(promptText: string, session: Session) {
    setPlanMode("planning");
    setPlanText("");
    setPlanPrompt(promptText);

    const token = getToken();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API}/builder/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: session.id, message: promptText }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setPlanMode("idle");
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setPlanMode("idle"); return; }

      let sseBuffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "plan_text") {
              setPlanText(prev => prev + ev.text);
            } else if (ev.type === "plan_done") {
              setPlanMode("plan_ready");
            } else if (ev.type === "plan_error") {
              setPlanMode("idle");
            }
          } catch { /* skip */ }
        }
      }
      // If we finished without plan_done, set ready anyway if we have text
      setPlanMode(prev => prev === "planning" ? "plan_ready" : prev);
    } catch {
      setPlanMode("idle");
    } finally {
      abortRef.current = null;
    }
  }

  // ── Send message (with optional plan) ────────────────────────────────────
  const sendMessage = useCallback(async (approvedPlan?: string) => {
    const messageText = approvedPlan ? planPrompt : input.trim();
    if (!messageText || sending) return;

    let session = activeSession;
    if (!session) {
      const token = getToken();
      const res = await fetch(`${API}/builder/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: messageText.slice(0, 60) }),
      });
      if (!res.ok) return;
      session = await res.json();
      setActiveSession(session);
      setSessions(prev => [session!, ...prev]);
    }

    // Check if this is a create request (first message, no code context) → trigger Plan Mode
    const isFirstBuild = messages.length === 0 && !approvedPlan;
    const isCreateRequest = messageText.length > 30 || /build|create|make|generate|crie|construa|desenvolva|faz|cria/i.test(messageText);

    if (isFirstBuild && isCreateRequest && !approvedPlan) {
      // Enter Plan Mode first
      if (!approvedPlan) setInput("");
      await requestPlan(messageText, session!);
      return;
    }

    const userMsg: Message     = { id: Date.now().toString(), role: "user", content: messageText };
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    if (!approvedPlan) setInput("");
    setSending(true);
    setPlanMode(approvedPlan ? "building" : "idle");
    setNewFiles(false);
    setActiveTab("chat");

    const token = getToken();
    const controller = new AbortController();
    abortRef.current = controller;
    let buffer = "";
    let totalRealTokens = 0;
    let finalModel = "";

    try {
      const chatBody: Record<string, string> = { session_id: session!.id, message: messageText };
      if (approvedPlan) chatBody.approved_plan = approvedPlan;

      const res = await fetch(`${API}/builder/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(chatBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: `Error: ${err.detail}`, streaming: false } : m
        ));
        return;
      }

      const reader  = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "meta") {
              setModelUsed(ev.model);
              setComplexity(ev.complexity);
              setTaskType(ev.task_type ?? null);
              finalModel = ev.model;
            } else if (ev.type === "text") {
              buffer += ev.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: buffer } : m
              ));
            } else if (ev.type === "done") {
              totalRealTokens = ev.tokens ?? 0;
              const displayTokens = totalRealTokens > 0
                ? Math.ceil(totalRealTokens / TOKENS_PER_DISPLAY)
                : 0;
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      streaming: false,
                      tokens: displayTokens,
                      input_tokens: ev.input_tokens ?? 0,
                      output_tokens: ev.output_tokens ?? 0,
                      model: finalModel,
                      task_type: ev.task_type ?? null,
                    }
                  : m
              ));
              fetchSessions();
              auth.me().then(setUser).catch(() => {});
            } else if (ev.type === "error") {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: `\u26a0\ufe0f ${ev.text}`, streaming: false } : m
              ));
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, streaming: false, content: m.content || (isAbort ? "_(stopped by user)_" : "Connection error") }
          : m
      ));
    } finally {
      setSending(false);
      setPlanMode("idle");
      abortRef.current = null;
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    }
  }, [input, sending, activeSession, messages, planPrompt]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  async function saveAsApp() {
    if (!activeSession || saving) return;
    setSaving(true);
    setDeployedUrl(null);
    setDeployError(null);
    setIsNextjsProject(false);
    try {
      const app = await appsApi.fromSession(activeSession.id, activeSession.title);
      const deployed = await appsApi.deploy(app.id);
      if (deployed.preview_url && deployed.status === "online") {
        setDeployedUrl(deployed.preview_url);
      } else if (deployed.framework === "nextjs" || deployed.status === "draft") {
        setIsNextjsProject(true);
      } else {
        router.push("/dashboard/apps");
      }
    } catch (e: unknown) {
      setDeployError((e as Error).message ?? "Failed to save project");
    } finally {
      setSaving(false);
    }
  }

  // Plan mode handlers
  function handleApprovePlan() {
    sendMessage(planText);
  }

  function handleEditPlan() {
    setInput(planPrompt);
    setPlanMode("idle");
    setPlanText("");
    textareaRef.current?.focus();
  }

  function handleSkipPlan() {
    // Build without plan — send directly
    const prompt = planPrompt;
    setPlanMode("idle");
    setPlanText("");
    setPlanPrompt("");

    // Manually set input and trigger send
    const userMsg: Message     = { id: Date.now().toString(), role: "user", content: prompt };
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", streaming: true };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setSending(true);
    setNewFiles(false);
    setActiveTab("chat");

    const token = getToken();
    const controller = new AbortController();
    abortRef.current = controller;
    let buffer = "";
    let finalModel = "";

    (async () => {
      let session = activeSession;
      if (!session) return;

      try {
        const res = await fetch(`${API}/builder/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: session.id, message: prompt }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Unknown error" }));
          setMessages(prev => prev.map(m =>
            m.id === assistantMsg.id ? { ...m, content: `Error: ${err.detail}`, streaming: false } : m
          ));
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        let sseBuffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === "meta") {
                setModelUsed(ev.model);
                setComplexity(ev.complexity);
                setTaskType(ev.task_type ?? null);
                finalModel = ev.model;
              } else if (ev.type === "text") {
                buffer += ev.text;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMsg.id ? { ...m, content: buffer } : m
                ));
              } else if (ev.type === "done") {
                const displayTokens = (ev.tokens ?? 0) > 0 ? Math.ceil((ev.tokens ?? 0) / TOKENS_PER_DISPLAY) : 0;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMsg.id
                    ? { ...m, streaming: false, tokens: displayTokens, input_tokens: ev.input_tokens ?? 0, output_tokens: ev.output_tokens ?? 0, model: finalModel, task_type: ev.task_type ?? null }
                    : m
                ));
                fetchSessions();
                auth.me().then(setUser).catch(() => {});
              } else if (ev.type === "error") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantMsg.id ? { ...m, content: `\u26a0\ufe0f ${ev.text}`, streaming: false } : m
                ));
              }
            } catch { /* skip */ }
          }
        }
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, streaming: false, content: m.content || (isAbort ? "_(stopped)_" : "Connection error") }
            : m
        ));
      } finally {
        setSending(false);
        abortRef.current = null;
        setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
      }
    })();
  }

  const visibleFiles = previewFiles.filter(f => !f.path.toLowerCase().endsWith(".sh"));
  const hasFiles   = visibleFiles.length > 0;
  const modelClean = modelUsed?.replace("openai/", "").replace("anthropic/", "") ?? null;
  const isStreaming = messages.some(m => m.streaming);

  const lastMsg = messages[messages.length - 1];
  const isThinking = sending && lastMsg?.role === "assistant" && !lastMsg?.content;

  const taskLabel = taskType ? TASK_LABELS[taskType] : null;

  const sessionSidebarContent = (
    <>
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-[var(--brand)] flex items-center justify-center glow-brand">
            <span className="text-white font-bold text-xs">T</span>
          </div>
          <span className="text-white font-semibold text-sm">AI Builder</span>
        </div>
        <button onClick={() => { createSession(); setSidebarOpen(false); }}
          className="btn-shine w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New App
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 && (
          <p className="text-[var(--muted)] text-xs text-center mt-6 px-2 leading-relaxed">No apps yet. Start building something!</p>
        )}
        {sessions.map(s => (
          <div key={s.id} onClick={() => { loadSession(s); setSidebarOpen(false); }}
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5 ${
              activeSession?.id === s.id
                ? "bg-[var(--brand)]/15 text-white border border-[var(--brand)]/20"
                : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface-hover)]"
            }`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className="text-xs truncate">{s.title}</span>
            </div>
            <button onClick={(e) => openDeleteModal(s.id, e)}
              className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-red-400 transition-all ml-1 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-[var(--muted)] hover:text-white text-xs transition-colors py-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Dashboard
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>

      {/* Session Sidebar — desktop */}
      <aside className="hidden md:flex w-56 border-r border-[var(--border)] flex-col shrink-0" style={{ background: "var(--surface)" }}>
        {sessionSidebarContent}
      </aside>

      {/* Session Sidebar — mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] flex flex-col border-r border-[var(--border)] animate-slide-in" style={{ background: "var(--surface)" }}>
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-3 w-8 h-8 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-white z-10"
              aria-label="Close sidebar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            {sessionSidebarContent}
          </aside>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Tabs + toolbar */}
        <div className="border-b border-[var(--border)] px-2 md:px-4 flex items-center gap-1 h-12 shrink-0 bg-[var(--surface)]">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-white shrink-0" aria-label="Open sessions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          {(["chat", "preview", "files"] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (tab === "files") setNewFiles(false); }}
              disabled={tab !== "chat" && !hasFiles}
              className={`relative px-4 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize disabled:opacity-30 ${
                activeTab === tab ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface-hover)]"
              }`}>
              {tab === "preview" ? "Preview" : tab === "files" ? `Files${hasFiles ? ` (${visibleFiles.length})` : ""}` : "Chat"}
              {tab === "files" && newFiles && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400" />
              )}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {/* Task type badge */}
            {taskLabel && !isStreaming && (
              <span className={`text-[10px] font-medium ${taskLabel.color} bg-[var(--background)] border border-[var(--border)] px-2 py-0.5 rounded-full hidden sm:inline`}>
                {taskLabel.label}
              </span>
            )}
            {isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
            {hasFiles && activeSession && (
              <button onClick={saveAsApp} disabled={saving || sending}
                className="btn-shine px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {saving
                  ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving&hellip;</>
                  : <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                      Save &amp; Deploy
                    </>
                }
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* Chat Tab */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-5">

                {/* Empty state */}
                {messages.length === 0 && planMode === "idle" && (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-6 py-12">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-indigo-600 flex items-center justify-center glow-brand">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white mb-2">What do you want to build?</h2>
                      <p className="text-[var(--muted)] text-sm max-w-sm leading-relaxed">
                        Describe your idea and the AI builds it immediately &mdash; complete, deployable code with real design and working features.
                      </p>
                      <div className="flex items-center gap-4 mt-4 text-xs text-[var(--muted)]">
                        {["Describe idea", "Review plan", "AI builds it", "Deploy"].map((step, i) => (
                          <div key={step} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-[var(--border)]">&rarr;</span>}
                            <span className={i === 0 ? "text-[var(--brand)]" : ""}>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
                      {SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                          className="card-hover bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-white text-xs px-4 py-3 rounded-xl text-left transition-all leading-snug">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} items-start`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--brand)] to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">AI</span>
                      </div>
                    )}
                    <div className={`max-w-[95%] sm:max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-[var(--brand)] rounded-2xl rounded-tr-sm px-4 py-3"
                        : "bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-5 py-4"
                    }`}>
                      {msg.role === "user"
                        ? <p className="text-sm text-white leading-relaxed">{msg.content}</p>
                        : (
                          <>
                            <MessageContent content={msg.content} streaming={msg.streaming} />
                            {!msg.streaming && msg.tokens != null && msg.tokens > 0 && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)] flex-wrap">
                                <div className="flex items-center gap-1.5 bg-[var(--brand)]/10 border border-[var(--brand)]/20 text-[var(--brand)] px-2.5 py-1 rounded-full">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                                  </svg>
                                  <span className="text-[11px] font-semibold tabular-nums">{msg.tokens.toLocaleString()} tokens</span>
                                </div>
                                {(msg.input_tokens ?? 0) > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)] bg-[var(--background)] border border-[var(--border)] px-2 py-1 rounded-full tabular-nums">
                                    <span className="text-blue-400">&uarr;</span>
                                    <span>{(msg.input_tokens ?? 0).toLocaleString()} in</span>
                                    <span className="text-[var(--border)]">&middot;</span>
                                    <span className="text-emerald-400">&darr;</span>
                                    <span>{(msg.output_tokens ?? 0).toLocaleString()} out</span>
                                  </div>
                                )}
                                {msg.task_type && TASK_LABELS[msg.task_type] && (
                                  <span className={`text-[10px] ${TASK_LABELS[msg.task_type].color}`}>
                                    {TASK_LABELS[msg.task_type].label}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )
                      }
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-white">
                        {user?.name?.[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}
                  </div>
                ))}

                {/* Plan Card (Plan Mode) */}
                {(planMode === "planning" || planMode === "plan_ready") && (
                  <PlanCard
                    planText={planText}
                    streaming={planMode === "planning"}
                    onApprove={handleApprovePlan}
                    onEdit={handleEditPlan}
                    onSkip={handleSkipPlan}
                  />
                )}

                {/* Building indicator (Plan → Build transition) */}
                {planMode === "building" && !isThinking && !isStreaming && (
                  <ThinkingDots label="Building from plan\u2026" />
                )}

                {/* Thinking animation */}
                {isThinking && <ThinkingDots label={planMode === "building" ? "Building from plan\u2026" : "Thinking\u2026"} />}

                {/* Static deploy — live URL */}
                {deployedUrl && (
                  <div className="flex justify-center">
                    <div className="bg-green-500/10 border border-green-500/30 px-5 py-3.5 rounded-xl flex items-center gap-3 flex-wrap justify-center">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                      <span className="text-green-300 text-sm font-semibold">App is live!</span>
                      <a href={deployedUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-green-400 hover:text-green-200 underline underline-offset-2 font-mono break-all">
                        {deployedUrl}
                      </a>
                      <Link href="/dashboard/apps" className="text-xs text-[var(--muted)] hover:text-white transition-colors">
                        Manage &rarr;
                      </Link>
                    </div>
                  </div>
                )}

                {/* Next.js project saved */}
                {isNextjsProject && (
                  <div className="flex justify-center">
                    <div className="bg-blue-500/10 border border-blue-500/30 px-5 py-4 rounded-xl max-w-lg w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-blue-300 text-sm font-semibold">Project saved to your account!</span>
                      </div>
                      <p className="text-xs text-[var(--muted)] mb-3 leading-relaxed">
                        This is a Next.js project. Run it locally with the <code className="text-blue-300 bg-[var(--background)] px-1 rounded">setup.sh</code> script, or deploy to Vercel/Netlify for free.
                      </p>
                      <div className="flex gap-2">
                        <Link href="/dashboard/apps"
                          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                          View in My Apps &rarr;
                        </Link>
                        <button onClick={() => setIsNextjsProject(false)}
                          className="text-xs text-[var(--muted)] hover:text-white px-3 py-1.5 rounded-lg border border-[var(--border)] transition-colors">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deploy error */}
                {deployError && (
                  <div className="flex justify-center">
                    <div className="bg-red-500/10 border border-red-500/30 px-5 py-3 rounded-xl flex items-center gap-3">
                      <span className="text-red-400 text-sm">{deployError}</span>
                      <button onClick={() => setDeployError(null)} className="text-xs text-[var(--muted)] hover:text-white ml-2">&times;</button>
                    </div>
                  </div>
                )}

                {/* New files notification */}
                {newFiles && !deployedUrl && (
                  <div className="flex justify-center">
                    <button onClick={() => { setActiveTab("files"); setNewFiles(false); }}
                      className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-green-500/20 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      {visibleFiles.length} file{visibleFiles.length !== 1 ? "s" : ""} generated &mdash; view &amp; deploy &rarr;
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[var(--border)] p-4 bg-[var(--surface)]">
                <div className="flex gap-3 items-end">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your app\u2026 (Enter to send \u00b7 Shift+Enter for newline)"
                    rows={2}
                    disabled={planMode === "planning" || planMode === "building"}
                    className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-white placeholder-[var(--muted)] text-sm resize-none focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/20 transition-all disabled:opacity-50"
                  />
                  {sending || planMode === "planning" || planMode === "building" ? (
                    <button onClick={stopGeneration}
                      className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                      </svg>
                      Stop
                    </button>
                  ) : (
                    <button onClick={() => sendMessage()} disabled={!input.trim() || planMode === "plan_ready"}
                      className="btn-shine bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 shrink-0">
                      Send
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  )}
                </div>

                {/* Token status bar */}
                {user && (() => {
                  const limit = user.plan === "team" ? 3_000_000 : user.plan === "pro" ? 1_500_000 : 20_000;
                  const mLeft = Math.max(0, Math.ceil((limit - user.tokens_used_month) / TOKENS_PER_DISPLAY));
                  const tUp = Math.ceil(user.tokens_topup_balance / TOKENS_PER_DISPLAY);
                  const total = mLeft + tUp;
                  const pool = Math.ceil(limit / TOKENS_PER_DISPLAY) + tUp;
                  const mPct = pool > 0 ? (mLeft / pool) * 100 : 0;
                  const tPct = pool > 0 ? (tUp / pool) * 100 : 0;
                  return (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[var(--muted)]">
                          <span className="capitalize font-medium text-white">{user.plan}</span>
                          {" \u00b7 "}
                          <span className={total > 0 ? "text-white font-semibold" : "text-red-400 font-semibold"}>
                            {total.toLocaleString()} tokens
                          </span>
                          <span className="text-[var(--muted)]"> available</span>
                        </p>
                        <p className="text-xs text-[var(--muted)] hidden sm:block">Shift+Enter = newline</p>
                      </div>
                      <div className="h-1.5 bg-[var(--background)] rounded-full overflow-hidden flex">
                        {mLeft > 0 && <div className="h-full bg-[var(--brand)]" style={{ width: `${mPct}%` }} />}
                        {tUp > 0 && <div className="h-full bg-green-500" style={{ width: `${tPct}%` }} />}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-[var(--brand)]" />{mLeft.toLocaleString()} monthly</span>
                        {tUp > 0 && <span className="flex items-center gap-1 text-green-400"><span className="w-1.5 h-1.5 rounded-sm bg-green-500" />{tUp.toLocaleString()} top-up</span>}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* Preview Tab */}
          {activeTab === "preview" && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title="App Preview"
                />
              ) : hasFiles ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4c6ef5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm mb-1">Next.js Project</p>
                    <p className="text-[var(--muted)] text-xs max-w-xs leading-relaxed">
                      This project needs to be built to run. Use the <code className="text-blue-400 bg-[var(--background)] px-1 rounded">setup.sh</code> script from the Files tab to run it locally, or deploy to Vercel.
                    </p>
                  </div>
                  <button onClick={() => setActiveTab("files")}
                    className="text-xs text-[var(--brand)] border border-[var(--brand)]/30 px-4 py-2 rounded-lg hover:bg-[var(--brand)]/10 transition-colors">
                    View project files &rarr;
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--muted)] text-sm gap-3">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <p>Generate an app first, then preview it here.</p>
                </div>
              )}
            </div>
          )}

          {/* Files Tab */}
          {activeTab === "files" && (
            <div className="flex-1 flex overflow-hidden">
              <div className="w-36 sm:w-48 border-r border-[var(--border)] overflow-y-auto p-2 shrink-0 bg-[var(--surface)]">
                {visibleFiles.map(f => (
                  <button key={f.path} onClick={() => setSelectedFile(f)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-mono transition-colors mb-0.5 flex items-center gap-2 ${
                      selectedFile?.path === f.path
                        ? "bg-[var(--brand)]/15 text-white border border-[var(--brand)]/20"
                        : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface-hover)]"
                    }`}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="truncate">{f.path}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto bg-[#060910] p-5">
                {selectedFile ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white font-mono font-medium">{selectedFile.path}</span>
                        <span className="text-xs text-[var(--muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded">{selectedFile.lang}</span>
                      </div>
                      <button onClick={() => navigator.clipboard.writeText(selectedFile.content)}
                        className="text-xs text-[var(--muted)] hover:text-white transition-colors flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copy
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

      {/* Delete Confirmation Modal */}
      {deletePendingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Delete conversation?</p>
                <p className="text-[var(--muted)] text-xs mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)] mb-3">
              Type <span className="text-white font-mono bg-[var(--background)] px-1.5 py-0.5 rounded">delete me</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && deleteConfirmText === "delete me") confirmDelete(); }}
              placeholder="delete me"
              autoFocus
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-[var(--muted)] focus:outline-none focus:border-red-500/50 mb-4 transition-colors"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setDeletePendingId(null); setDeleteConfirmText(""); }}
                className="px-4 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-white border border-[var(--border)] hover:bg-[var(--background)] transition-colors">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmText !== "delete me"}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
