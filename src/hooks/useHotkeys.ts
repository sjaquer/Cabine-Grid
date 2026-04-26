"use client";

import { useEffect } from "react";

type KeyBinding = {
  key: string; // 'f1', 'f2', 'escape', 'ctrl+b', 'ctrl+k'
  callback: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
};

export function useHotkeys(bindings: KeyBinding[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const pressedKey = e.key.toLowerCase();
      const isCtrl = e.ctrlKey;
      const isShift = e.shiftKey;

      bindings.forEach((binding) => {
        const keyDef = binding.key.toLowerCase().trim();
        
        if (keyDef.startsWith("ctrl+")) {
          const targetKey = keyDef.replace("ctrl+", "");
          if (isCtrl && pressedKey === targetKey) {
            if (binding.preventDefault !== false) e.preventDefault();
            binding.callback(e);
          }
        } else if (keyDef.startsWith("shift+")) {
          const targetKey = keyDef.replace("shift+", "");
          if (isShift && pressedKey === targetKey) {
            if (binding.preventDefault !== false) e.preventDefault();
            binding.callback(e);
          }
        } else if (pressedKey === keyDef) {
          if (binding.preventDefault !== false) e.preventDefault();
          binding.callback(e);
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bindings]);
}
