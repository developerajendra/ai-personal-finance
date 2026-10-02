import type { Config } from "tailwindcss";
const v = (n: string) => `var(--${n})`;
const scale = (p: string) => Object.fromEntries([100,200,300,400,500,600,700,800,900].map(s => [s, v(`${p}-${s}`)]));
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./modules/**/*.{ts,tsx}", "./shared/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: v("color-bg"), foreground: v("color-text"),
        bg: v("color-bg"), surface: v("color-surface"), panel: v("panel-bg"), tile: v("tile-bg"),
        ink: v("color-text"), divider: v("color-divider"),
        neutral: scale("color-neutral"),
        accent: { DEFAULT: v("color-accent"), ...scale("color-accent") },
        accent2: { DEFAULT: v("color-accent-2"), ...scale("color-accent-2") },
        gain: v("fin-gain"), loss: v("fin-loss"), warn: { DEFAULT: v("fin-warn"), bg: v("fin-warn-bg") },
        side: { bg: v("side-bg"), fg: v("side-fg"), muted: v("side-muted"), rule: v("side-rule") },
        nav: { hover: v("nav-hover"), sel: v("nav-sel"), "sel-fg": v("nav-sel-fg") },
        cls: { cash: v("c-cash"), dep: v("c-dep"), stock: v("c-stock"), fund: v("c-fund"), ret: v("c-ret"), prop: v("c-prop"), recv: v("c-recv"), loan: v("c-loan") },
        lad: Object.fromEntries([1,2,3,4,5,6,7].map(i => [i, v(`lad-${i}`)])),
      },
      borderRadius: { sm: v("radius-sm"), md: v("radius-md"), lg: v("radius-lg"), panel: "18px", dialog: "20px", pill: "980px" },
      boxShadow: { sm: v("shadow-sm"), md: v("shadow-md"), lg: v("shadow-lg"), panel: "0 1px 2px rgba(0,0,0,.04),0 0 0 .5px rgba(0,0,0,.05)", lift: "0 6px 20px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.05)" },
      fontFamily: { sans: ["var(--font-body)"], heading: ["var(--font-heading)"] },
      letterSpacing: { title: "-0.025em" },
    },
  },
  plugins: [],
};
export default config;
