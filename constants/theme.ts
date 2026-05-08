/**
 * Piko Task Manager - Design System
 * Minimalist, clean, and calm interface with focus on clarity and usability
 */

import { Platform } from "react-native";

// Primary accent color - soft blue
const primaryBlue = "#5EACDA";

// Color palette following 80% white, 20% accent rule
export const Colors = {
  light: {
    // Backgrounds
    background: "#FFFFFF", // Pure white (80% of UI)
    card: "#F7F8FA", // Light gray for cards
    surface: "#FFFFFF",

    // Text
    text: "#1A1A1A", // Dark gray/black for primary text
    textSecondary: "#888888", // Gray for subtext
    textTertiary: "#B0B0B0",

    // Accent
    tint: primaryBlue, // Soft blue accent (20% of UI)
    tintLight: "rgba(94, 172, 218, 0.1)", // Light tint background
    tintMedium: "rgba(94, 172, 218, 0.2)",

    // Status colors
    success: "#4CAF50",
    error: "#EF5350",
    warning: "#FFA726",
    info: "#42A5F5",

    // Priorities
    priorityHighBackground: "#FEECEC",
    priorityHighText: "#C94A4A",
    priorityMediumBackground: "#FFF4E5",
    priorityMediumText: "#C27A1A",
    priorityLowBackground: "#EEF3F8",
    priorityLowText: "#5E748C",

    // Icons
    icon: "#687076",
    iconDefault: "#888888",
    iconSelected: primaryBlue,
    tabIconDefault: "#888888",
    tabIconSelected: primaryBlue,

    // Borders & Dividers
    border: "#E8E8E8",
    divider: "#F0F0F0",

    // Shadows
    shadow: "rgba(0, 0, 0, 0.08)",
    shadowMedium: "rgba(0, 0, 0, 0.12)",
  },
  dark: {
    // Backgrounds
    background: "#1A1A1A",
    card: "#242424",
    surface: "#2C2C2C",

    // Text
    text: "#ECEDEE",
    textSecondary: "#A0A0A0",
    textTertiary: "#707070",

    // Accent
    tint: primaryBlue,
    tintLight: "rgba(94, 172, 218, 0.15)",
    tintMedium: "rgba(94, 172, 218, 0.25)",

    // Status colors
    success: "#66BB6A",
    error: "#EF5350",
    warning: "#FFA726",
    info: "#42A5F5",

    // Icons
    icon: "#9BA1A6",
    iconDefault: "#888888",
    iconSelected: primaryBlue,
    tabIconDefault: "#888888",
    tabIconSelected: primaryBlue,

    // Borders & Dividers
    border: "#333333",
    divider: "#2A2A2A",

    // Shadows
    shadow: "rgba(0, 0, 0, 0.3)",
    shadowMedium: "rgba(0, 0, 0, 0.4)",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
