CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_content (id, content_json, version)
VALUES (
  1,
  '{"site":{"name":"Reset Watch","eyebrow":"Community status board","description":"A tiny status page configured through Cloudflare D1.","theme":"sunrise"},"hero":{"label":"Time since the last reset","timestamp":"2026-08-08T20:29:22.000Z","message":"Limits were refreshed for paid users. Enjoy the extra room.","sourceLabel":"View announcement","sourceUrl":"https://example.com/announcement"},"stats":[{"label":"Resets tracked","value":"41","tone":"yellow"},{"label":"Average interval","value":"8.1d","tone":"pink"},{"label":"Longest wait","value":"67.7d","tone":"blue"}],"updates":[{"id":"reset-2026-08-08","timestamp":"2026-08-08T20:29:22.000Z","title":"Usage limits reset","text":"A new reset has landed for all paid users.","url":"https://example.com/announcement"},{"id":"reset-2026-08-01","timestamp":"2026-08-01T18:00:00.000Z","title":"Weekend reset","text":"Another reset arrived before the weekend.","url":"https://example.com/older-announcement"}],"footer":{"note":"Community-maintained demo. Not affiliated with OpenAI.","credit":"Powered by Cloudflare Workers and D1."}}',
  1
);

