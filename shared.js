
function initSupabaseClient() {
  const status = document.getElementById("connectionStatus");
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY ||
      window.SUPABASE_URL.includes("YOUR_PROJECT_ID") ||
      window.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
    if (status) {
      status.innerHTML = "尚未配置 Supabase。请先编辑 <code>config.js</code>。";
      status.className = "error";
    }
    return null;
  }
  const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  if (status) {
    status.textContent = "Supabase 已配置。";
    status.className = "success";
  }
  return client;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => alert("已复制。"))
    .catch(() => alert("复制失败，请手动复制。"));
}

async function fetchPollWithOptions(client, pollId) {
  const { data: poll, error: pollError } = await client
    .from("polls")
    .select("*")
    .eq("id", pollId)
    .single();

  if (pollError) throw pollError;

  const { data: options, error: optionsError } = await client
    .from("poll_options")
    .select("*")
    .eq("poll_id", pollId)
    .order("sort_order", { ascending: true });

  if (optionsError) throw optionsError;
  return { ...poll, options: options || [] };
}

function getPollIdFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get("poll") || "";
}
