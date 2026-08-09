const root = document.querySelector("#app");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

const safeUrl = (value) => {
  try {
    const url = new URL(String(value), location.href);
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "#";
  } catch {
    return "#";
  }
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const relativeUnits = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

function relativeTime(iso) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  if (!Number.isFinite(seconds)) return "Unknown time";
  const [unit, divisor] = relativeUnits.find(([, size]) => Math.abs(seconds) >= size) ?? ["second", 1];
  return relativeFormatter.format(Math.round(seconds / divisor), unit);
}

function validateContent(value) {
  if (!value || typeof value !== "object") throw new Error("Configuration must be an object.");
  if (!value.site?.name || !value.hero?.timestamp || !Array.isArray(value.stats) || !Array.isArray(value.updates)) {
    throw new Error("Configuration is missing site.name, hero.timestamp, stats, or updates.");
  }
  return value;
}

function render(data) {
  const { site, hero, stats, updates, footer = {} } = data;
  document.title = site.name;
  document.documentElement.dataset.theme = site.theme || "sunrise";

  root.innerHTML = `
    <header class="masthead">
      <div>
        <p class="eyebrow">${escapeHtml(site.eyebrow)}</p>
        <h1>${escapeHtml(site.name)}</h1>
      </div>
      <button class="theme-toggle" type="button" aria-label="Toggle theme">◐</button>
    </header>
    <main>
      <section class="intro">
        <p>${escapeHtml(site.description)}</p>
      </section>
      <section class="hero-card" aria-labelledby="hero-label">
        <p id="hero-label" class="hero-label">${escapeHtml(hero.label)}</p>
        <p class="hero-time" data-relative="${escapeHtml(hero.timestamp)}">${escapeHtml(relativeTime(hero.timestamp))}</p>
        <p class="hero-date">${escapeHtml(dateFormatter.format(new Date(hero.timestamp)))}</p>
        <p class="hero-message">${escapeHtml(hero.message)}</p>
        <a href="${safeUrl(hero.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(hero.sourceLabel)} →</a>
      </section>
      <dl class="stats">
        ${stats.map((item) => `
          <div class="stat stat--${escapeHtml(item.tone || "yellow")}">
            <dt>${escapeHtml(item.label)}</dt>
            <dd>${escapeHtml(item.value)}</dd>
          </div>`).join("")}
      </dl>
      <section class="updates" aria-labelledby="updates-heading">
        <div class="section-heading">
          <p class="eyebrow">Archive</p>
          <h2 id="updates-heading">Recent updates</h2>
        </div>
        <ol class="update-list">
          ${updates.map((item) => `
            <li class="update-card">
              <time datetime="${escapeHtml(item.timestamp)}">${escapeHtml(dateFormatter.format(new Date(item.timestamp)))}</time>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.text)}</p>
              ${item.url ? `<a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">Source →</a>` : ""}
            </li>`).join("")}
        </ol>
      </section>
    </main>
    <footer>
      <p>${escapeHtml(footer.note)}</p>
      <p>${escapeHtml(footer.credit)}</p>
    </footer>`;

  root.querySelector(".theme-toggle").addEventListener("click", () => {
    const dark = document.documentElement.dataset.mode === "dark";
    document.documentElement.dataset.mode = dark ? "light" : "dark";
  });
}

async function boot() {
  try {
    const response = await fetch("./content.json", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Could not load content.json (HTTP ${response.status}).`);
    render(validateContent(await response.json()));
  } catch (error) {
    root.innerHTML = `<section class="error"><h1>Configuration error</h1><p>${escapeHtml(error instanceof Error ? error.message : error)}</p></section>`;
  }
}

await boot();

