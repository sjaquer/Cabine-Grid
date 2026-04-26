"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";
type ThemeColor = "orange" | "emerald" | "blue" | "violet" | "amber";

interface ThemeContextProps {
  mode: ThemeMode;
  color: ThemeColor;
  setMode: (mode: ThemeMode) => void;
  setColor: (color: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [color, setColor] = useState<ThemeColor>("orange");

  // Load from localStorage on mount
  useEffect(() => {
    const storedMode = localStorage.getItem("theme-mode") as ThemeMode;
    const storedColor = localStorage.getItem("theme-color") as ThemeColor;
    
    if (storedMode) setMode(storedMode);
    if (storedColor) setColor(storedColor);
  }, []);

  // Apply to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(mode);
    localStorage.setItem("theme-mode", mode);
  }, [mode]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute("data-color", color);
    localStorage.setItem("theme-color", color);
  }, [color]);

  return (
    <ThemeContext.Provider value={{ mode, color, setMode, setColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
