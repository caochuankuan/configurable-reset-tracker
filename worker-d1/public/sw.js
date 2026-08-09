self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const kind = payload.kind === "watch" ? "watch" : "reset";
  const title = payload.title ||
    (kind === "watch" ? "⚠️ Possible Codex reset within 24h" : "✅ Codex reset confirmed");
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || (kind === "watch"
      ? "Prediction, not a confirmed reset."
      : "A Codex usage-limit reset was confirmed."),
    tag: kind === "watch" ? "codex-reset-watch" : "codex-reset-confirmed",
    data: {
      kind,
      url: payload.url || "https://codex-resets.com/",
    },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "https://codex-resets.com/";

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windows.length > 0) {
      const client = windows[0];
      if ("navigate" in client) await client.navigate(url);
      return client.focus();
    }
    return clients.openWindow(url);
  })());
});
