import { createClient } from "@supabase/supabase-js";
import { AccessToken, TokenVerifier } from "livekit-server-sdk";

function clean(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function env(...names) {
  return names.map((name) => clean(process.env[name])).find(Boolean) || "";
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

function publicUrl(value) {
  const url = clean(value);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "";
    if (!parsed.hostname.endsWith(".supabase.co")) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function livekitUrl(value) {
  let url = clean(value);
  if (!url) return "";
  url = url.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
  return url.replace(/\/$/, "");
}

async function signLiveToken({ apiKey, apiSecret, identity, name, room, canPublish }) {
  const access = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: "2h",
  });
  access.addGrant({
    roomJoin: true,
    room,
    canPublish: Boolean(canPublish),
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await access.toJwt();
  // Catch key/secret mismatches before the browser tries to connect.
  await new TokenVerifier(apiKey, apiSecret).verify(token);
  return token;
}

export async function mintLiveToken(req) {
  const url = livekitUrl(env("LIVEKIT_URL"));
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");

  if (!url || !apiKey || !apiSecret) {
    const error = new Error("Live streaming is not configured yet.");
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
  const liveId = clean(body?.liveId);
  if (!liveId) {
    const error = new Error("Missing LIVE room.");
    error.status = 400;
    throw error;
  }

  const supabaseUrl =
    env("VITE_SUPABASE_URL", "SUPABASE_URL", "_SUPABASE_URL") || publicUrl(body?.supabaseUrl);
  const supabaseKey =
    env("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "_SUPABASE_ANON_KEY") || clean(body?.supabaseKey);

  if (!supabaseUrl || !supabaseKey) {
    const error = new Error("Supabase is not configured.");
    error.status = 503;
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

  let liveToken;
  try {
    liveToken = await signLiveToken({
      apiKey,
      apiSecret,
      identity: user.id,
      name,
      room: liveId,
      canPublish: host,
    });
  } catch {
    const error = new Error(
      "LiveKit keys look wrong. In Vercel, set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET from the same Create key popup, then redeploy.",
    );
    error.status = 503;
    throw error;
  }

  return {
    token: liveToken,
    url,
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
