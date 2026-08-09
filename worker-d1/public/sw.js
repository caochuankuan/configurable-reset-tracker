self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const kind = payload.kind === "featured" ? "featured" : "post";
  const title = payload.title ||
    (kind === "featured" ? "📌 本周精选文章" : "✍️ 新文章已发布");
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || (kind === "featured"
      ? "本周值得阅读的文章已经选出。"
      : "博客刚刚发布了一篇新文章。"),
    tag: kind === "featured" ? "blog-featured" : "blog-post",
    data: {
      kind,
      url: payload.url || "/",
    },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

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
