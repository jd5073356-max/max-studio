"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import React, { useState, type ComponentPropsWithoutRef } from "react";
import { Play, Loader2, CheckCircle2, XCircle, Copy, Check } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SandboxResult } from "@/types/api";

// Tema de highlight.js para bloques de código
import "highlight.js/styles/github-dark.css";

interface Props {
  content: string;
}

type CodeProps = ComponentPropsWithoutRef<"code"> & { inline?: boolean };

// ── Lenguajes que se pueden ejecutar en el sandbox ───────────────────────────
const RUNNABLE = new Set(["python", "py", "javascript", "js"]);

function getLangFromClass(className?: string): string {
  if (!className) return "";
  const m = /language-(\w+)/.exec(className);
  return m ? m[1].toLowerCase() : "";
}

function getCodeText(children: React.ReactNode): string {
  const flat = (node: React.ReactNode): string => {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(flat).join("");
    if (React.isValidElement(node)) {
      const el = node as React.ReactElement<{ children?: React.ReactNode }>;
      return flat(el.props.children);
    }
    return "";
  };
  return flat(children).replace(/\n$/, "");
}

// ── Botón copiar ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      title="Copiar"
      className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Bloque ejecutable ─────────────────────────────────────────────────────────
function ExecutableCodeBlock({
  language,
  code,
  children,
}: {
  language: string;
  code: string;
  children: React.ReactNode;
}) {
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await apiFetch<SandboxResult>("/sandbox/run", {
        method: "POST",
        body: { language, code },
      });
      setResult(res);
    } catch (e: unknown) {
      setResult({
        stdout: "",
        stderr: e instanceof Error ? e.message : "Error desconocido",
        exit_code: 1,
        duration_ms: 0,
        language,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-md ring-1 ring-border">
      {/* Barra superior con lenguaje + acciones */}
      <div className="flex items-center justify-between bg-card/60 px-3 py-1.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {language}
        </span>
        <div className="flex items-center gap-1">
          <CopyButton text={code} />
          <button
            onClick={run}
            disabled={running}
            title="Ejecutar en sandbox EC2"
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              running
                ? "text-muted-foreground"
                : "text-primary hover:bg-primary/10",
            )}
          >
            {running ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {running ? "Ejecutando…" : "Ejecutar"}
          </button>
        </div>
      </div>

      {/* Código */}
      <pre className="overflow-x-auto bg-card p-3 font-mono text-xs">
        {children}
      </pre>

      {/* Output */}
      {result && (
        <div className="border-t border-border bg-black/40 px-3 py-2 font-mono text-xs">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {result.exit_code === 0 ? (
              <CheckCircle2 className="h-3 w-3 text-success" />
            ) : (
              <XCircle className="h-3 w-3 text-destructive" />
            )}
            exit {result.exit_code} · {result.duration_ms} ms
          </div>
          {result.stdout && (
            <pre className="whitespace-pre-wrap text-[11px] text-green-300">
              {result.stdout}
            </pre>
          )}
          {result.stderr && (
            <pre className="whitespace-pre-wrap text-[11px] text-red-400">
              {result.stderr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Renderer principal ────────────────────────────────────────────────────────
export function MarkdownRenderer({ content }: Props) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // Bloques pre/code — detecta si son ejecutables
          pre: ({ children }) => {
            // Buscar el elemento <code> hijo para extraer lenguaje y texto
            const codeEl = React.Children.toArray(children).find(
              (child): child is React.ReactElement<{ className?: string; children?: React.ReactNode }> =>
                React.isValidElement(child),
            );
            const lang = getLangFromClass(codeEl?.props?.className);
            const code = getCodeText(codeEl?.props?.children);

            if (lang && RUNNABLE.has(lang)) {
              return (
                <ExecutableCodeBlock language={lang} code={code}>
                  {children}
                </ExecutableCodeBlock>
              );
            }

            // Bloque normal con botón copiar
            return (
              <div className="my-2 overflow-hidden rounded-md ring-1 ring-border">
                {(lang || code) && (
                  <div className="flex items-center justify-between bg-card/60 px-3 py-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {lang || "code"}
                    </span>
                    <CopyButton text={code} />
                  </div>
                )}
                <pre className="overflow-x-auto bg-card p-3 font-mono text-xs">
                  {children}
                </pre>
              </div>
            );
          },

          code: ({ inline, className, children, ...props }: CodeProps) =>
            inline ? (
              <code
                className="rounded bg-card px-1.5 py-0.5 font-mono text-xs ring-1 ring-border"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            ),

          // Tablas
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-1.5 text-left font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-1.5 text-muted-foreground">
              {children}
            </td>
          ),

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary pl-4 text-muted-foreground italic">
              {children}
            </blockquote>
          ),

          // Headings
          h1: ({ children }) => (
            <h1 className="text-base font-semibold text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-medium text-foreground">{children}</h3>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),

          // Listas
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
