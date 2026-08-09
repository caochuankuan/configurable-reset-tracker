const root = document.querySelector("#app");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const safeUrl = (value) => { try { const url = new URL(String(value), location.href); return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "#"; } catch { return "#"; } };
const dates = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const units = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];

function relativeTime(iso) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const [unit, size] = units.find(([, value]) => Math.abs(seconds) >= value) ?? ["second", 1];
  return Number.isFinite(seconds) ? relative.format(Math.round(seconds / size), unit) : "Unknown time";
}

function render({ site, hero, stats, updates, footer = {} }) {
  document.title = site.name;
  root.innerHTML = `
    <header class="masthead"><div><p class="eyebrow">${escapeHtml(site.eyebrow)}</p><h1>${escapeHtml(site.name)}</h1></div><div class="actions"><a href="/admin/">Admin</a><button class="theme-toggle" type="button" aria-label="Toggle theme">◐</button></div></header>
    <main><section class="intro"><p>${escapeHtml(site.description)}</p></section>
    <section class="hero-card"><p class="hero-label">${escapeHtml(hero.label)}</p><p class="hero-time">${escapeHtml(relativeTime(hero.timestamp))}</p><p class="hero-date">${escapeHtml(dates.format(new Date(hero.timestamp)))}</p><p class="hero-message">${escapeHtml(hero.message)}</p><a href="${safeUrl(hero.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(hero.sourceLabel)} →</a></section>
    <dl class="stats">${stats.map((item) => `<div class="stat stat--${escapeHtml(item.tone || "yellow")}"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join("")}</dl>
    <section class="updates"><div class="section-heading"><p class="eyebrow">Archive</p><h2>Recent updates</h2></div><ol class="update-list">${updates.map((item) => `<li class="update-card"><time datetime="${escapeHtml(item.timestamp)}">${escapeHtml(dates.format(new Date(item.timestamp)))}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p>${item.url ? `<a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">Source →</a>` : ""}</li>`).join("")}</ol></section></main>
    <footer><p>${escapeHtml(footer.note)}</p><p>${escapeHtml(footer.credit)}</p></footer>`;
  root.querySelector(".theme-toggle").addEventListener("click", () => { document.documentElement.dataset.mode = document.documentElement.dataset.mode === "dark" ? "light" : "dark"; });
}

try {
  const response = await fetch("/api/content", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Could not load content (HTTP ${response.status}).`);
  render(await response.json());
} catch (error) {
  root.innerHTML = `<section class="error"><h1>Configuration error</h1><p>${escapeHtml(error instanceof Error ? error.message : error)}</p></section>`;
}

