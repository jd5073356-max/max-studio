"use client";

import { useState } from "react";
import { FileDown, X, Sparkles, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/store/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ModelBadge } from "./ModelBadge";
import { StreamingCursor } from "./StreamingCursor";

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

const SAVE_FORMATS = [
  { value: "md", label: "Markdown" },
  { value: "docx", label: "Word" },
  { value: "txt", label: "Texto" },
  { value: "html", label: "HTML" },
  { value: "py", label: "Python" },
  { value: "js", label: "JavaScript" },
  { value: "sql", label: "SQL" },
  { value: "pptx", label: "PowerPoint" },
  { value: "xlsx", label: "Excel" },
];

function SaveDocPanel({
  content,
  onClose,
}: {
  content: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("md");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/docs/generate", {
        method: "POST",
        body: {
          title: title.trim(),
          format,
          prompt: `Convierte el siguiente contenido al formato requerido, manteniendo toda la información:\n\n${content}`,
        },
      });
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          Guardar como documento
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título del documento…"
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      <div className="flex gap-2">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {SAVE_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <Button
          size="sm"
          className="h-7 px-3 text-xs"
          disabled={!title.trim() || saving || saved}
          onClick={save}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? "✓ Guardado" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user";
  const [showSave, setShowSave] = useState(false);

  return (
    <div className={cn("flex w-full gap-3 px-4 py-1.5", isUser && "justify-end")}>
      {/* Avatar MAX */}
      {!isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          M
        </div>
      )}

      <div className={cn("flex max-w-[82%] flex-col gap-1", isUser && "items-end")}>
        {/* Contenido */}
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-primary/10 px-4 py-2.5 text-sm text-foreground ring-1 ring-inset ring-primary/20">
            {message.content}
          </div>
        ) : (
          <div className="text-sm text-foreground">
            <MarkdownRenderer content={message.content} />
            {isStreaming && <StreamingCursor />}
          </div>
        )}

        {/* Acciones — solo mensajes del asistente finalizados */}
        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-1 mt-0.5">
            {message.model_used && <ModelBadge model={message.model_used} />}
            <button
              onClick={() => setShowSave((v) => !v)}
              title="Guardar como documento"
              className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-card transition-colors flex items-center gap-1"
            >
              <FileDown className="h-3 w-3" />
              Guardar
            </button>
          </div>
        )}

        {/* Panel de guardar */}
        {!isUser && showSave && (
          <SaveDocPanel
            content={message.content}
            onClose={() => setShowSave(false)}
          />
        )}
      </div>

      {/* Avatar usuario */}
      {isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          JD
        </div>
      )}
    </div>
  );
}
