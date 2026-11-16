import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

function env(...names) {
  return names.map((name) => process.env[name]).find(Boolean) || "";
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    if (typeof req.body === "string") {
      try {
        resolve(JSON.parse(req.body || "{}"));
      } catch (error) {
        reject(error);
      }
      return;
    }
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export async function mintLiveToken(req) {
  const livekitUrl = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  const supabaseUrl = env("VITE_SUPABASE_URL", "SUPABASE_URL");
  const supabaseKey = env("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");

  if (!livekitUrl || !apiKey || !apiSecret) {
    const error = new Error("Live streaming is not configured yet.");
    error.status = 503;
    throw error;
  }
  if (!supabaseUrl || !supabaseKey) {
    const error = new Error("Supabase is not configured.");
    error.status = 503;
    throw error;
  }

  const auth = req.headers.authorization || req.headers.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    const error = new Error("Please log in again.");
    error.status = 401;
    throw error;
  }

  const body = await readBody(req);
  const liveId = String(body?.liveId || "").trim();
  if (!liveId) {
    const error = new Error("Missing LIVE room.");
    error.status = 400;
    throw error;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    const error = new Error("Please log in again.");
    error.status = 401;
    throw error;
  }

  const user = userData.user;
  const { data: live, error: liveError } = await supabase
    .from("lives")
    .select("id, host_id, ended_at, title")
    .eq("id", liveId)
    .maybeSingle();

  if (liveError) {
    const error = new Error(liveError.message || "Couldn't open this LIVE.");
    error.status = 400;
    throw error;
  }
  if (!live || live.ended_at) {
    const error = new Error("This LIVE has ended.");
    error.status = 404;
    throw error;
  }

  const host = live.host_id === user.id;
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = profile?.display_name || user.email?.split("@")[0] || "Viewer";

  const access = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name,
    ttl: "2h",
  });
  access.addGrant({
    roomJoin: true,
    room: liveId,
    canPublish: host,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await access.toJwt(),
    url: livekitUrl,
    host,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    json(res, 200, await mintLiveToken(req));
  } catch (error) {
    json(res, error.status || 500, { error: error.message || "Couldn't start streaming" });
  }
}
