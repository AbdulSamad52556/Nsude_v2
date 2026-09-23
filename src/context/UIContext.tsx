"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface UIContextValue {
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  /** True once the preloader has started lifting, so entrance animations
      (e.g. the home hero headline) play where the visitor can see them. */
  introReady: boolean;
  markIntroReady: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const markIntroReady = useCallback(() => setIntroReady(true), []);

  return (
    <UIContext.Provider
      value={{ isSearchOpen, openSearch, closeSearch, introReady, markIntroReady }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
