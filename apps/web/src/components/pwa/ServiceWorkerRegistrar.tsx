"use client";

import { useEffect } from "react";

/**
 * Registra /sw.js al montar.
 *
 * - Solo en producción (el SW en dev interfiere con HMR de Next/Turbopack).
 *   Para testear PWA localmente: `pnpm build && pnpm start`.
 * - No renderiza nada — side-effect puro.
 * - Si el SW cambia, Next re-sirve /sw.js con hash distinto y el browser
 *   dispara updatefound → postMessage {type:"SKIP_WAITING"} para activar rápido.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        // Nuevo SW disponible → forzar activación inmediata.
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              installing.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      } catch (err) {
        console.warn("[sw] registro falló:", err);
      }
    };

    // No bloquear el first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
