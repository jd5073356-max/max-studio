"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useWsStore } from "@/store/ws";
import type { SystemStatus } from "@/types/api";

const POLL_INTERVAL_MS = 15_000;

export function useSystemStatus(autoPoll = true) {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setAgentOnline = useWsStore((s) => s.setAgentOnline);
  const timerRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    setError(null);
    try {
      const status = await apiFetch<SystemStatus>("/system/status");
      setData(status);
      setAgentOnline(status.agent.online);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando status");
    } finally {
      setLoading(false);
    }
  }, [setAgentOnline]);

  useEffect(() => {
    void fetchStatus();
    if (!autoPoll) return;
    timerRef.current = window.setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [fetchStatus, autoPoll]);

  return { data, loading, error, refresh: fetchStatus };
}
