/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        feiyu: {
          primary: "var(--feiyu-primary)",
          "primary-hover": "var(--feiyu-primary-hover)",
          "primary-light": "var(--feiyu-primary-light)",
          bg: "var(--feiyu-bg)",
          "bg-secondary": "var(--feiyu-bg-secondary)",
          card: "var(--feiyu-card)",
          "card-hover": "var(--feiyu-card-hover)",
          text: "var(--feiyu-text)",
          "text-secondary": "var(--feiyu-text-secondary)",
          "text-muted": "var(--feiyu-text-muted)",
          border: "var(--feiyu-border)",
          success: "var(--feiyu-success)",
          warning: "var(--feiyu-warning)",
          danger: "var(--feiyu-danger)",
        },
      },
    },
  },
  plugins: [],
};
