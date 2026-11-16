import { AccessToken, RoomServiceClient, TokenVerifier } from "livekit-server-sdk";

function clean(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function env(...names) {
  return names.map((name) => clean(process.env[name])).find(Boolean) || "";
}

function livekitUrl(value) {
  let url = clean(value);
  if (!url) return "";
  url = url.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
  return url.replace(/\/$/, "");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const url = livekitUrl(env("LIVEKIT_URL"));
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");

  if (!url || !apiKey || !apiSecret) {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        ok: false,
        error: "Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET on Vercel.",
      }),
    );
    return;
  }

  try {
    const access = new AccessToken(apiKey, apiSecret, { identity: "health", name: "health", ttl: "5m" });
    access.addGrant({ roomJoin: true, room: "health-check", canPublish: false, canSubscribe: true });
    const token = await access.toJwt();
    await new TokenVerifier(apiKey, apiSecret).verify(token);

    const host = url.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
    const rooms = new RoomServiceClient(host, apiKey, apiSecret);
    await rooms.listRooms();

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        url,
        keyPrefix: apiKey.slice(0, 6),
      }),
    );
  } catch (error) {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        ok: false,
        url,
        keyPrefix: apiKey.slice(0, 6),
        error:
          "LiveKit rejected these keys. Recreate a key in LiveKit, paste URL + API key + API secret into Vercel from the same popup (no quotes), then redeploy.",
        detail: error.message || "invalid token",
      }),
    );
  }
}
