// Maps light-mode custom colors to their dark-mode equivalents
const BG_LIGHT_TO_DARK: Record<string, string> = {
  "#FFFFFF": "#1A1A1A",
  "#F3F4F6": "#374151",
  "#E5E7EB": "#374151",
  "#FED7AA": "#7C2D12",
  "#DCFCE7": "#14532D",
  "#BBF7D0": "#14532D",
  "#DBEAFE": "#1E3A5F",
  "#BFDBFE": "#1E3A5F",
  "#FEF9C3": "#713F12",
  "#FEF08A": "#713F12",
  "#FEE2E2": "#7F1D1D",
  "#FECACA": "#7F1D1D",
  "#EDE9FE": "#3B0764",
  "#DDD6FE": "#4C1D95",
};

const TEXT_LIGHT_TO_DARK: Record<string, string> = {
  "#000000": "#F1F1F1",
  "#FFFFFF": "#000000",
};

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function resolveColor(color: string | null, type: "bg" | "text"): string | null {
  if (!color) return null;
  if (!isDarkMode()) return color;
  const upper = color.toUpperCase();
  const map = type === "bg" ? BG_LIGHT_TO_DARK : TEXT_LIGHT_TO_DARK;
  return map[upper] ?? color;
}
