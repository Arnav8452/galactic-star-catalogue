// vite.config.ts or vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: './',   // use relative assets so GH Pages finds them
  plugins: [react()],
});
