import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function readEnv(fileEnv, names) {
  return names.map((name) => process.env[name] || fileEnv[name]).find(Boolean) || "";
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const url = readEnv(fileEnv, ["VITE_SUPABASE_URL", "SUPABASE_URL", "_SUPABASE_URL"]);
  const key = readEnv(fileEnv, ["VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]);

  return {
    plugins: [react()],
    base: "./",
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(key),
    },
    server: {
      port: 5173,
      host: "127.0.0.1",
    },
  };
});
