"use client";

import { createContext, useContext } from "react";
import type { HistoryItem } from "./group-by-day";

export type SessionListActions = {
  upsert: (item: HistoryItem) => void;
  refresh: () => Promise<void>;
};

const NOOP: SessionListActions = { upsert: () => undefined, refresh: async () => undefined };

export const SessionListContext = createContext<SessionListActions>(NOOP);

/** Lets screens push live changes into the sidebar history list. */
export const useSessionListActions = (): SessionListActions => useContext(SessionListContext);
