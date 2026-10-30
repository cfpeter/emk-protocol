import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;
const pages = ["index", "series", "protocol", "minds", "lookbook", "order", "404"];

// <!-- @include name --> pulls partials/name.html into every page at build and dev time,
// so the shared header, menu and Protocol bar are real HTML (readable without JS).
const partials = {
  name: "emk-partials",
  transformIndexHtml(html) {
    return html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name) =>
      readFileSync(resolve(root, "partials", `${name}.html`), "utf8"));
  },
};

export default defineConfig({
  base: "./",
  plugins: [partials],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
