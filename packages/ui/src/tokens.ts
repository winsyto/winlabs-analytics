// Design tokens para WinLabs Analytics

export const colors = {
  brand: {
    primary: "#dc2626",
    primaryForeground: "#ffffff",
  },
  sidebar: {
    bg: "#1e2530",
    foreground: "#f5f5f0",
    border: "rgba(255,255,255,0.08)",
    accent: "rgba(255,255,255,0.08)",
    activeBg: "#fff1f1",
    activeFg: "#1e2530",
  },
  topbar: {
    bg: "#2c3540",
    foreground: "#f5f5f0",
    border: "rgba(255,255,255,0.12)",
  },
  content: {
    background: "#f6f7f5",
    card: "#ffffff",
    border: "#e2e5e0",
    foreground: "#111214",
    mutedForeground: "#6b7280",
  },
} as const;

export const tokens = {
  colors,
} as const;
