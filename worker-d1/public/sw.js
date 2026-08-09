self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const kind = payload.kind === "watch" ? "watch" : "reset";
  const title = payload.title ||
    (kind === "watch" ? "⚠️ Codex 可能在 24 小时内重置" : "✅ Codex 重置已确认");
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || (kind === "watch"
      ? "这是预测，尚未确认重置。"
      : "已确认 Codex 使用额度完成重置。"),
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
