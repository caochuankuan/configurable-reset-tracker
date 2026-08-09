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
  status.textContent = "加载中…";
  const result = await api();
  version = result.version;
  textarea.value = JSON.stringify(result.content, null, 2);
  meta.textContent = `版本 ${version} · 更新时间 ${result.updatedAt}`;
  login.hidden = true;
  editor.hidden = false;
  status.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  token = tokenInput.value.trim();
  loginStatus.textContent = "连接中…";
  if (!token) {
    loginStatus.textContent = "请输入管理员令牌。";
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
  status.textContent = "校验中…";
  let content;
  try { content = JSON.parse(textarea.value); } catch (error) { status.textContent = `JSON 无效：${error.message}`; return; }
  try {
    const result = await api("PUT", { content, expectedVersion: version });
    version = result.version;
    meta.textContent = `版本 ${version} · 更新时间 ${result.updatedAt}`;
    status.textContent = "已保存，公开页面将在 60 秒内更新。";
  } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
});
