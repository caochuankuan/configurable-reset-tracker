// Pure render functions: data in, HTML string out. No DOM APIs here.
// This file is written so it can be reused near-verbatim by a server-side
// renderer (e.g. Hono's html tagged template) — every function is a pure
// string builder, and every timezone-dependent value is emitted as a neutral
// UTC/ISO data-attribute or fallback text, to be rewritten client-side by the
// enhancement step in app.js.

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

// Strip t.co link stubs from displayed tweet text: they are media/quote
// placeholders with no reading value; the "View on X" link keeps access.
export function cleanTweetText(text) {
  return String(text ?? "").replace(/\s*https:\/\/t\.co\/\S+/g, "").trim();
}

const RELATIVE_UNITS = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

const RELATIVE_UNIT_LABELS = {
  year: "年",
  month: "个月",
  week: "周",
  day: "天",
  hour: "小时",
  minute: "分钟",
};

const rtf = typeof Intl !== "undefined" && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat("zh-CN", { numeric: "always" })
  : null;

export function formatRelative(dateMs, nowMs = Date.now()) {
  if (!Number.isFinite(dateMs) || !Number.isFinite(nowMs)) return "—";
  const diffSec = Math.round((dateMs - nowMs) / 1000); // negative = past
  const absSec = Math.abs(diffSec);
  if (absSec < 45) return "刚刚";
  for (const [unit, secs] of RELATIVE_UNITS) {
    if (absSec >= secs || unit === "minute") {
      const value = Math.round(diffSec / secs);
      if (rtf) return rtf.format(value, unit);
      const unitLabel = RELATIVE_UNIT_LABELS[unit];
      return diffSec < 0 ? `${Math.abs(value)}${unitLabel}前` : `${Math.abs(value)}${unitLabel}后`;
    }
  }
  return "刚刚";
}

function fmtNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(n);
}

function fmtInterval(days) {
  if (days === null || days === undefined || Number.isNaN(days)) return "—";
  return `${days.toFixed(1)}天`;
}

function renderCountDigits(value) {
  const text = value === null ? "" : new Intl.NumberFormat("zh-CN").format(value);
  return Array.from(text, (character) =>
    `<span class="t-digit">${escapeHtml(character)}</span>`).join("");
}

const MS_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function longestGapDays(events) {
  if (!events || events.length < 2) return null;
  const times = events
    .map((ev) => Date.parse(ev.announced_at))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let max = 0;
  for (let i = 1; i < times.length; i++) {
    max = Math.max(max, times[i] - times[i - 1]);
  }
  return max / MS_DAY;
}

export function renderHero(stats, events, watch, resetRequests, isDemo = false) {
  const lastResetAt = stats?.last_reset_at ?? null;
  const longestGap = longestGapDays(events);

  const headline = lastResetAt
    ? `<span class="hero-figure" data-role="relative-time" data-datetime="${escapeHtml(lastResetAt)}">${formatRelative(Date.parse(lastResetAt))}</span>`
    : `<span class="hero-figure hero-figure--muted">尚未记录到重置</span>`;

  const sub = lastResetAt
    ? `<p class="hero-sub" data-role="absolute-time" data-datetime="${escapeHtml(lastResetAt)}">&nbsp;</p>`
    : `<p class="hero-sub">@thsottiaux 发布重置消息后，几分钟内就会显示在这里。</p>`;
  const requestCount = Number.isSafeInteger(resetRequests?.count) && resetRequests.count >= 0
    ? resetRequests.count
    : null;
  const requestCycle = resetRequests?.cycle_id ?? "";
  const requestSince = resetRequests?.since ?? "";

  return `
<section class="hero" aria-label="当前状态">
  <p class="hero-explainer">
    我们持续关注 <a href="https://x.com/thsottiaux" target="_blank" rel="noopener noreferrer">@thsottiaux</a>
    发布的 Codex 额度重置消息，你不必亲自盯着动态。
  </p>

  <div class="subscription-actions" role="group" aria-label="重置通知">
    <div class="push-control" data-role="push-control" hidden>
      <button class="subscription-action push-toggle" type="button" data-role="push-toggle" aria-pressed="false" aria-describedby="push-hint" title="Codex 重置时接收浏览器通知">
        <svg class="push-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span data-role="push-label">浏览器</span>
      </button>
      <span class="push-hint" id="push-hint" data-role="push-hint" aria-live="polite"></span>
    </div>
    <a class="subscription-action telegram-link" data-role="telegram-link" href="https://t.me/codex_resets" target="_blank" rel="noopener noreferrer" title="在 Telegram 接收相同通知">
      <svg class="telegram-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 2 9.6 14.4M22 2l-7.9 20-4.5-7.6L2 10l20-8Z" />
      </svg>
      <span>Telegram</span>
    </a>
    <button class="subscription-action email-toggle" type="button" data-role="email-toggle" aria-expanded="false" aria-controls="email-subscribe-form" aria-describedby="email-hint" title="确认 Codex 重置时接收邮件">
      <svg class="email-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h18v14H3zM3 6l9 7 9-7" />
      </svg>
      <span data-role="email-label">邮件</span>
    </button>
    <form class="email-subscribe-form" id="email-subscribe-form" data-role="email-form" hidden>
      <label class="visually-hidden" for="reset-email">邮箱地址</label>
      <input class="email-input" id="reset-email" data-role="email-input" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" aria-describedby="email-hint" required />
      <button class="subscription-action email-submit" data-role="email-submit" type="submit">发送链接</button>
    </form>
    <p class="email-hint" id="email-hint" data-role="email-hint" aria-live="polite" hidden></p>
  </div>

  ${renderResetWatch(watch)}

  <div class="hero-card">
    <span class="hero-label">距上次额度恩赐</span>
    ${headline}
    <div class="hero-footer">
      ${sub}
      <section class="reset-plea" data-role="reset-plea" data-cycle-id="${escapeHtml(requestCycle)}" data-since="${escapeHtml(requestSince)}" data-count="${requestCount ?? ""}" data-demo="${isDemo ? "1" : "0"}" aria-label="重置请求">
        <div class="reset-plea-action">
          <button class="reset-plea-button" type="button" data-role="reset-plea-button" aria-label="求一次重置" title="求一次重置">
            <span class="reset-plea-button-emoji" aria-hidden="true">🙏</span>
            <span class="reset-plea-button-label">求重置</span>
            <span class="reset-plea-count t-digit-group" data-role="reset-plea-count" role="status" aria-live="polite" aria-atomic="true" aria-label="${requestCount === null ? "暂时无法获取重置请求数" : `上次重置后已有 ${requestCount} 次请求`}">${renderCountDigits(requestCount)}</span>
          </button>
          <span class="reset-plea-bursts" data-role="reset-plea-bursts" aria-hidden="true"></span>
        </div>
      </section>
    </div>
  </div>

  <dl class="stat-row">
    <div class="stat-tile stat-tile--sun">
      <dt><span class="stat-label-full">重置次数</span><span class="stat-label-short">重置</span></dt>
      <dd class="mono">${fmtNumber(stats?.total)}</dd>
    </div>
    <div class="stat-tile stat-tile--rose">
      <dt><span class="stat-label-full">平均奇迹间隔</span><span class="stat-label-short">平均等待</span></dt>
      <dd class="mono">${fmtInterval(stats?.avg_interval_days)}</dd>
    </div>
    <div class="stat-tile stat-tile--sky">
      <dt><span class="stat-label-full">最长等待</span><span class="stat-label-short">最长等待</span></dt>
      <dd class="mono">${fmtInterval(longestGap)}</dd>
    </div>
  </dl>
</section>`;
}

// ---------------------------------------------------------------------------
// Reset watch
// ---------------------------------------------------------------------------
const WATCH_LABELS = {
  elevated: "可能性升高",
  strong: "强烈信号",
};

export function renderResetWatch(watch) {
  if (!watch) return "";

  const level = WATCH_LABELS[watch.level] ? watch.level : "elevated";
  const windowHours = Number.isFinite(watch.window_hours) ? watch.window_hours : 24;
  const rawChance = Number.isFinite(watch.reset_chance_24h)
    ? Math.max(0, Math.min(100, watch.reset_chance_24h))
    : null;
  const chanceFloor = rawChance !== null && rawChance >= 10
    ? Math.min(90, Math.floor(rawChance / 10) * 10)
    : null;
  const forecast = chanceFloor === null
    ? `<h2 id="watch-heading">Tibo 可能正在暗示一次重置</h2>`
    : `
  <div class="watch-forecast">
    <p class="watch-probability" aria-label="大于百分之 ${chanceFloor}">
      <span aria-hidden="true">&gt;${chanceFloor}<small>%</small></span>
    </p>
    <div class="watch-forecast-copy">
      <h2 id="watch-heading">${escapeHtml(windowHours)} 小时重置概率</h2>
      <p>人工智能估算</p>
    </div>
  </div>`;
  const context = watch.context_text
    ? `<p class="watch-context"><span>回复内容</span> “${escapeHtml(cleanTweetText(watch.context_text))}”</p>`
    : "";

  return `
<section class="watch-card watch-card--${level}" data-role="reset-watch" data-expires-at="${escapeHtml(watch.expires_at)}" aria-labelledby="watch-heading">
  <div class="watch-topline">
    <span class="watch-kicker"><span aria-hidden="true">👀</span> 重置观察</span>
  </div>
  ${forecast}
  <blockquote>“${escapeHtml(cleanTweetText(watch.text))}” - Tibo</blockquote>
  ${context}
  <div class="watch-meta">
    <span>发现于 <span data-role="relative-time" data-datetime="${escapeHtml(watch.observed_at)}">${formatRelative(Date.parse(watch.observed_at))}</span></span>
    <a href="${escapeHtml(watch.tweet_url)}" target="_blank" rel="noopener noreferrer">在 X 查看 &rarr;</a>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Contribution graph
// ---------------------------------------------------------------------------
const WEEKS_BACK = 26;

function utcDayKey(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function startOfUtcDay(ms) {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Build a week x day grid ending today (UTC), starting on the Sunday
// WEEKS_BACK weeks ago, so columns are full calendar weeks (Sun-Sat).
function buildGrid(events) {
  const today = startOfUtcDay(Date.now());
  const daysTotal = WEEKS_BACK * 7;
  const naiveStart = new Date(today.getTime() - (daysTotal - 1) * MS_DAY);
  const startDow = naiveStart.getUTCDay();
  const start = new Date(naiveStart.getTime() - startDow * MS_DAY);

  const byDay = new Map();
  for (const ev of events) {
    const t = Date.parse(ev.announced_at);
    if (Number.isNaN(t)) continue;
    const key = utcDayKey(startOfUtcDay(t));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(ev);
  }

  const weeks = [];
  let cursor = start.getTime();
  while (cursor <= today.getTime()) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(cursor + d * MS_DAY);
      const key = utcDayKey(dayDate);
      const isFuture = dayDate.getTime() > today.getTime();
      week.push({
        date: key,
        ms: dayDate.getTime(),
        events: byDay.get(key) || [],
        isFuture,
      });
    }
    weeks.push(week);
    cursor += 7 * MS_DAY;
  }
  return weeks;
}

const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const WEEKDAY_ROW_LABELS = { 1: "周一", 3: "周三", 5: "周五" };

function renderMonthLabels(weeks) {
  const labels = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstOfWeek = new Date(week[0].ms);
    const month = firstOfWeek.getUTCMonth();
    if (month !== lastMonth) {
      labels.push(`<span class="cg-month" style="grid-column:${wi + 1};grid-row:1">${MONTH_NAMES[month]}</span>`);
      lastMonth = month;
    }
  });
  return labels.join("");
}

function renderWeekdayLabels() {
  let out = "";
  for (let d = 0; d < 7; d++) {
    out += `<span class="cg-weekday" style="grid-row:${d + 2}">${WEEKDAY_ROW_LABELS[d] ?? ""}</span>`;
  }
  return out;
}

function renderCells(weeks) {
  let out = "";
  weeks.forEach((week, wi) => {
    week.forEach((day, di) => {
      if (day.isFuture) {
        out += `<span class="cg-cell cg-cell--future" style="grid-column:${wi + 1};grid-row:${di + 2}" aria-hidden="true"></span>`;
        return;
      }
      const count = day.events.length;
      const level = count > 0 ? 1 : 0;
      const announcement = day.events[0] ?? null;
      const snippet = announcement ? escapeHtml(cleanTweetText(announcement.text)).slice(0, 120) : "";
      const label = count === 0
        ? `没有重置`
        : `${count} 次重置`;
      const attributes = `class="cg-cell" data-level="${level}" data-date="${day.date}" data-count="${count}" data-snippet="${snippet}" style="grid-column:${wi + 1};grid-row:${di + 2}" aria-label="${day.date}（UTC）：${label}"`;
      out += announcement
        ? `<a ${attributes} href="${escapeHtml(announcement.tweet_url)}" target="_blank" rel="noopener noreferrer"></a>`
        : `<button type="button" ${attributes}></button>`;
    });
  });
  return out;
}

export function renderContributionGraph(events) {
  const weeks = buildGrid(events);
  return `
<section class="graph-section" aria-labelledby="graph-heading">
  <div class="section-head">
    <h2 id="graph-heading">等待游戏</h2>
    <p class="section-sub">最近 ${WEEKS_BACK} 周 &middot; <span class="legend-chip legend-chip--hit"></span> 发布了消息 &middot; <span class="legend-chip"></span> 继续等待</p>
  </div>
  <div class="graph-card">
    <div class="cg-container">
      <div class="cg-weekdays" style="grid-template-rows:20px repeat(7,var(--cell-size))">${renderWeekdayLabels()}</div>
      <div class="cg-scroll">
        <div class="cg-grid" style="grid-template-columns:repeat(${weeks.length},var(--cell-size));grid-template-rows:20px repeat(7,var(--cell-size))">
          ${renderMonthLabels(weeks)}
          ${renderCells(weeks)}
        </div>
      </div>
      <div class="cg-tooltip" id="cg-tooltip" role="tooltip" hidden></div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------
const AVATAR_URL = "/thsottiaux-avatar.jpg";
const LOG_PREVIEW_COUNT = 3;

function renderLogItems(events) {
  return events.map((ev) => `
    <li class="log-item">
      <img class="log-avatar" src="${AVATAR_URL}" alt="" aria-hidden="true" loading="lazy" referrerpolicy="no-referrer" width="44" height="44" />
      <div class="log-bubble">
        <div class="log-item-meta">
          <span class="log-item-time" data-role="relative-time" data-datetime="${escapeHtml(ev.announced_at)}">&hellip;</span>
          <span class="log-item-abs" data-role="absolute-time" data-datetime="${escapeHtml(ev.announced_at)}">&hellip;</span>
        </div>
        <p class="log-item-text">${escapeHtml(cleanTweetText(ev.text))}</p>
        <a class="log-item-link" href="${escapeHtml(ev.tweet_url)}" target="_blank" rel="noopener noreferrer">在 X 查看 &rarr;</a>
      </div>
    </li>`).join("");
}

export function renderEventLog(events) {
  if (!events || events.length === 0) {
    return `
<section class="log-section" aria-labelledby="log-heading">
  <div class="section-head">
    <h2 id="log-heading">他的原话</h2>
  </div>
  <p class="log-empty">暂时没有内容，时间线安静得有些过分。</p>
</section>`;
  }

  const previewItems = renderLogItems(events.slice(0, LOG_PREVIEW_COUNT));
  const remainingItems = renderLogItems(events.slice(LOG_PREVIEW_COUNT));
  const more = remainingItems
    ? `
  <details class="log-more">
    <summary class="log-more-toggle">
      <span class="log-more-label-closed">显示全部 ${events.length} 次重置</span>
      <span class="log-more-label-open">收起记录</span>
      <span class="log-more-arrow" aria-hidden="true">&darr;</span>
    </summary>
    <ol class="log-list log-list--more" start="${LOG_PREVIEW_COUNT + 1}">${remainingItems}</ol>
  </details>`
    : "";

  return `
<section class="log-section" aria-labelledby="log-heading">
  <div class="section-head">
    <h2 id="log-heading">他的原话</h2>
    <p class="section-sub">完整保存每一次公告</p>
  </div>
  <ol class="log-list">${previewItems}</ol>${more}
</section>`;
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
export function renderPage(data) {
  const {
    events = [],
    watch = null,
    stats = {},
    isDemo = false,
  } = data || {};

  return `
<div class="page">
  <header class="masthead">
    <div class="masthead-brand">
      <img class="masthead-avatar" src="/thsottiaux-avatar.jpg" alt="" aria-hidden="true" width="44" height="44" />
      <div class="masthead-copy">
        <div class="masthead-title-row">
          <h1 class="masthead-title">Codex 重置追踪</h1>
        </div>
      </div>
    </div>
    <div class="masthead-side">
      ${isDemo ? `<span class="demo-badge" title="当前显示内置示例数据">示例数据</span>` : ""}
      <button class="theme-toggle" type="button" data-role="theme-toggle" aria-label="切换颜色主题" title="切换颜色主题">
        <span class="theme-toggle-icons" aria-hidden="true">
          <svg class="theme-toggle-icon theme-toggle-icon--moon" viewBox="0 0 24 24">
            <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
          </svg>
          <svg class="theme-toggle-icon theme-toggle-icon--sun" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </span>
      </button>
    </div>
  </header>

  <main>
    ${renderHero(stats, events, watch, data?.reset_requests ?? null, isDemo)}
    ${renderContributionGraph(events)}
    ${renderEventLog(events)}
  </main>

  <footer class="site-footer">
    <p>数据来自 @thsottiaux 的动态，由一个极其认真对待此事的机器人负责分类。与 OpenAI 无关。</p>
    <p>Tibo，如果你看到了：完全没有压力。</p>
    <p>原始设计来自 <a href="https://x.com/wong2__" target="_blank" rel="noopener noreferrer">@wong2__</a>。</p>
  </footer>
</div>
`;
}
