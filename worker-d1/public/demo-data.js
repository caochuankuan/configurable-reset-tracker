// Demo data fallback for Codex Resets.
// Used when /api/resets is unreachable, or when the page is loaded with ?demo=1.
// Timestamps are generated relative to "now" so the demo always looks fresh and
// spans the last ~90 days irregularly, the way real reset announcements do.

const TWEET_TEXTS = [
  "我们已经为所有 Plus 和 Pro 用户重置使用额度，尽情使用吧！",
  "所有方案的使用额度都已重置，去创造点新东西吧。",
  "提醒一下：所有人的 Codex 使用额度刚刚完成重置，祝大家玩得开心。",
  "额度已经重置，同时还上线了几项可靠性修复。",
  "正在为所有用户重置使用额度，很快就能恢复满速。",
  "好消息：你的 Codex 额度已重置，感谢大家这周的耐心等待。",
  "所有方案的使用额度均已重置，欢迎告诉我们实际体验。",
  "这次提前为所有人重置了使用额度，不用客气。",
  "额度已重置！我们也提升了容量，希望以后不必频繁重置。",
  "所有 Plus 和 Pro 账户的 Codex 使用额度均已重置。",
  "使用额度的滚动重置已经完成，Codex 又宽裕起来了。",
  "今晚为所有人重置额度，趁新鲜去发布点东西吧。",
];

// Days-ago offsets (irregular spacing, newest first), spread across ~90 days.
const OFFSETS_DAYS = [3.4, 9.8, 11.2, 19.5, 27.0, 34.6, 48.3, 55.9, 68.1, 79.4, 88.7];

function buildDemoEvents() {
  const now = Date.now();
  return OFFSETS_DAYS.map((offset, i) => {
    const ts = new Date(now - offset * 24 * 60 * 60 * 1000);
    // Nudge to a plausible announcement hour rather than an exact fractional time.
    ts.setUTCMinutes(ts.getUTCMinutes() - (ts.getUTCMinutes() % 5));
    const idBase = 1900000000000000000n + BigInt(Math.round(offset * 1000));
    return {
      tweet_id: idBase.toString(),
      tweet_url: `https://x.com/thsottiaux/status/${idBase.toString()}`,
      text: TWEET_TEXTS[i % TWEET_TEXTS.length],
      announced_at: ts.toISOString(),
    };
  });
}

function buildDemoStats(events) {
  const total = events.length;
  const lastResetAt = events[0]?.announced_at ?? null;
  const daysSinceLast = lastResetAt
    ? (Date.now() - new Date(lastResetAt).getTime()) / (24 * 60 * 60 * 1000)
    : null;

  let avgIntervalDays = null;
  if (events.length > 1) {
    const sorted = [...events].sort(
      (a, b) => new Date(a.announced_at) - new Date(b.announced_at)
    );
    let sum = 0;
    for (let i = 1; i < sorted.length; i++) {
      sum += (new Date(sorted[i].announced_at) - new Date(sorted[i - 1].announced_at)) / (24 * 60 * 60 * 1000);
    }
    avgIntervalDays = sum / (sorted.length - 1);
  }

  return {
    total,
    last_reset_at: lastResetAt,
    days_since_last: daysSinceLast,
    avg_interval_days: avgIntervalDays,
  };
}

/** @returns {import("../src/resets").ResetData & { isDemo: true }} */
export function getDemoData() {
  const events = buildDemoEvents();
  const observedAt = new Date(Date.now() - 2.3 * 60 * 60 * 1000);
  return {
    events,
    watch: {
      level: "strong",
      tweet_id: "2080859954421047341",
      tweet_url: "https://x.com/thsottiaux/status/2080859954421047341",
      text: "@xikhar 还有时间。",
      observed_at: observedAt.toISOString(),
      expires_at: new Date(observedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      window_hours: 24,
      reset_chance_24h: 68,
      context_tweet_id: "2080787300917932360",
      context_tweet_url: "https://x.com/i/status/2080787300917932360",
      context_text: "今天没有 Codex 或 Claude 重置，这是人工智能领域最令人失望的两天。",
    },
    stats: buildDemoStats(events),
    reset_requests: {
      cycle_id: events[0]?.tweet_id ?? "demo-reset",
      since: events[0]?.announced_at ?? null,
      count: 37,
    },
    isDemo: true,
  };
}
