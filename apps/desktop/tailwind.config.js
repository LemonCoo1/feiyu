/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        feiyu: {
          bg: "var(--feiyu-bg)",
          "bg-hover": "var(--feiyu-bg-hover)",
          card: "var(--feiyu-card)",
          sidebar: "var(--feiyu-sidebar)",
          "sidebar-hover": "var(--feiyu-sidebar-hover)",
          primary: "var(--feiyu-primary)",
          "primary-hover": "var(--feiyu-primary-hover)",
          "primary-light": "var(--feiyu-primary-light)",
          border: "var(--feiyu-border)",
          "border-light": "var(--feiyu-border-light)",
          text: "var(--feiyu-text)",
          "text-secondary": "var(--feiyu-text-secondary)",
          "text-muted": "var(--feiyu-text-muted)",
          "bubble-own": "var(--feiyu-bubble-own)",
          "bubble-other": "var(--feiyu-bubble-other)",
          online: "#34c724",
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
