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

const rtf = typeof Intl !== "undefined" && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat("en", { numeric: "always" })
  : null;

export function formatRelative(dateMs, nowMs = Date.now()) {
  if (!Number.isFinite(dateMs) || !Number.isFinite(nowMs)) return "—";
  const diffSec = Math.round((dateMs - nowMs) / 1000); // negative = past
  const absSec = Math.abs(diffSec);
  if (absSec < 45) return "just now";
  for (const [unit, secs] of RELATIVE_UNITS) {
    if (absSec >= secs || unit === "minute") {
      const value = Math.round(diffSec / secs);
      if (rtf) return rtf.format(value, unit);
      const plural = Math.abs(value) === 1 ? unit : `${unit}s`;
      return diffSec < 0 ? `${Math.abs(value)} ${plural} ago` : `in ${Math.abs(value)} ${plural}`;
    }
  }
  return "just now";
}

function fmtNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(n);
}

function fmtInterval(days) {
  if (days === null || days === undefined || Number.isNaN(days)) return "—";
  return `${days.toFixed(1)}d`;
}

function renderCountDigits(value) {
  const text = value === null ? "" : new Intl.NumberFormat("en").format(value);
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
    : `<span class="hero-figure hero-figure--muted">No resets tracked yet</span>`;

  const sub = lastResetAt
    ? `<p class="hero-sub" data-role="absolute-time" data-datetime="${escapeHtml(lastResetAt)}">&nbsp;</p>`
    : `<p class="hero-sub">Once @thsottiaux announces one, it'll show up here within minutes.</p>`;
  const requestCount = Number.isSafeInteger(resetRequests?.count) && resetRequests.count >= 0
    ? resetRequests.count
    : null;
  const requestCycle = resetRequests?.cycle_id ?? "";
  const requestSince = resetRequests?.since ?? "";

  return `
<section class="hero" aria-label="Current status">
  <p class="hero-explainer">
    We watch <a href="https://x.com/thsottiaux" target="_blank" rel="noopener noreferrer">@thsottiaux</a>
    for Codex reset announcements, so you don't have to.
  </p>

  <div class="subscription-actions" role="group" aria-label="Reset notifications">
    <div class="push-control" data-role="push-control" hidden>
      <button class="subscription-action push-toggle" type="button" data-role="push-toggle" aria-pressed="false" aria-describedby="push-hint" title="Get browser notifications when Codex resets">
        <svg class="push-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span data-role="push-label">browser</span>
      </button>
      <span class="push-hint" id="push-hint" data-role="push-hint" aria-live="polite"></span>
    </div>
    <a class="subscription-action telegram-link" data-role="telegram-link" href="https://t.me/codex_resets" target="_blank" rel="noopener noreferrer" title="Same pings, in Telegram">
      <svg class="telegram-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 2 9.6 14.4M22 2l-7.9 20-4.5-7.6L2 10l20-8Z" />
      </svg>
      <span>telegram</span>
    </a>
    <button class="subscription-action email-toggle" type="button" data-role="email-toggle" aria-expanded="false" aria-controls="email-subscribe-form" aria-describedby="email-hint" title="Get an email when a Codex reset is confirmed">
      <svg class="email-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h18v14H3zM3 6l9 7 9-7" />
      </svg>
      <span data-role="email-label">email</span>
    </button>
    <form class="email-subscribe-form" id="email-subscribe-form" data-role="email-form" hidden>
      <label class="visually-hidden" for="reset-email">Email address</label>
      <input class="email-input" id="reset-email" data-role="email-input" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" aria-describedby="email-hint" required />
      <button class="subscription-action email-submit" data-role="email-submit" type="submit">send link</button>
    </form>
    <p class="email-hint" id="email-hint" data-role="email-hint" aria-live="polite" hidden></p>
  </div>

  <div class="sponsor-mobile" data-role="sponsor-mobile" aria-label="Sponsored product" hidden></div>

  ${renderResetWatch(watch)}

  <div class="hero-card">
    <span class="hero-label">Time since the last blessing</span>
    ${headline}
    <div class="hero-footer">
      ${sub}
      <section class="reset-plea" data-role="reset-plea" data-cycle-id="${escapeHtml(requestCycle)}" data-since="${escapeHtml(requestSince)}" data-count="${requestCount ?? ""}" data-demo="${isDemo ? "1" : "0"}" aria-label="Reset requests">
        <div class="reset-plea-action">
          <button class="reset-plea-button" type="button" data-role="reset-plea-button" aria-label="Beg for a reset" title="Beg for a reset">
            <span class="reset-plea-button-emoji" aria-hidden="true">🙏</span>
            <span class="reset-plea-button-label">beg</span>
            <span class="reset-plea-count t-digit-group" data-role="reset-plea-count" role="status" aria-live="polite" aria-atomic="true" aria-label="${requestCount === null ? "Reset request count unavailable" : `${requestCount} reset requests since last reset`}">${renderCountDigits(requestCount)}</span>
          </button>
          <span class="reset-plea-bursts" data-role="reset-plea-bursts" aria-hidden="true"></span>
        </div>
      </section>
    </div>
  </div>

  <dl class="stat-row">
    <div class="stat-tile stat-tile--sun">
      <dt><span class="stat-label-full">Resets</span><span class="stat-label-short">Resets</span></dt>
      <dd class="mono">${fmtNumber(stats?.total)}</dd>
    </div>
    <div class="stat-tile stat-tile--rose">
      <dt><span class="stat-label-full">Avg. miracle interval</span><span class="stat-label-short">Avg. wait</span></dt>
      <dd class="mono">${fmtInterval(stats?.avg_interval_days)}</dd>
    </div>
    <div class="stat-tile stat-tile--sky">
      <dt><span class="stat-label-full">Longest wait</span><span class="stat-label-short">Longest wait</span></dt>
      <dd class="mono">${fmtInterval(longestGap)}</dd>
    </div>
  </dl>
</section>`;
}

// ---------------------------------------------------------------------------
// Reset watch
// ---------------------------------------------------------------------------
const WATCH_LABELS = {
  elevated: "Elevated",
  strong: "Strong signal",
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
    ? `<h2 id="watch-heading">Tibo might be hinting at a reset</h2>`
    : `
  <div class="watch-forecast">
    <p class="watch-probability" aria-label="Greater than ${chanceFloor} percent">
      <span aria-hidden="true">&gt;${chanceFloor}<small>%</small></span>
    </p>
    <div class="watch-forecast-copy">
      <h2 id="watch-heading">${escapeHtml(windowHours)}h reset chance</h2>
      <p>AI estimate</p>
    </div>
  </div>`;
  const context = watch.context_text
    ? `<p class="watch-context"><span>In reply to</span> “${escapeHtml(cleanTweetText(watch.context_text))}”</p>`
    : "";

  return `
<section class="watch-card watch-card--${level}" data-role="reset-watch" data-expires-at="${escapeHtml(watch.expires_at)}" aria-labelledby="watch-heading">
  <div class="watch-topline">
    <span class="watch-kicker"><span aria-hidden="true">👀</span> Reset watch</span>
  </div>
  ${forecast}
  <blockquote>“${escapeHtml(cleanTweetText(watch.text))}” - Tibo</blockquote>
  ${context}
  <div class="watch-meta">
    <span>Seen <span data-role="relative-time" data-datetime="${escapeHtml(watch.observed_at)}">${formatRelative(Date.parse(watch.observed_at))}</span></span>
    <a href="${escapeHtml(watch.tweet_url)}" target="_blank" rel="noopener noreferrer">View on X &rarr;</a>
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_ROW_LABELS = { 1: "Mon", 3: "Wed", 5: "Fri" };

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
        ? `No reset`
        : `${count} reset${count > 1 ? "s" : ""}`;
      const attributes = `class="cg-cell" data-level="${level}" data-date="${day.date}" data-count="${count}" data-snippet="${snippet}" style="grid-column:${wi + 1};grid-row:${di + 2}" aria-label="${label} on ${day.date} (UTC)"`;
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
    <h2 id="graph-heading">The waiting game</h2>
    <p class="section-sub">Last ${WEEKS_BACK} weeks &middot; <span class="legend-chip legend-chip--hit"></span> he tweeted &middot; <span class="legend-chip"></span> we waited</p>
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
        <a class="log-item-link" href="${escapeHtml(ev.tweet_url)}" target="_blank" rel="noopener noreferrer">View on X &rarr;</a>
      </div>
    </li>`).join("");
}

export function renderEventLog(events) {
  if (!events || events.length === 0) {
    return `
<section class="log-section" aria-labelledby="log-heading">
  <div class="section-head">
    <h2 id="log-heading">In his own words</h2>
  </div>
  <p class="log-empty">Nothing yet. The timeline is quiet. Too quiet.</p>
</section>`;
  }

  const previewItems = renderLogItems(events.slice(0, LOG_PREVIEW_COUNT));
  const remainingItems = renderLogItems(events.slice(LOG_PREVIEW_COUNT));
  const more = remainingItems
    ? `
  <details class="log-more">
    <summary class="log-more-toggle">
      <span class="log-more-label-closed">Show all ${events.length} resets</span>
      <span class="log-more-label-open">Show fewer</span>
      <span class="log-more-arrow" aria-hidden="true">&darr;</span>
    </summary>
    <ol class="log-list log-list--more" start="${LOG_PREVIEW_COUNT + 1}">${remainingItems}</ol>
  </details>`
    : "";

  return `
<section class="log-section" aria-labelledby="log-heading">
  <div class="section-head">
    <h2 id="log-heading">In his own words</h2>
    <p class="section-sub">Every announcement, preserved for history</p>
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
<div class="sponsor-layout">
<div class="page">
  <header class="masthead">
    <div class="masthead-brand">
      <img class="masthead-avatar" src="/thsottiaux-avatar.jpg" alt="" aria-hidden="true" width="44" height="44" />
      <div class="masthead-copy">
        <div class="masthead-title-row">
          <h1 class="masthead-title">Codex Resets</h1>
        </div>
      </div>
    </div>
    <div class="masthead-side">
      ${isDemo ? `<span class="demo-badge" title="Showing bundled sample data, not live results">demo data</span>` : ""}
      <button class="theme-toggle" type="button" data-role="theme-toggle" aria-label="Toggle color theme" title="Toggle color theme">
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
    <p>Data from @thsottiaux's tweets, classified by a robot that takes this very seriously. Not affiliated with OpenAI.</p>
    <p>Tibo, if you're reading this: no pressure.</p>
    <p>Built by <a href="https://x.com/wong2__" target="_blank" rel="noopener noreferrer">@wong2__</a>.</p>
  </footer>
</div>
<aside class="sponsor-rail sponsor-rail--left" data-role="sponsor-left" aria-label="Sponsored products" hidden></aside>
<aside class="sponsor-rail sponsor-rail--right" data-role="sponsor-right" aria-label="Sponsored products" hidden></aside>
<dialog class="sponsor-dialog" data-role="sponsor-dialog" aria-labelledby="sponsor-dialog-title">
  <button class="sponsor-dialog-close" type="button" data-role="sponsor-dialog-close" aria-label="Close"><span aria-hidden="true">&times;</span></button>

  <section data-role="sponsor-offer-view">
    <span class="sponsor-dialog-kicker">Sponsorship</span>
    <h2 id="sponsor-dialog-title">Reach developers using Codex</h2>
    <dl class="sponsor-offer-facts">
      <div class="sponsor-offer-fact sponsor-offer-fact--wide">
        <dt>Monthly visitors</dt>
        <dd data-role="sponsor-monthly-visits">~150,000</dd>
      </div>
      <div>
        <dt>Price</dt>
        <dd><span data-role="sponsor-monthly-price">$699</span><small>/month</small></dd>
      </div>
      <div>
        <dt>Ad spots</dt>
        <dd><span data-role="sponsor-available">&ndash;</span><small> available of <span data-role="sponsor-total">4</span></small></dd>
      </div>
    </dl>
    <button class="subscription-action sponsor-pay-button" type="button" data-role="sponsor-pay" disabled>Pay with Stripe</button>
    <p class="sponsor-dialog-status" data-role="sponsor-offer-status" aria-live="polite">Checking availability&hellip;</p>
  </section>

</dialog>
</div>`;
}
