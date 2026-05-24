import React, { createContext, useContext, useState, useEffect } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyTheme } from "../theme";

const ThemeContext = createContext({ mode: "dark", scheme: "dark", setTheme: () => {}, rev: 0 });

export function ThemeProvider({ children }) {
  const [mode, setMode]     = useState("light");   // preference: light | dark | system
  const [scheme, setScheme] = useState("light");   // resolved scheme actually applied: light | dark
  const [rev, setRev]       = useState(0);

  useEffect(() => {
    AsyncStorage.getItem("theme_mode").then(saved => {
      const m = saved || "light";
      const resolved = m === "system" ? (Appearance.getColorScheme() || "dark") : m;
      setMode(m);
      setScheme(resolved);
      applyTheme(resolved);
      setRev(r => r + 1);
    });
  }, []);

  // In system mode, follow live OS appearance changes
  useEffect(() => {
    if (mode !== "system") return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const resolved = colorScheme || "dark";
      setScheme(resolved);
      applyTheme(resolved);
      setRev(r => r + 1);
    });
    return () => sub.remove();
  }, [mode]);

  const setTheme = async (newMode) => {
    const resolved = newMode === "system" ? (Appearance.getColorScheme() || "dark") : newMode;
    applyTheme(resolved);
    setMode(newMode);
    setScheme(resolved);
    setRev(r => r + 1);
    await AsyncStorage.setItem("theme_mode", newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, scheme, setTheme, rev }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
