const login = document.querySelector("#login");
const editor = document.querySelector("#editor");
const form = document.querySelector("#login-form");
const tokenInput = document.querySelector("#token");
const loginStatus = document.querySelector("#login-status");
const textarea = document.querySelector("#content");
const status = document.querySelector("#status");
const meta = document.querySelector("#meta");
let token = "";
let version = 0;

async function api(method = "GET", body) {
  const response = await fetch("/api/admin/content", {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

async function load() {
  status.textContent = "Loading…";
  const result = await api();
  version = result.version;
  textarea.value = JSON.stringify(result.content, null, 2);
  meta.textContent = `Version ${version} · Updated ${result.updatedAt}`;
  login.hidden = true;
  editor.hidden = false;
  status.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  token = tokenInput.value.trim();
  loginStatus.textContent = "Connecting…";
  if (!token) {
    loginStatus.textContent = "Enter the admin token.";
    return;
  }
  try {
    await load();
    loginStatus.textContent = "";
  } catch (error) {
    loginStatus.textContent = error instanceof Error ? error.message : String(error);
  }
});

document.querySelector("#reload").addEventListener("click", () => { load().catch((error) => { status.textContent = error.message; }); });
document.querySelector("#save").addEventListener("click", async () => {
  status.textContent = "Validating…";
  let content;
  try { content = JSON.parse(textarea.value); } catch (error) { status.textContent = `Invalid JSON: ${error.message}`; return; }
  try {
    const result = await api("PUT", { content, expectedVersion: version });
    version = result.version;
    meta.textContent = `Version ${version} · Updated ${result.updatedAt}`;
    status.textContent = "Saved. The public page will update within 60 seconds.";
  } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
});
