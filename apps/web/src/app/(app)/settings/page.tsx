"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Moon, Sun, XCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PushToggle } from "@/components/pwa/PushToggle";
import { logout, me } from "@/lib/auth-client";
import { useSettingsStore, getGatewayUrl } from "@/store/settings";

// ── Sección visual ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// ── Conexión al gateway ───────────────────────────────────────────────────────
function ConnectionSection() {
  const { gatewayUrlOverride, setGatewayUrlOverride } = useSettingsStore();
  const [draft, setDraft] = useState(gatewayUrlOverride);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [latency, setLatency] = useState<number | null>(null);

  const activeUrl = getGatewayUrl();

  const testConnection = async (url = activeUrl) => {
    if (!url) return;
    setTesting(true);
    setStatus("idle");
    const t0 = Date.now();
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      setLatency(Date.now() - t0);
      setStatus(res.ok ? "ok" : "error");
    } catch {
      setLatency(null);
      setStatus("error");
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    setGatewayUrlOverride(draft);
    toast.success("URL guardada");
    void testConnection(draft || process.env.NEXT_PUBLIC_GATEWAY_URL || "");
  };

  return (
    <Section title="Conexión">
      <div className="space-y-1.5">
        <Label htmlFor="gateway-url">URL del Gateway</Label>
        <div className="flex gap-2">
          <Input
            id="gateway-url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://xxxx.trycloudflare.com"}
            className="flex-1 font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={save} disabled={testing}>
            Guardar
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Activo: <span className="font-mono">{activeUrl || "—"}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => testConnection()}
          disabled={testing || !activeUrl}
          className="gap-1.5"
        >
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Probar conexión
        </Button>
        {status === "ok" && (
          <span className="flex items-center gap-1 text-xs text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {latency}ms
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" />
            Sin respuesta
          </span>
        )}
      </div>
    </Section>
  );
}

// ── Apariencia ────────────────────────────────────────────────────────────────
function AppearanceSection() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Section title="Apariencia">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Tema</p>
          <p className="text-xs text-muted-foreground">
            {mounted ? (resolvedTheme === "dark" ? "Oscuro" : "Claro") : "—"}
          </p>
        </div>
        {mounted && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="gap-1.5"
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Cambiar
          </Button>
        )}
      </div>
    </Section>
  );
}

// ── Notificaciones ────────────────────────────────────────────────────────────
function NotificationsSection() {
  return (
    <Section title="Notificaciones">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Push notifications</p>
          <p className="text-xs text-muted-foreground">
            MAX te avisa aunque la app esté cerrada
          </p>
        </div>
        <PushToggle />
      </div>
    </Section>
  );
}

// ── Cuenta ────────────────────────────────────────────────────────────────────
function AccountSection() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    me()
      .then((u) => setEmail(u.email))
      .catch(() => null);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("No se pudo cerrar sesión");
      setLoggingOut(false);
    }
  };

  return (
    <Section title="Cuenta">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Usuario</p>
          <p className="text-xs text-muted-foreground">{email ?? "Cargando…"}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={loggingOut}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          {loggingOut && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Cerrar sesión
        </Button>
      </div>
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 md:p-6">
      <ConnectionSection />
      <AppearanceSection />
      <NotificationsSection />
      <AccountSection />
    </div>
  );
}
