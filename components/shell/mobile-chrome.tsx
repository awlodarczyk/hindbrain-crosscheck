"use client";

import { createContext, useContext, useEffect } from "react";

export type MobileChrome = {
  /** Element inside the mobile top bar's action slot that screens may portal into. */
  actionsEl: HTMLElement | null;
  setTitle: (title: string | null) => void;
};

const NOOP: MobileChrome = { actionsEl: null, setTitle: () => undefined };

export const MobileChromeContext = createContext<MobileChrome>(NOOP);

export const useMobileChrome = (): MobileChrome => useContext(MobileChromeContext);

/** Sets the mobile top bar title while the calling screen is mounted. */
export function useMobileTitle(title: string | null): void {
  const { setTitle } = useMobileChrome();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}
