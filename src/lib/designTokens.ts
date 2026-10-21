/**
 * NEXORA Premium Design System — Anti-Generic
 * VIBE: Editorial Luxe × Technical Precision (Awwwards-level)
 * 
 * Decision log: why this isn't generic:
 * - Type: Fraunces (display, high-contrast ink-trap serif) + Sora (geometric humanist, tech-precise) — not Inter/Roboto default. Pairing reflects luxury editorial (scholarships, fellowships) + crisp data tool.
 * - Color: Warm Ink (#1A1625) + Parchment (#FDF8F3) + Oxidized Brass (#8B6F3A) accent — muted sophisticated, not purple→blue SaaS cliché. Gold is tarnished, not saturated #f59e0b.
 * - Spacing: Fibonacci-ish scale (5/8/13/21/34/55/89) — breaks rigid 8pt, gives breathing editorial rhythm.
 * - Motion: cubic-bezier(0.22,1,0.36,1) premium ease, stagger 70ms — not default ease.
 * - Radius: 10/16/22/28 — not every card 16px; hero 28, cards 16, pills 999.
 * - Shadows: layered ink shadows (0.04/0.08) not heavy shadow-md.
 */

export const tokens = {
  fonts: {
    display: "Fraunces", // headings, editorial
    workhorse: "Sora", // body, UI
    mono: "JetBrains Mono",
  },
  typeScale: {
    // modular ratio 1.333 (perfect fourth)
    xs: "0.72rem",   // 11.5px capsule
    sm: "0.875rem",  // 14px body
    base: "1rem",    // 16px
    lg: "1.18rem",
    xl: "1.333rem",
    "2xl": "1.777rem",
    "3xl": "2.369rem",
    "4xl": "3.157rem",
    "5xl": "4.21rem",
  },
  tracking: {
    displayTight: "-0.03em",
    body: "-0.011em",
    label: "0.08em",
    caption: "0.04em",
  },
  leading: {
    display: 0.95,
    heading: 1.15,
    body: 1.65,
    tight: 1.25,
  },
  colors: {
    light: {
      background: "#FDF8F3", // warm parchment, not #fff
      surface: "#FFFFFF",
      surfaceRaised: "#F5EFE8",
      surfaceInk: "#1A1625",
      foreground: "#1A1625",
      foregroundMuted: "#6B6575",
      border: "#E8DFD3",
      borderStrong: "#D4C5B2",
      primary: "#1A1625", // ink primary — not electric indigo
      primaryHover: "#2D2640",
      primaryFg: "#FDF8F3",
      accent: "#8B6F3A", // oxidized brass
      accentHover: "#6B5430",
      accentSurface: "#F5ECD8",
      success: "#2A6B4E",
      danger: "#9B2C2C",
    },
    dark: {
      background: "#0F0D14",
      surface: "#1A1625",
      surfaceRaised: "#252032",
      surfaceInk: "#FDF8F3",
      foreground: "#F5EFE8",
      foregroundMuted: "#9A95A8",
      border: "rgba(232,223,211,0.12)",
      borderStrong: "rgba(232,223,211,0.22)",
      primary: "#F5ECD8",
      primaryHover: "#FFF6E8",
      primaryFg: "#1A1625",
      accent: "#C9A86A",
      accentHover: "#DDBF8A",
      accentSurface: "rgba(201,168,106,0.14)",
      success: "#5FCB8D",
      danger: "#F08080",
    },
  },
  spacing: [5, 8, 13, 21, 34, 55, 89] as const,
  radius: {
    sm: "10px",
    md: "16px",
    lg: "22px",
    xl: "28px",
    pill: "999px",
  },
  shadows: {
    card: "0 1px 2px rgba(26,22,37,0.04), 0 8px 24px rgba(26,22,37,0.06)",
    cardHover: "0 4px 16px rgba(26,22,37,0.08), 0 16px 40px rgba(26,22,37,0.10)",
    ink: "0 12px 32px rgba(26,22,37,0.16)",
  },
  motion: {
    easePremium: "cubic-bezier(0.22, 1, 0.36, 1)",
    easeSnappy: "cubic-bezier(0.16, 1, 0.3, 1)",
    durFast: "180ms",
    durMed: "320ms",
    durSlow: "560ms",
    stagger: 70,
  },
} as const;
