const pool = require("./db");

// Expo Push API — no server key needed; delivery is keyed by the device's Expo token.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Send a push to every device registered for a Clerk user. Fire-and-forget; never
// throws into the caller (a failed push must not fail the message send).
async function sendPush(userId, { title, body, data }) {
  try {
    const { rows } = await pool.query("SELECT token FROM push_tokens WHERE clerk_user_id = $1", [userId]);
    const tokens = rows.map((r) => r.token).filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"));
    if (!tokens.length) return;
    const messages = tokens.map((to) => ({ to, title, body, data, sound: "default" }));
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error("push send failed:", e.message);
  }
}

module.exports = { sendPush };
