/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        feiyu: {
          bg: "#f7f7f8",
          sidebar: "#2b2f36",
          primary: "#4f9cf7",
          "primary-hover": "#3b82f6",
          border: "#e5e5e6",
          text: "#1f2937",
          "text-secondary": "#6b7280",
          "text-muted": "#9ca3af",
        },
      },
    },
  },
  plugins: [],
};
