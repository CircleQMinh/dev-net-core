import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { rawMarkdownHashPathPlugin } from "./build/vite/rawMarkdownHashPathPlugin";

export default defineConfig({
  base: "/",
  plugins: [
    rawMarkdownHashPathPlugin(),
    reactRouter(),
    tailwindcss(),
  ],
  root: fileURLToPath(new URL(".", import.meta.url)),
});
