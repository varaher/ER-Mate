export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: pushToken, title, body, data: data || {} }),
    });
  } catch (e) {
    console.warn("[Push] Failed to send notification:", e);
  }
}

export async function sendPushToMany(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const valid = tokens.filter((t) => t?.startsWith("ExponentPushToken"));
  if (!valid.length) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        valid.map((to) => ({ to, title, body, data: data || {} }))
      ),
    });
  } catch (e) {
    console.warn("[Push] Failed to send bulk notifications:", e);
  }
}
