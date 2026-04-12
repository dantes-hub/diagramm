import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102033",
        mist: "#ecf3f9",
        steel: "#6280a1",
        signal: "#0d8ecf",
        success: "#0e9f6e",
        warn: "#b7791f"
      },
      boxShadow: {
        panel: "0 24px 60px rgba(16, 32, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
