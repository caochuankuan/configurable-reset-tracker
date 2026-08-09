// Demo data fallback for Codex Resets.
// Used when /api/resets is unreachable, or when the page is loaded with ?demo=1.
// Timestamps are generated relative to "now" so the demo always looks fresh and
// spans the last ~90 days irregularly, the way real reset announcements do.

const TWEET_TEXTS = [
  "We've reset usage limits for all Plus and Pro users. Enjoy!",
  "Usage limits have been reset across the board. Go build something.",
  "Heads up: Codex usage limits just got reset for everyone. Have fun.",
  "Limits are reset. Also shipped a few reliability fixes under the hood.",
  "Resetting usage limits for all users right now. Back to full speed.",
  "Good news: your Codex limits are reset. Thanks for bearing with us this week.",
  "Usage limits reset across all tiers. Let us know how it feels.",
  "We reset everyone's usage limits a bit early this cycle. You're welcome.",
  "Limits reset! We also bumped capacity, so resets like this should get rarer.",
  "Codex usage limits have been reset for all Plus and Pro accounts.",
  "Rolling reset of usage limits is complete. Codex should feel roomy again.",
  "Reset the limits for everyone tonight. Go ship something while it's fresh.",
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
      text: "@xikhar There is still time",
      observed_at: observedAt.toISOString(),
      expires_at: new Date(observedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      window_hours: 24,
      reset_chance_24h: 68,
      context_tweet_id: "2080787300917932360",
      context_tweet_url: "https://x.com/i/status/2080787300917932360",
      context_text: "No Codex or Claude resets today. The most disappointing last 2 days in AI.",
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
