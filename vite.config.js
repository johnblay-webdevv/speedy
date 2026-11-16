import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function readEnv(fileEnv, names) {
  return names.map((name) => process.env[name] || fileEnv[name]).find(Boolean) || "";
}

function liveTokenPlugin(fileEnv) {
  return {
    name: "speedy-live-token",
    configureServer(server) {
      server.middlewares.use("/api/live-token", async (req, res) => {
        for (const [key, value] of Object.entries(fileEnv)) {
          if (value && !process.env[key]) process.env[key] = value;
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        try {
          const { default: handler } = await server.ssrLoadModule("/api/live-token.js");
          await handler(req, res);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error.message || "Token server failed" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const url = readEnv(fileEnv, ["VITE_SUPABASE_URL", "SUPABASE_URL", "_SUPABASE_URL"]);
  const key = readEnv(fileEnv, ["VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]);

  return {
    plugins: [react(), liveTokenPlugin(fileEnv)],
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
