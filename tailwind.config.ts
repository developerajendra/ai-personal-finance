import type { Config } from "tailwindcss";

// Ledger design tokens. Every value resolves to a CSS variable defined in app/ledger-theme.css,
// so the active skin (Apple / Midnight / Sand / Mint / Private) and accent re-theme the whole app.
const v = (n: string) => `var(--${n})`;
const scale = (p: string) =>
  Object.fromEntries([100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, v(`${p}-${s}`)]));

const accent = { DEFAULT: v("color-accent"), 50: v("color-accent-100"), ...scale("color-accent") };

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",
    "./shared/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: v("color-bg"),
        foreground: v("color-text"),
        bg: v("color-bg"),
        surface: v("color-surface"),
        panel: v("panel-bg"),
        tile: v("tile-bg"),
        ink: v("color-text"),
        muted: v("color-neutral-600"),
        divider: v("color-divider"),
        neutral: scale("color-neutral"),
        accent,
        accent2: { DEFAULT: v("color-accent-2"), ...scale("color-accent-2") },
        gain: { DEFAULT: v("fin-gain"), bg: v("fin-gain-bg") },
        loss: { DEFAULT: v("fin-loss"), bg: v("fin-loss-bg") },
        warn: { DEFAULT: v("fin-warn"), bg: v("fin-warn-bg") },
        side: { bg: v("side-bg"), fg: v("side-fg"), muted: v("side-muted"), rule: v("side-rule") },
        nav: { hover: v("nav-hover"), sel: v("nav-sel"), "sel-fg": v("nav-sel-fg") },
        cls: {
          cash: v("c-cash"),
          dep: v("c-dep"),
          stock: v("c-stock"),
          fund: v("c-fund"),
          ret: v("c-ret"),
          prop: v("c-prop"),
          recv: v("c-recv"),
          loan: v("c-loan"),
        },
        lad: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [i, v(`lad-${i}`)])),
      },
      borderColor: {
        DEFAULT: v("color-divider"),
      },
      ringColor: {
        DEFAULT: v("color-accent"),
      },
      borderRadius: {
        sm: v("radius-sm"),
        md: v("radius-md"),
        lg: v("radius-lg"),
        panel: v("radius-panel"),
        dialog: v("radius-dialog"),
        pill: "980px",
      },
      boxShadow: {
        sm: v("shadow-sm"),
        md: v("shadow-md"),
        lg: v("shadow-lg"),
        panel: v("shadow-panel"),
        lift: v("shadow-lift"),
      },
      fontFamily: {
        sans: [v("font-body")],
        heading: [v("font-heading")],
      },
      letterSpacing: {
        title: "-0.025em",
      },
      spacing: {
        sidebar: "252px",
        "sidebar-collapsed": "72px",
      },
    },
  },
  plugins: [],
};
export default config;
