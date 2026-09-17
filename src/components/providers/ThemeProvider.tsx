"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    }
  }, [theme]);

  return <>{children}</>;
}
