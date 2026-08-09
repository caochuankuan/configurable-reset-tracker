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

export function cleanText(text) {
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
function longestGapDays(posts) {
  if (!posts || posts.length < 2) return null;
  const times = posts
    .map((post) => Date.parse(post.published_at))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let max = 0;
  for (let i = 1; i < times.length; i++) {
    max = Math.max(max, times[i] - times[i - 1]);
  }
  return max / MS_DAY;
}

export function renderHero(stats, posts, featured, reactions, ui, site, isDemo = false) {
  const lastPublishedAt = stats?.last_published_at ?? null;
  const longestGap = longestGapDays(posts);

  const headline = lastPublishedAt
    ? `<span class="hero-figure" data-role="relative-time" data-datetime="${escapeHtml(lastPublishedAt)}">${formatRelative(Date.parse(lastPublishedAt))}</span>`
    : `<span class="hero-figure hero-figure--muted">还没有文章</span>`;

  const sub = lastPublishedAt
    ? `<p class="hero-sub" data-role="absolute-time" data-datetime="${escapeHtml(lastPublishedAt)}">&nbsp;</p>`
    : `<p class="hero-sub">第一篇文章发布后会显示在这里。</p>`;
  const reactionCount = Number.isSafeInteger(reactions?.count) && reactions.count >= 0
    ? reactions.count
    : null;
  const reactionCycle = reactions?.cycle_id ?? "";
  const reactionSince = reactions?.since ?? "";

  return `
<section class="hero" aria-label="当前状态">
  <p class="hero-explainer">
    ${escapeHtml(site.description)}
  </p>

  <div class="subscription-actions" role="group" aria-label="${escapeHtml(ui.subscription_label)}">
    <div class="push-control" data-role="push-control" hidden>
      <button class="subscription-action push-toggle" type="button" data-role="push-toggle" aria-pressed="false" aria-describedby="push-hint" title="新文章发布时接收浏览器通知">
        <svg class="push-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span data-role="push-label">${escapeHtml(ui.browser)}</span>
      </button>
      <span class="push-hint" id="push-hint" data-role="push-hint" aria-live="polite"></span>
    </div>
    <a class="subscription-action telegram-link" data-role="telegram-link" href="https://t.me/codex_resets" target="_blank" rel="noopener noreferrer" title="在 Telegram 接收文章更新">
      <svg class="telegram-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 2 9.6 14.4M22 2l-7.9 20-4.5-7.6L2 10l20-8Z" />
      </svg>
      <span>${escapeHtml(ui.telegram)}</span>
    </a>
    <button class="subscription-action email-toggle" type="button" data-role="email-toggle" aria-expanded="false" aria-controls="email-subscribe-form" aria-describedby="email-hint" title="新文章发布时接收邮件">
      <svg class="email-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h18v14H3zM3 6l9 7 9-7" />
      </svg>
      <span data-role="email-label">${escapeHtml(ui.email)}</span>
    </button>
    <form class="email-subscribe-form" id="email-subscribe-form" data-role="email-form" hidden>
      <label class="visually-hidden" for="reset-email">邮箱地址</label>
      <input class="email-input" id="reset-email" data-role="email-input" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" aria-describedby="email-hint" required />
      <button class="subscription-action email-submit" data-role="email-submit" type="submit">发送链接</button>
    </form>
    <p class="email-hint" id="email-hint" data-role="email-hint" aria-live="polite" hidden></p>
  </div>

  ${renderFeatured(featured, posts, ui)}

  <div class="hero-card">
    <span class="hero-label">${escapeHtml(ui.time_since_last)}</span>
    ${headline}
    <div class="hero-footer">
      ${sub}
      <section class="reset-plea" data-role="reset-plea" data-cycle-id="${escapeHtml(reactionCycle)}" data-since="${escapeHtml(reactionSince)}" data-count="${reactionCount ?? ""}" data-demo="${isDemo ? "1" : "0"}" aria-label="催更计数">
        <div class="reset-plea-action">
          <button class="reset-plea-button" type="button" data-role="reset-plea-button" aria-label="${escapeHtml(ui.nudge)}" title="${escapeHtml(ui.nudge)}">
            <span class="reset-plea-button-emoji" aria-hidden="true">✍️</span>
            <span class="reset-plea-button-label">${escapeHtml(ui.nudge)}</span>
            <span class="reset-plea-count t-digit-group" data-role="reset-plea-count" role="status" aria-live="polite" aria-atomic="true" aria-label="${reactionCount === null ? "暂时无法获取催更次数" : `累计收到 ${reactionCount} 次催更`}">${renderCountDigits(reactionCount)}</span>
          </button>
          <span class="reset-plea-bursts" data-role="reset-plea-bursts" aria-hidden="true"></span>
        </div>
      </section>
    </div>
  </div>

  <dl class="stat-row">
    <div class="stat-tile stat-tile--sun">
      <dt><span class="stat-label-full">${escapeHtml(ui.posts)}</span><span class="stat-label-short">文章</span></dt>
      <dd class="mono">${fmtNumber(stats?.total)}</dd>
    </div>
    <div class="stat-tile stat-tile--rose">
      <dt><span class="stat-label-full">${escapeHtml(ui.average_interval)}</span><span class="stat-label-short">平均更新</span></dt>
      <dd class="mono">${fmtInterval(stats?.avg_interval_days)}</dd>
    </div>
    <div class="stat-tile stat-tile--sky">
      <dt><span class="stat-label-full">${escapeHtml(ui.longest_break)}</span><span class="stat-label-short">最长停更</span></dt>
      <dd class="mono">${fmtInterval(longestGap)}</dd>
    </div>
  </dl>
</section>`;
}

// ---------------------------------------------------------------------------
// Featured post
// ---------------------------------------------------------------------------
export function renderFeatured(featured, posts, ui) {
  if (!featured) return "";
  const post = posts.find((candidate) => candidate.id === featured.post_id);
  if (!post) return "";
  const score = Math.max(0, Math.min(100, Math.round(featured.score)));

  return `
<section class="watch-card watch-card--strong" aria-labelledby="featured-heading">
  <div class="watch-topline">
    <span class="watch-kicker"><span aria-hidden="true">👀</span> ${escapeHtml(featured.label || ui.featured)}</span>
  </div>
  <div class="watch-forecast">
    <p class="watch-probability" aria-label="百分之 ${score}">
      <span aria-hidden="true">${score}<small>%</small></span>
    </p>
    <div class="watch-forecast-copy">
      <h2 id="featured-heading">${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(ui.recommendation_score)}</p>
    </div>
  </div>
  <blockquote>“${escapeHtml(post.summary)}”</blockquote>
  <p class="watch-context"><span>${escapeHtml(ui.recommendation_reason)}</span> “${escapeHtml(featured.reason)}”</p>
  <div class="watch-meta">
    <span>${escapeHtml(ui.published)} <span data-role="relative-time" data-datetime="${escapeHtml(post.published_at)}">${formatRelative(Date.parse(post.published_at))}</span></span>
    <button class="log-item-link post-open" type="button" data-role="post-open" data-post-id="${escapeHtml(post.id)}">${escapeHtml(ui.expand)} &rarr;</button>
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
function buildGrid(posts) {
  const today = startOfUtcDay(Date.now());
  const daysTotal = WEEKS_BACK * 7;
  const naiveStart = new Date(today.getTime() - (daysTotal - 1) * MS_DAY);
  const startDow = naiveStart.getUTCDay();
  const start = new Date(naiveStart.getTime() - startDow * MS_DAY);

  const byDay = new Map();
  for (const post of posts) {
    const t = Date.parse(post.published_at);
    if (Number.isNaN(t)) continue;
    const key = utcDayKey(startOfUtcDay(t));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(post);
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
        posts: byDay.get(key) || [],
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
      const count = day.posts.length;
      const level = count > 0 ? 1 : 0;
      const post = day.posts[0] ?? null;
      const snippet = post ? escapeHtml(post.title).slice(0, 120) : "";
      const label = count === 0
        ? `没有发布文章`
        : `发布 ${count} 篇文章`;
      const attributes = `class="cg-cell" data-level="${level}" data-date="${day.date}" data-count="${count}" data-snippet="${snippet}" style="grid-column:${wi + 1};grid-row:${di + 2}" aria-label="${day.date}（UTC）：${label}"`;
      out += post
        ? `<button type="button" ${attributes} data-role="post-open" data-post-id="${escapeHtml(post.id)}"></button>`
        : `<button type="button" ${attributes}></button>`;
    });
  });
  return out;
}

export function renderContributionGraph(posts, ui) {
  const weeks = buildGrid(posts);
  return `
<section class="graph-section" aria-labelledby="graph-heading">
  <div class="section-head">
    <h2 id="graph-heading">${escapeHtml(ui.activity)}</h2>
    <p class="section-sub">${escapeHtml(ui.last_26_weeks)} &middot; <span class="legend-chip legend-chip--hit"></span> ${escapeHtml(ui.posted)} &middot; <span class="legend-chip"></span> ${escapeHtml(ui.quiet)}</p>
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
// Post archive
// ---------------------------------------------------------------------------
const AVATAR_URL = "/blog-avatar.jpg";
const LOG_PREVIEW_COUNT = 3;

function renderLogItems(posts, ui) {
  return posts.map((post) => `
    <li class="log-item">
      <img class="log-avatar" src="${AVATAR_URL}" alt="" aria-hidden="true" loading="lazy" referrerpolicy="no-referrer" width="44" height="44" />
      <div class="log-bubble">
        <div class="log-item-meta">
          <span class="log-item-time" data-role="relative-time" data-datetime="${escapeHtml(post.published_at)}">&hellip;</span>
          <span class="log-item-abs" data-role="absolute-time" data-datetime="${escapeHtml(post.published_at)}">&hellip;</span>
        </div>
        <h3 class="log-item-title">${escapeHtml(post.title)}</h3>
        <p class="log-item-text">${escapeHtml(post.summary)}</p>
        <button class="log-item-link post-open" type="button" data-role="post-open" data-post-id="${escapeHtml(post.id)}">${escapeHtml(ui.expand)} &rarr;</button>
      </div>
    </li>`).join("");
}

export function renderPostArchive(posts, ui) {
  if (!posts || posts.length === 0) {
    return `
<section class="log-section" aria-labelledby="log-heading">
  <div class="section-head">
    <h2 id="log-heading">${escapeHtml(ui.latest_posts)}</h2>
  </div>
  <p class="log-empty">文章正在路上。</p>
</section>`;
  }

  const previewItems = renderLogItems(posts.slice(0, LOG_PREVIEW_COUNT), ui);
  const remainingItems = renderLogItems(posts.slice(LOG_PREVIEW_COUNT), ui);
  const more = remainingItems
    ? `
  <details class="log-more">
    <summary class="log-more-toggle">
      <span class="log-more-label-closed">${escapeHtml(ui.show_all)}（${posts.length}）</span>
      <span class="log-more-label-open">${escapeHtml(ui.show_fewer)}</span>
      <span class="log-more-arrow" aria-hidden="true">&darr;</span>
    </summary>
    <ol class="log-list log-list--more" start="${LOG_PREVIEW_COUNT + 1}">${remainingItems}</ol>
  </details>`
    : "";

  return `
<section class="log-section" aria-labelledby="log-heading">
  <div class="section-head">
    <h2 id="log-heading">${escapeHtml(ui.latest_posts)}</h2>
    <p class="section-sub">${escapeHtml(ui.archive_subtitle)}</p>
  </div>
  <ol class="log-list">${previewItems}</ol>${more}
</section>`;
}

function renderPostDialog(ui) {
  return `
<dialog class="post-dialog" data-role="post-dialog" aria-labelledby="post-dialog-title">
  <button class="post-dialog-close" type="button" data-role="post-dialog-close" aria-label="${escapeHtml(ui.dialog_close)}">&times;</button>
  <p class="post-dialog-kicker">${escapeHtml(ui.dialog_label)}</p>
  <h2 id="post-dialog-title" data-role="post-dialog-title"></h2>
  <p class="post-dialog-meta" data-role="post-dialog-meta"></p>
  <div class="post-dialog-body" data-role="post-dialog-body"></div>
</dialog>`;
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
export function renderPage(data) {
  const {
    site = {},
    posts = [],
    featured = null,
    stats = {},
    reactions = null,
    ui = {},
    isDemo = false,
  } = data || {};

  return `
<div class="page">
  <header class="masthead">
    <div class="masthead-brand">
      <img class="masthead-avatar" src="/blog-avatar.jpg" alt="" aria-hidden="true" width="44" height="44" />
      <div class="masthead-copy">
        <div class="masthead-title-row">
          <h1 class="masthead-title">${escapeHtml(site.title)}</h1>
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
    ${renderHero(stats, posts, featured, reactions, ui, site, isDemo)}
    ${renderContributionGraph(posts, ui)}
    ${renderPostArchive(posts, ui)}
  </main>
  ${renderPostDialog(ui)}
</div>
`;
}
