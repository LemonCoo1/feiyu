/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        feiyu: {
          bg: "#f5f5f6",
          "bg-hover": "#eeeff0",
          sidebar: "#2b2f36",
          "sidebar-hover": "#3a3f48",
          primary: "#3370ff",
          "primary-hover": "#2860e1",
          "primary-light": "#e8f0fe",
          border: "#e5e5e6",
          "border-light": "#f0f0f1",
          text: "#1f2329",
          "text-secondary": "#646a73",
          "text-muted": "#8f959e",
          "bubble-own": "#3370ff",
          "bubble-other": "#ffffff",
          "online": "#34c724",
          success: "#34c724",
          warning: "#ff9500",
          danger: "#f54a45",
        },
      },
      boxShadow: {
        "feiyu-sm": "0 1px 2px 0 rgba(0,0,0,0.05)",
        "feiyu": "0 2px 8px 0 rgba(0,0,0,0.08)",
        "feiyu-md": "0 4px 16px 0 rgba(0,0,0,0.1)",
      },
    },
  },
  plugins: [],
};
