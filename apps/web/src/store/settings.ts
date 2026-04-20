/**
 * Store de configuración del usuario.
 * Persiste en localStorage. Permite sobreescribir la URL del gateway
 * en runtime sin tocar las env vars de Vercel.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  /** Override de la URL del gateway. Vacío = usar NEXT_PUBLIC_GATEWAY_URL */
  gatewayUrlOverride: string;
  setGatewayUrlOverride: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      gatewayUrlOverride: "",
      setGatewayUrlOverride: (url) => set({ gatewayUrlOverride: url.trim() }),
    }),
    { name: "max.settings" },
  ),
);

/** Obtener la URL del gateway activa (override > env var) fuera de React */
export function getGatewayUrl(): string {
  const override = useSettingsStore.getState().gatewayUrlOverride;
  return override || process.env.NEXT_PUBLIC_GATEWAY_URL || "";
}
