// Bootstrap layer: fetch data (or fall back to demo), render the pure HTML
// string into the page, then enhance it with viewer-local time formatting
// and interactive behaviors (tooltips). No rendering logic lives here beyond
// string interpolation done in render.js.

import { formatRelative, renderPage } from "./render.js";
import { getDemoData } from "./demo-data.js";

const root = document.getElementById("app");
const VAPID_PUBLIC_KEY = "BMw5OG-2Vl-saWPEafYmp_hcSzZVLaJAV6cyoX0bleDqY3f33d6gQ_oy3UWnRrmaks-jkSaY8cPJz7D1bDqw1NA";

async function loadData() {
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") {
    return getDemoData();
  }
  try {
    const res = await fetch("./content.json", { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json || !Array.isArray(json.posts)) throw new Error("响应格式不正确");
    return { ...json, isDemo: false };
  } catch (err) {
    console.warn("[codex-resets] live data unavailable, falling back to demo data:", err);
    return getDemoData();
  }
}

// ---------------------------------------------------------------------------
// Local-time formatting helpers
// ---------------------------------------------------------------------------
const absoluteFmt = typeof Intl !== "undefined"
  ? new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  : null;

const shortDateFmt = typeof Intl !== "undefined"
  ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" })
  : null;

function formatAbsolute(dateMs) {
  if (absoluteFmt) return absoluteFmt.format(new Date(dateMs));
  return new Date(dateMs).toString();
}

function formatShortDate(dateMs) {
  if (shortDateFmt) return shortDateFmt.format(new Date(dateMs));
  return new Date(dateMs).toDateString();
}

function enhanceTimes(scope) {
  scope.querySelectorAll('[data-role="relative-time"]').forEach((el) => {
    const iso = el.getAttribute("data-datetime");
    if (!iso) return;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return;
    const rel = formatRelative(ms);
    if (el.textContent !== rel) el.textContent = rel;
    el.title = formatAbsolute(ms);
  });

  scope.querySelectorAll('[data-role="absolute-time"]').forEach((el) => {
    const iso = el.getAttribute("data-datetime");
    if (!iso) return;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return;
    el.textContent = formatAbsolute(ms);
  });

  scope.querySelectorAll('[data-role="short-date"]').forEach((el) => {
    const iso = el.getAttribute("data-datetime");
    if (!iso) {
      el.textContent = "—";
      return;
    }
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return;
    el.textContent = formatShortDate(ms);
  });

}

// ---------------------------------------------------------------------------
// Contribution graph tooltip behavior
// ---------------------------------------------------------------------------
// Deadpan lines for empty days, picked deterministically per date so a cell
// tells the same joke every time you hover it.
const QUIET_DAY_LINES = [
  "这天没有更新，可能在认真写代码。",
  "没有新文章，但事情仍在发生。",
  "这天很安静，灵感正在后台运行。",
  "没有更新，也许是在认真生活。",
  "空白的一天，也属于创作过程。",
];

function quietLine(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  return QUIET_DAY_LINES[Math.abs(hash) % QUIET_DAY_LINES.length];
}

function enhanceGraph(scope) {
  // When the grid overflows its container, land on the most recent weeks,
  // not January.
  const scroller = scope.querySelector(".cg-scroll");
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;

  const tooltip = scope.querySelector("#cg-tooltip");
  if (!tooltip) return;
  const cells = scope.querySelectorAll(".cg-cell[data-date]");

  function dateLabel(dateStr) {
    // dateStr is YYYY-MM-DD in UTC (the graph's day bucket).
    const d = new Date(`${dateStr}T00:00:00Z`);
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(d);
  }

  function showTooltip(cell) {
    const count = Number(cell.getAttribute("data-count") || "0");
    const date = cell.getAttribute("data-date");
    const snippet = cell.getAttribute("data-snippet") || "";
    const countLabel = count === 0 ? quietLine(date) : count > 1 ? `这一天发布了 ${count} 篇文章。` : "";
    tooltip.innerHTML = `<strong>${dateLabel(date)}</strong>（UTC）${countLabel ? `<br>${countLabel}` : ""}${snippet ? `<br><span class="cg-tooltip-snippet">${snippet}${snippet.length >= 120 ? "…" : ""}</span>` : ""}`;
    tooltip.hidden = false;

    const cellRect = cell.getBoundingClientRect();
    const containerRect = scope.querySelector(".cg-container").getBoundingClientRect();
    // Measure after content is set and the tooltip is visible. Keep the box
    // inside the container, while independently anchoring its arrow to the
    // hovered cell when the box has to shift near an edge.
    const tooltipWidth = tooltip.offsetWidth;
    const half = tooltipWidth / 2;
    const cellCenter = cellRect.left - containerRect.left + cellRect.width / 2;
    const left = Math.max(half, Math.min(cellCenter, containerRect.width - half));
    const arrowInset = 8;
    const arrowLeft = Math.max(arrowInset, Math.min(half + cellCenter - left, tooltipWidth - arrowInset));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${cellRect.top - containerRect.top}px`;
    tooltip.style.setProperty("--cg-tooltip-arrow-left", `${arrowLeft}px`);
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  cells.forEach((cell) => {
    cell.addEventListener("mouseenter", () => showTooltip(cell));
    cell.addEventListener("focus", () => showTooltip(cell));
    cell.addEventListener("mouseleave", hideTooltip);
    cell.addEventListener("blur", hideTooltip);
  });
}

// ---------------------------------------------------------------------------
// Post dialog
// ---------------------------------------------------------------------------
function enhancePostDialog(scope, posts) {
  const dialog = scope.querySelector('[data-role="post-dialog"]');
  const close = scope.querySelector('[data-role="post-dialog-close"]');
  const title = scope.querySelector('[data-role="post-dialog-title"]');
  const meta = scope.querySelector('[data-role="post-dialog-meta"]');
  const body = scope.querySelector('[data-role="post-dialog-body"]');
  if (!dialog || !close || !title || !meta || !body) return;

  const byId = new Map(posts.map((post) => [post.id, post]));
  let opener = null;

  scope.addEventListener("click", (event) => {
    const button = event.target.closest?.('[data-role="post-open"]');
    if (!button) return;
    const post = byId.get(button.dataset.postId);
    if (!post) return;
    opener = button;
    title.textContent = post.title;
    meta.textContent = formatAbsolute(Date.parse(post.published_at));
    body.replaceChildren(...post.content.map((paragraph) => {
      const element = document.createElement("p");
      element.textContent = paragraph;
      return element;
    }));
    dialog.showModal();
  });

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => opener?.focus());
}

// ---------------------------------------------------------------------------
// Web Push subscription control
// ---------------------------------------------------------------------------
function decodeBase64Url(value) {
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - value.length % 4) % 4)}`;
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function postPush(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

function trackEvent(name) {
  try {
    window.stonks?.event?.(name);
  } catch (error) {
    console.warn("[codex-resets] analytics event failed:", error);
  }
}

async function enhancePushControl(scope) {
  const control = scope.querySelector('[data-role="push-control"]');
  const toggle = scope.querySelector('[data-role="push-toggle"]');
  const label = scope.querySelector('[data-role="push-label"]');
  const hint = scope.querySelector('[data-role="push-hint"]');
  if (!control || !toggle || !label || !hint) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return;
  }

  control.hidden = false;
  let subscription = null;
  let hintTimer;

  function showHint(text, duration = 6000) {
    clearTimeout(hintTimer);
    hint.textContent = text;
    if (text) hintTimer = setTimeout(() => { hint.textContent = ""; }, duration);
  }

  function reflectState() {
    const enabled = subscription !== null;
    toggle.setAttribute("aria-pressed", String(enabled));
    label.textContent = enabled ? "浏览器已开启" : "浏览器";
    toggle.title = enabled
      ? "停止接收新文章的浏览器通知"
      : "新文章发布时接收浏览器通知";
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    subscription = registration ? await registration.pushManager.getSubscription() : null;
    reflectState();
  } catch {
    showHint("暂时无法检查浏览器通知状态。");
  }

  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    showHint("");
    try {
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        subscription = null;
        reflectState();
        try {
          await postPush("/api/push/unsubscribe", { endpoint });
        } catch (error) {
          // The browser-side unsubscribe already succeeded; the server's stale
          // row self-heals when the next push comes back 410.
          console.warn("[codex-resets] unsubscribe cleanup failed:", error);
        }
        showHint("浏览器通知已关闭。");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showHint("通知已被浏览器拦截，请在浏览器设置中允许通知。");
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY),
      });
      try {
        await postPush("/api/push/subscribe", newSubscription.toJSON());
      } catch (error) {
        await newSubscription.unsubscribe();
        throw error;
      }
      subscription = newSubscription;
      reflectState();
      trackEvent("Push notifications enabled");
      showHint("已开启，新文章发布时会第一时间通知你。", 3000);
    } catch (error) {
      console.warn("[codex-resets] notification subscription failed:", error);
      showHint("开启失败，请重试。");
    } finally {
      toggle.disabled = false;
    }
  });
}

function enhanceTelegramLink(scope) {
  const link = scope.querySelector('[data-role="telegram-link"]');
  if (!link) return;
  link.addEventListener("click", () => trackEvent("Telegram channel opened"));
}

async function enhanceEmailControl(scope) {
  const toggle = scope.querySelector('[data-role="email-toggle"]');
  const form = scope.querySelector('[data-role="email-form"]');
  const input = scope.querySelector('[data-role="email-input"]');
  const submit = scope.querySelector('[data-role="email-submit"]');
  const label = scope.querySelector('[data-role="email-label"]');
  const hint = scope.querySelector('[data-role="email-hint"]');
  if (!toggle || !form || !input || !submit || !label || !hint) return;

  function setOpen(open) {
    form.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open && !hint.textContent) input.focus();
  }

  function showHint(text, state = "info") {
    hint.textContent = text;
    hint.hidden = !text;
    hint.dataset.state = state;
  }

  function showSettledState(state, text, message) {
    setOpen(false);
    toggle.dataset.state = state;
    toggle.disabled = true;
    label.textContent = text;
    showHint(message, "success");
  }

  toggle.addEventListener("click", () => setOpen(form.hidden));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    input.disabled = true;
    submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = "发送中…";
    showHint("");
    try {
      const response = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: input.value }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      input.value = "";
      showSettledState(
        "sent",
        "邮件已发送",
        "请检查收件箱，确认链接在 24 小时内有效。",
      );
    } catch (error) {
      console.warn("[codex-resets] email subscription failed:", error);
      showHint(error instanceof Error && error.message === "Enter a valid email address"
        ? "请输入有效的邮箱地址。"
        : "发送失败，请重试。");
    } finally {
      input.disabled = false;
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  });

  const url = new URL(window.location.href);
  const state = url.searchParams.get("email");
  if (state) {
    if (state === "confirmed") {
      showSettledState(
        "confirmed",
        "邮件已开启",
        "订阅成功，新文章发布后会发送到这个邮箱。",
      );
    } else if (state === "invalid") {
      setOpen(true);
      showHint("确认链接无效或已过期，请重新申请。", "error");
    } else if (state === "error") {
      setOpen(true);
      showHint("暂时无法确认这个邮箱地址，请重新打开链接。", "error");
    }
    url.searchParams.delete("email");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

// ---------------------------------------------------------------------------
// Collective reset pleas: rapid taps, live count, and mobile haptics
// ---------------------------------------------------------------------------
const resetRequestFmt = typeof Intl !== "undefined"
  ? new Intl.NumberFormat("zh-CN")
  : null;

let resetPleaHapticLabel = null;

function ensureResetPleaSwitchHaptic() {
  if (resetPleaHapticLabel || typeof document === "undefined") return resetPleaHapticLabel;

  // iOS Safari has no Vibration API. web-haptics uses the native switch
  // control's tactile response as its fallback, synchronously clicked inside
  // the user's gesture: https://github.com/lochie/web-haptics
  const id = "reset-plea-haptic-switch";
  const label = document.createElement("label");
  const input = document.createElement("input");
  label.htmlFor = id;
  label.hidden = true;
  input.id = id;
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.hidden = true;
  label.appendChild(input);
  document.body.appendChild(label);
  resetPleaHapticLabel = label;
  return label;
}

function triggerResetPleaHaptic(pattern = 14) {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    } else {
      ensureResetPleaSwitchHaptic()?.click();
    }
  } catch {
    // Haptics supplement the visible interaction and silently no-op elsewhere.
  }
}

function enhanceResetPlea(scope) {
  const panel = scope.querySelector('[data-role="reset-plea"]');
  const button = scope.querySelector('[data-role="reset-plea-button"]');
  const count = scope.querySelector('[data-role="reset-plea-count"]');
  const bursts = scope.querySelector('[data-role="reset-plea-bursts"]');
  if (!panel || !button || !count || !bursts) return;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const isDemo = panel.dataset.demo === "1";
  let current = {
    cycle_id: panel.dataset.cycleId || "",
    since: panel.dataset.since || null,
    count: /^\d+$/.test(panel.dataset.count || "") ? Number(panel.dataset.count) : null,
  };
  let socket = null;
  let reconnectTimer;
  let pollTimer;
  let buttonTimer;
  let reconnectAttempt = 0;
  let lastRemoteBurstAt = 0;
  let pendingClicks = 0;
  let pendingRequestId = null;
  let pendingFlushTimer;
  const ownRequestIds = new Set();
  const CLICK_BATCH_MS = 100;
  const MAX_CLICK_BATCH = 10;

  function renderDigits(value, animate = true) {
    const text = value === null
      ? ""
      : resetRequestFmt?.format(value) ?? String(value);

    const characters = Array.from(text);
    const existingDigits = Array.from(count.children);
    const shouldAnimate = animate && !reducedMotion?.matches;

    function createDigit(character, changed = false) {
      const digit = document.createElement("span");
      digit.className = "t-digit";
      digit.textContent = character;
      if (changed && shouldAnimate) digit.classList.add("is-changing");
      return digit;
    }

    if (existingDigits.length !== characters.length) {
      count.replaceChildren(...characters.map((character) => createDigit(character, true)));
    } else {
      characters.forEach((character, index) => {
        if (existingDigits[index]?.textContent === character) return;
        existingDigits[index]?.replaceWith(createDigit(character, true));
      });
    }

    count.setAttribute(
      "aria-label",
      value === null ? "暂时无法获取催更次数" : `累计收到 ${value} 次催更`,
    );
  }

  function cycleOrder(snapshot) {
    const time = snapshot.since ? Date.parse(snapshot.since) : 0;
    return Number.isFinite(time) ? time : -1;
  }

  function applySnapshot(snapshot, animate = true) {
    if (
      !snapshot ||
      typeof snapshot.cycle_id !== "string" ||
      (snapshot.since !== null && typeof snapshot.since !== "string") ||
      !Number.isSafeInteger(snapshot.count) ||
      snapshot.count < 0
    ) {
      return false;
    }

    if (current.cycle_id) {
      const incomingOrder = cycleOrder(snapshot);
      const currentOrder = cycleOrder(current);
      if (incomingOrder < currentOrder) return false;
      if (
        snapshot.cycle_id === current.cycle_id &&
        current.count !== null &&
        snapshot.count < current.count
      ) {
        return false;
      }
      if (incomingOrder === currentOrder && snapshot.cycle_id !== current.cycle_id) {
        if (snapshot.cycle_id.localeCompare(current.cycle_id) < 0) return false;
      }
    }

    const changed = snapshot.cycle_id !== current.cycle_id || snapshot.count !== current.count;
    current = snapshot;
    panel.dataset.cycleId = snapshot.cycle_id;
    panel.dataset.since = snapshot.since ?? "";
    panel.dataset.count = String(snapshot.count);
    if (changed) renderDigits(snapshot.count, animate);
    return changed;
  }

  function replayButtonPress() {
    clearTimeout(buttonTimer);
    button.classList.remove("is-pleading");
    void button.offsetHeight;
    button.classList.add("is-pleading");
    buttonTimer = setTimeout(() => button.classList.remove("is-pleading"), 280);
  }

  function launchBurst() {
    if (reducedMotion?.matches) return;
    const burst = document.createElement("span");
    const messages = ["+1", "✍️", "更", "📚", "avatar", "avatar"];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const isAvatar = message === "avatar";
    burst.className = "reset-plea-burst";
    if (isAvatar) {
      const avatar = document.createElement("img");
      burst.classList.add("reset-plea-burst--avatar");
      avatar.className = "reset-plea-burst-avatar";
      avatar.src = "/blog-avatar.jpg";
      avatar.alt = "";
      avatar.decoding = "async";
      avatar.draggable = false;
      burst.appendChild(avatar);
    } else {
      burst.textContent = message;
    }
    burst.style.setProperty("--burst-x", `${Math.round(Math.random() * 64 - 48)}px`);
    burst.style.setProperty("--burst-y", `${-58 - Math.round(Math.random() * 42)}px`);
    burst.style.setProperty("--burst-rotate", `${Math.round(Math.random() * 28 - 14)}deg`);
    burst.style.setProperty(
      "--burst-size",
      `${isAvatar ? 38 + Math.round(Math.random() * 4) : 18 + Math.round(Math.random() * 6)}px`,
    );
    bursts.appendChild(burst);
    while (bursts.childElementCount > 12) bursts.firstElementChild?.remove();
    burst.addEventListener("animationend", () => burst.remove(), { once: true });
  }

  function countryFlag(country) {
    if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) return null;
    return String.fromCodePoint(
      ...Array.from(country, (letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
    );
  }

  function launchRemoteFlag(country) {
    if (reducedMotion?.matches) return;
    const flag = countryFlag(country);
    const now = performance.now();
    if (!flag || now - lastRemoteBurstAt < 180) return;
    lastRemoteBurstAt = now;

    const burst = document.createElement("span");
    burst.className = "reset-plea-burst reset-plea-burst--remote";
    burst.textContent = flag;
    burst.setAttribute("aria-hidden", "true");
    burst.style.setProperty("--burst-x", `${Math.round(Math.random() * 28 - 20)}px`);
    burst.style.setProperty("--burst-y", `${-42 - Math.round(Math.random() * 22)}px`);
    burst.style.setProperty("--burst-rotate", `${Math.round(Math.random() * 12 - 6)}deg`);
    bursts.appendChild(burst);
    while (bursts.childElementCount > 12) bursts.firstElementChild?.remove();
    burst.addEventListener("animationend", () => burst.remove(), { once: true });
  }

  async function refreshSnapshot() {
    try {
      const response = await fetch("/api/reactions", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      applySnapshot(await response.json());
    } catch {
      // The current snapshot stays visible while reconnect attempts continue.
    }
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }

  function startPolling() {
    if (pollTimer || document.hidden) return;
    void refreshSnapshot();
    pollTimer = setInterval(refreshSnapshot, 15_000);
  }

  function scheduleReconnect() {
    if (document.hidden || reconnectTimer) return;
    startPolling();
    const delay = Math.min(30_000, 1_000 * (2 ** reconnectAttempt));
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      startPolling();
    }, delay);
  }

  function connect() {
    if (isDemo || document.hidden || socket?.readyState === WebSocket.OPEN) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}/api/reactions/live`);
    socket.addEventListener("open", () => {
      reconnectAttempt = 0;
      stopPolling();
    });
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message?.type === "reset-request-count") {
          const previousCycle = current.cycle_id;
          const previousCount = current.count;
          const events = Array.isArray(message.events) && message.events.length > 0
            ? message.events
            : [{ request_id: message.request_id ?? null, country: message.country ?? null }];
          const foreignCountries = [];
          for (const entry of events) {
            const requestId = typeof entry?.request_id === "string" ? entry.request_id : null;
            const isOwnRequest = requestId !== null && ownRequestIds.delete(requestId);
            if (!isOwnRequest && typeof entry?.country === "string") {
              foreignCountries.push(entry.country);
            }
          }
          const changed = applySnapshot(message);
          if (
            changed &&
            message.cycle_id === previousCycle &&
            previousCount !== null &&
            message.count > previousCount
          ) {
            for (const country of foreignCountries) launchRemoteFlag(country);
          }
        }
      } catch {
        // Ignore malformed frames; the next valid snapshot repairs the view.
      }
    });
    socket.addEventListener("close", () => {
      socket = null;
      scheduleReconnect();
    });
    socket.addEventListener("error", () => socket?.close());
  }

  async function flushPendingClicks() {
    pendingFlushTimer = undefined;
    const n = pendingClicks;
    const requestId = pendingRequestId;
    pendingClicks = 0;
    pendingRequestId = null;
    if (n < 1 || !requestId) return;

    try {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ request_id: requestId, n }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      applySnapshot(payload);
    } catch (error) {
      console.warn("[codex-resets] reset request failed:", error);
    }
  }

  button.addEventListener("click", () => {
    triggerResetPleaHaptic();
    replayButtonPress();
    launchBurst();

    if (isDemo) {
      applySnapshot({
        cycle_id: current.cycle_id || "demo-reset",
        since: current.since,
        count: (current.count ?? 0) + 1,
      });
      return;
    }

    pendingClicks += 1;
    if (!pendingRequestId) {
      pendingRequestId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const requestId = pendingRequestId;
      ownRequestIds.add(requestId);
      setTimeout(() => ownRequestIds.delete(requestId), 30_000);
    }
    if (pendingClicks >= MAX_CLICK_BATCH) {
      clearTimeout(pendingFlushTimer);
      pendingFlushTimer = undefined;
      void flushPendingClicks();
      return;
    }
    if (!pendingFlushTimer) {
      pendingFlushTimer = setTimeout(() => {
        void flushPendingClicks();
      }, CLICK_BATCH_MS);
    }
  });

  if (current.count !== null) renderDigits(current.count, false);
  if (isDemo) {
    return;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      stopPolling();
      socket?.close(1000, "Page hidden");
    } else {
      connect();
    }
  });
  startPolling();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  if (!root) return;
  if (root.dataset.ssr === "1") {
    try {
      globalThis.codexResetsTheme?.sync(root);
      enhanceTimes(root);
      enhanceGraph(root);
      enhancePostDialog(root, []);
      enhanceResetPlea(root);
      enhanceTelegramLink(root);
      await enhanceEmailControl(root);
      await enhancePushControl(root);
    } catch {
      // SSR content remains usable even if optional enhancement cannot run.
    }
    return;
  }

  const data = await loadData();
  root.innerHTML = renderPage(data);
  try {
    globalThis.codexResetsTheme?.sync(root);
    enhanceTimes(root);
    enhanceGraph(root);
    enhancePostDialog(root, data.posts);
    enhanceResetPlea(root);
    enhanceTelegramLink(root);
    await enhanceEmailControl(root);
    await enhancePushControl(root);
  } catch {
    // Rendering succeeded; optional enhancement failures must not blank the page.
  }
}

boot();
