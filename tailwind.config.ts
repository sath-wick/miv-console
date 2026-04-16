import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--bg-primary)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)"
        },
        accent: {
          primary: "var(--accent-primary)",
          soft: "var(--accent-soft)"
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          disabled: "var(--text-disabled)"
        },
        border: {
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)"
        }
      },
      borderRadius: {
        card: "8px",
        control: "8px"
      },
      maxWidth: {
        app: "1120px"
      }
    }
  },
  plugins: []
};

export default config;
