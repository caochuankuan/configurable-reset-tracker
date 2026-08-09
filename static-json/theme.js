(() => {
  const STORAGE_KEY = "codex-resets-theme";
  const LIGHT = "light";
  const DARK = "dark";
  const THEME_COLORS = {
    light: "#fff4dd",
    dark: "#17130f",
  };
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;

  function readPreference() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value === LIGHT || value === DARK ? value : null;
    } catch {
      return null;
    }
  }

  function writePreference(theme) {
    preference = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The active theme still changes when storage is unavailable.
    }
  }

  function systemPreference() {
    return systemTheme.matches ? DARK : LIGHT;
  }

  function syncControls(scope = document) {
    const theme = root.dataset.theme === DARK ? DARK : LIGHT;
    const nextTheme = theme === DARK ? LIGHT : DARK;
    scope.querySelectorAll('[data-role="theme-toggle"]').forEach((button) => {
      button.setAttribute("aria-pressed", theme === DARK ? "true" : "false");
      button.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
      button.setAttribute("title", `Switch to ${nextTheme} mode`);
    });
  }

  function applyTheme(theme) {
    const normalized = theme === DARK ? DARK : LIGHT;
    root.dataset.theme = normalized;
    root.style.colorScheme = normalized;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", THEME_COLORS[normalized]);
    });
    syncControls();
  }

  function toggleTheme() {
    const nextTheme = root.dataset.theme === DARK ? LIGHT : DARK;
    writePreference(nextTheme);
    applyTheme(nextTheme);
  }

  preference = readPreference();
  applyTheme(preference ?? systemPreference());
  root.classList.add("theme-controls-enabled");

  systemTheme.addEventListener?.("change", () => {
    if (!preference) applyTheme(systemPreference());
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-role="theme-toggle"]')) toggleTheme();
  });

  document.addEventListener("DOMContentLoaded", () => syncControls());
  window.codexResetsTheme = { sync: syncControls };
})();
