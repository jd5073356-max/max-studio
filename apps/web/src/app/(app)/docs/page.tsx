"use client";

import { useEffect, useState } from "react";
import { Download, FileCode, FileText, Loader2, Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { getGatewayUrl } from "@/store/settings";
import { getToken } from "@/store/auth";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  created_at: string;
};

type GenerateResult = {
  id: string;
  filename: string;
  size_bytes: number;
  preview: string;
};

const FORMATS = [
  { value: "md", label: "Markdown", icon: FileText },
  { value: "html", label: "HTML", icon: FileCode },
  { value: "txt", label: "Texto", icon: FileText },
];

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DocIcon({ mime }: { mime: string }) {
  if (mime.includes("html")) return <FileCode className="h-4 w-4 text-orange-400" />;
  return <FileText className="h-4 w-4 text-primary" />;
}

// ── Formulario de generación ──────────────────────────────────────────────────
function GenerateForm({ onCreated }: { onCreated: (doc: Doc) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("md");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !prompt.trim()) return;
    setLoading(true);
    setPreview(null);
    try {
      const result = await apiFetch<GenerateResult>("/docs/generate", {
        method: "POST",
        body: { title, format, prompt },
      });
      setPreview(result.preview);
      onCreated({
        id: result.id,
        filename: result.filename,
        mime_type: format === "html" ? "text/html" : format === "txt" ? "text/plain" : "text/markdown",
        size_bytes: result.size_bytes,
        created_at: new Date().toISOString(),
      });
      setTitle("");
      setPrompt("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2" size="sm">
        <Plus className="h-4 w-4" />
        Generar documento
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Nuevo documento
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setOpen(false); setPreview(null); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="doc-title">Título</Label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Resumen semanal de tareas"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Formato</Label>
        <div className="flex gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                format === f.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="doc-prompt">Instrucción para MAX</Label>
        <textarea
          id="doc-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Ej: Redacta un informe de las últimas tareas completadas, con métricas y próximos pasos."
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {preview && (
        <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
          <span className="mb-1 block font-medium text-foreground">Vista previa:</span>
          {preview}
        </div>
      )}

      <Button onClick={submit} disabled={loading || !title.trim() || !prompt.trim()} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Generando…" : "Generar con MAX"}
      </Button>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function DocsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Doc[]>("/docs")
      .then(setDocs)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (doc: Doc) => {
    setDocs((prev) => [doc, ...prev]);
  };

  const downloadUrl = (id: string) => {
    const base = getGatewayUrl();
    const token = getToken();
    return `${base}/docs/${id}/download${token ? `?token=${token}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <GenerateForm onCreated={handleCreated} />

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p className="text-sm">Sin documentos aún. Generá el primero arriba.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors"
            >
              <DocIcon mime={doc.mime_type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.filename}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDate(doc.created_at)} · {formatBytes(doc.size_bytes)}
                </p>
              </div>
              <a href={downloadUrl(doc.id)} download={doc.filename}>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Descargar">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
