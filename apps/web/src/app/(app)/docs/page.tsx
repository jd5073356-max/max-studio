"use client";

import { useEffect, useState } from "react";
import {
  Download, FileCode, FileText, Loader2, Plus, Sparkles, X,
  FileSpreadsheet, Presentation, PenTool, Layout,
} from "lucide-react";

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

// ── Grupos de formato ─────────────────────────────────────────────────────────

const FORMAT_GROUPS = [
  {
    label: "Texto",
    formats: [
      { value: "md", label: "Markdown" },
      { value: "html", label: "HTML" },
      { value: "txt", label: "Texto plano" },
      { value: "csv", label: "CSV" },
    ],
  },
  {
    label: "Office",
    formats: [
      { value: "docx", label: "Word (.docx)" },
      { value: "xlsx", label: "Excel (.xlsx)" },
      { value: "pptx", label: "PowerPoint (.pptx)" },
    ],
  },
  {
    label: "Código",
    formats: [
      { value: "py", label: "Python" },
      { value: "java", label: "Java" },
      { value: "cpp", label: "C++" },
      { value: "js", label: "JavaScript" },
      { value: "ts", label: "TypeScript" },
      { value: "sql", label: "SQL" },
      { value: "css", label: "CSS" },
      { value: "json", label: "JSON" },
      { value: "yaml", label: "YAML" },
    ],
  },
  {
    label: "Diagrama",
    formats: [
      { value: "excalidraw", label: "Excalidraw" },
      { value: "canvas", label: "Canvas (Obsidian)" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function DocIcon({ mime, filename }: { mime: string; filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-green-400" />;
  if (ext === "pptx") return <Presentation className="h-4 w-4 text-orange-400" />;
  if (ext === "docx") return <FileText className="h-4 w-4 text-blue-400" />;
  if (ext === "excalidraw") return <PenTool className="h-4 w-4 text-purple-400" />;
  if (ext === "canvas") return <Layout className="h-4 w-4 text-yellow-400" />;
  if (mime.includes("html") || ["js", "ts", "java", "cpp", "py", "sql", "css"].includes(ext))
    return <FileCode className="h-4 w-4 text-primary" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

// ── Selector de formato ───────────────────────────────────────────────────────
function FormatSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
    >
      {FORMAT_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.formats.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
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
      const ext = format;
      const mimeMap: Record<string, string> = {
        md: "text/markdown", html: "text/html", txt: "text/plain", csv: "text/csv",
        py: "text/x-python", java: "text/x-java-source", cpp: "text/x-c++src",
        js: "application/javascript", ts: "application/typescript",
        sql: "application/sql", css: "text/css", json: "application/json",
        yaml: "application/yaml",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        excalidraw: "application/json", canvas: "application/json",
      };
      onCreated({
        id: result.id,
        filename: result.filename,
        mime_type: mimeMap[ext] ?? "application/octet-stream",
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
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => { setOpen(false); setPreview(null); }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="doc-title">Título</Label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Análisis de ventas Q2"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Formato</Label>
        <FormatSelect value={format} onChange={setFormat} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="doc-prompt">Instrucción para MAX</Label>
        <textarea
          id="doc-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Ej: Crea una presentación de 5 slides con el plan de negocio para AutoFlow Studio."
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {preview && (
        <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
          <span className="mb-1 block font-medium text-foreground">Vista previa:</span>
          {preview}
        </div>
      )}

      <Button
        onClick={submit}
        disabled={loading || !title.trim() || !prompt.trim()}
        className="w-full gap-2"
      >
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
      .then((data) => setDocs(Array.isArray(data) ? data : []))
      .catch(() => setDocs([]))
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
              <DocIcon mime={doc.mime_type} filename={doc.filename} />
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
