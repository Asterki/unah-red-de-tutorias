import { theme, type ThemeConfig } from "antd";
import type { AppBranding } from "@unah-red-tutores/shared";

export type ThemeMode = "light" | "dark";

const FONT_FAMILY = [
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
].join(", ");

const SURFACES = {
  light: {
    layout: "#f5f7fa",
    surface: "#ffffff",
    border: "#e5e7eb",
    text: "rgba(0, 0, 0, 0.88)",
  },
  dark: {
    layout: "#0f1115",
    surface: "#181b22",
    border: "#2a2f3a",
    text: "rgba(255, 255, 255, 0.88)",
  },
} as const;

/** Build the single Ant Design theme used by the whole application. */
export function buildTheme(
  mode: ThemeMode,
  brand: Pick<AppBranding, "brandColor">,
): ThemeConfig {
  const surfaces = SURFACES[mode];

  return {
    algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: brand.brandColor,
      borderRadius: 8,
      fontFamily: FONT_FAMILY,
      colorBgLayout: surfaces.layout,
    },
    components: {
      Layout: {
        headerBg: brand.brandColor,
        bodyBg: surfaces.layout,
        siderBg: surfaces.surface,
        headerHeight: 64,
        headerPadding: "0 16px",
      },
      Menu: {
        itemBg: surfaces.surface,
        itemColor: surfaces.text,
        itemHoverBg: `${brand.brandColor}14`,
        itemSelectedBg: `${brand.brandColor}1f`,
        itemSelectedColor: brand.brandColor,
      },
      Button: {
        borderRadius: 8,
        fontWeight: 500,
        primaryShadow: "none",
        defaultShadow: "none",
      },
      Table: {
        headerBg: surfaces.surface,
        headerColor: surfaces.text,
        borderColor: surfaces.border,
        rowHoverBg: `${brand.brandColor}0d`,
      },
      Modal: {
        contentBg: surfaces.surface,
        headerBg: surfaces.surface,
        titleColor: surfaces.text,
      },
    },
  };
}
