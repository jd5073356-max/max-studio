import { create } from "zustand";

import type { WsStatus } from "@/types/ws-events";

type WsStore = {
  status: WsStatus;
  agentOnline: boolean;
  setStatus: (status: WsStatus) => void;
  setAgentOnline: (online: boolean) => void;
};

export const useWsStore = create<WsStore>((set) => ({
  status: "disconnected",
  agentOnline: false,
  setStatus: (status) => set({ status }),
  setAgentOnline: (agentOnline) => set({ agentOnline }),
}));
