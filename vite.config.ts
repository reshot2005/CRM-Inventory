import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const root = path.resolve(__dirname);
  const stockosWeb = path.join(root, "stockos-web");
  const viteRoot = loadEnv(mode, root, "VITE_");
  const nextWeb = fs.existsSync(stockosWeb)
    ? loadEnv(mode, stockosWeb, "NEXT_PUBLIC_")
    : {};

  /** Bridge Next.js env from stockos-web so the Vite app can use Supabase without duplicating keys. */
  const defineEnv: Record<string, string> = {};

  const supaUrl =
    viteRoot.VITE_SUPABASE_URL || nextWeb.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey =
    viteRoot.VITE_SUPABASE_ANON_KEY || nextWeb.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supaUrl && !viteRoot.VITE_SUPABASE_URL) {
    defineEnv["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(supaUrl);
  }
  if (supaKey && !viteRoot.VITE_SUPABASE_ANON_KEY) {
    defineEnv["import.meta.env.VITE_SUPABASE_ANON_KEY"] = JSON.stringify(supaKey);
  }

  if (!viteRoot.VITE_API_URL && nextWeb.NEXT_PUBLIC_API_URL) {
    const base = String(nextWeb.NEXT_PUBLIC_API_URL).replace(/\/$/, "");
    defineEnv["import.meta.env.VITE_API_URL"] = JSON.stringify(`${base}/api/v1`);
  }

  // Do not bridge NEXT_PUBLIC_APP_URL → VITE_APP_URL: that is the Next.js app origin (e.g. :3000),
  // not this Vite app (:8080). Omit VITE_APP_URL and getAppOrigin() uses window.location.origin in the browser.

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    define: defineEnv,
  };
});
