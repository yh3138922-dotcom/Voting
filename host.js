
const client = initSupabaseClient();
let lastPollId = "";

const defaultOptions = [
  { name: "选项 A", description: "这里填写选项 A 的简介。" },
  { name: "选项 B", description: "这里填写选项 B 的简介。" },
  { name: "选项 C", description: "这里填写选项 C 的简介。" }
];

function renderOptionEditor(options) {
  const box = document.getElementById("optionEditor");
  box.innerHTML = "";
  options.forEach((opt, index) => {
    const div = document.createElement("div");
    div.className = "option-item";
    div.innerHTML = `
      <div class="option-head">
        <strong>选项 ${index + 1}</strong>
      </div>
      <div class="row">
        <label>名称</label>
        <input data-field="name" type="text" value="${escapeHtml(opt.name)}" />
      </div>
      <div class="row">
        <label>简介</label>
        <textarea data-field="description">${escapeHtml(opt.description || "")}</textarea>
      </div>
    `;
    box.appendChild(div);
  });
}

function getOptionsFromEditor() {
  return [...document.querySelectorAll("#optionEditor .option-item")].map((item, index) => {
    const name = item.querySelector("[data-field='name']").value.trim();
    const description = item.querySelector("[data-field='description']").value.trim();
    return {
      name: name || `选项 ${index + 1}`,
      description,
      sort_order: index
    };
  });
}

function applyOptionCount() {
  const count = Math.max(1, parseInt(document.getElementById("optionCount").value || "1", 10));
  const existing = getOptionsFromEditor();
  const next = [];
  for (let i = 0; i < count; i++) {
    next.push(existing[i] || { name: `选项 ${i + 1}`, description: "" });
  }
  renderOptionEditor(next);
}

function resetEditor() {
  document.getElementById("pollTitle").value = "";
  document.getElementById("voterCount").value = 3;
  document.getElementById("votesPerPerson").value = 1;
  document.getElementById("optionCount").value = 3;
  renderOptionEditor(defaultOptions);
  document.getElementById("createdBox").classList.add("hidden");
}

async function createPoll() {
  if (!client) return alert("尚未配置 Supabase。");

  const title = document.getElementById("pollTitle").value.trim() || "未命名投票";
  const voterCount = Math.max(1, parseInt(document.getElementById("voterCount").value || "1", 10));
  const votesPerPerson = Math.max(1, parseInt(document.getElementById("votesPerPerson").value || "1", 10));
  const options = getOptionsFromEditor();

  if (votesPerPerson > options.length) {
    return alert("每人票数不能大于选项数量。");
  }

  const { data: poll, error: pollError } = await client
    .from("polls")
    .insert({ title, voter_count: voterCount, votes_per_person: votesPerPerson })
    .select()
    .single();

  if (pollError) {
    console.error(pollError);
    return alert("创建投票失败：" + pollError.message);
  }

  const optionRows = options.map((opt, index) => ({
    poll_id: poll.id,
    name: opt.name,
    description: opt.description,
    sort_order: index
  }));

  const { error: optionsError } = await client.from("poll_options").insert(optionRows);
  if (optionsError) {
    console.error(optionsError);
    return alert("创建选项失败：" + optionsError.message);
  }

  lastPollId = poll.id;
  document.getElementById("resultPollId").value = poll.id;

  const pageUrl = location.href.split("?")[0].replace("host.html", "");
  const voteUrl = `${pageUrl}vote.html?poll=${encodeURIComponent(poll.id)}`;
  const hostUrl = `${pageUrl}host.html?poll=${encodeURIComponent(poll.id)}`;

  const createdBox = document.getElementById("createdBox");
  createdBox.classList.remove("hidden");
  createdBox.innerHTML = `
    <h3>创建成功</h3>
    <p><strong>投票 ID：</strong></p>
    <div class="code">${poll.id}</div>
    <div class="btns">
      <button class="secondary" onclick="copyText('${poll.id}')">复制投票 ID</button>
      <button class="secondary" onclick="copyText('${voteUrl}')">复制投票者链接</button>
      <button class="secondary" onclick="copyText('${hostUrl}')">复制主持人结果链接</button>
    </div>
    <p class="muted">
      投票人数：${voterCount}；每人票数：${votesPerPerson}；选项数：${options.length}。<br />
      把投票者链接发给参与者。参与者需要填写自己的投票人编号和名称。
    </p>
  `;

  await loadResults(poll.id);
}

async function loadResults(pollIdFromArg) {
  if (!client) return alert("尚未配置 Supabase。");
  const pollId = pollIdFromArg || document.getElementById("resultPollId").value.trim();
  if (!pollId) return alert("请填写投票 ID。");

  lastPollId = pollId;
  document.getElementById("resultPollId").value = pollId;

  try {
    const poll = await fetchPollWithOptions(client, pollId);

    const { data: voters, error: votersError } = await client
      .from("voters")
      .select("*")
      .eq("poll_id", pollId)
      .order("voter_no", { ascending: true });

    if (votersError) throw votersError;

    const { data: votes, error: votesError } = await client
      .from("votes")
      .select("option_id, voter_no")
      .eq("poll_id", pollId);

    if (votesError) throw votesError;

    renderResults(poll, voters || [], votes || []);
  } catch (err) {
    console.error(err);
    document.getElementById("resultsBox").innerHTML = `<p class="error">读取失败：${escapeHtml(err.message)}</p>`;
  }
}

function renderResults(poll, voters, votes) {
  const optionById = {};
  poll.options.forEach(opt => optionById[opt.id] = opt);

  const counts = {};
  poll.options.forEach(opt => counts[opt.id] = 0);
  votes.forEach(v => {
    if (counts[v.option_id] !== undefined) counts[v.option_id]++;
  });

  const votersByNo = {};
  voters.forEach(v => votersByNo[v.voter_no] = v);

  const votesByVoter = {};
  votes.forEach(v => {
    if (!votesByVoter[v.voter_no]) votesByVoter[v.voter_no] = [];
    votesByVoter[v.voter_no].push(v.option_id);
  });

  const completedNos = Object.keys(votesByVoter).filter(no => (votesByVoter[no] || []).length > 0);
  const totalVotes = votes.length;
  const maxVotes = poll.voter_count * poll.votes_per_person;

  const sorted = [...poll.options].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));

  const detailHtml = [];
  for (let i = 1; i <= poll.voter_count; i++) {
    const voter = votersByNo[i];
    const selectedIds = votesByVoter[i] || [];
    const selectedNames = selectedIds.map(id => optionById[id]?.name || "未知选项");
    const completed = selectedIds.length > 0;
    detailHtml.push(`
      <div class="detail-item">
        <div>
          <span class="pill ${completed ? "ok" : "warn"}">${completed ? "已完成" : "未完成"}</span>
          <strong>${i} 号</strong>
          ${voter?.voter_name ? `｜${escapeHtml(voter.voter_name)}` : "｜未填写名称"}
        </div>
        <div class="muted">
          ${completed ? `选择：${selectedNames.map(escapeHtml).join("、")}` : "暂无选择"}
        </div>
      </div>
    `);
  }

  document.getElementById("resultsBox").innerHTML = `
    <h3>${escapeHtml(poll.title)}</h3>
    <p>
      <span class="pill">投票人数：${poll.voter_count}</span>
      <span class="pill">每人票数：${poll.votes_per_person}</span>
      <span class="pill">已完成人数：${completedNos.length} / ${poll.voter_count}</span>
      <span class="pill">总票数：${totalVotes} / ${maxVotes}</span>
    </p>

    <h3>选项汇总</h3>
    ${sorted.map(opt => {
      const count = counts[opt.id] || 0;
      const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 1000) / 10;
      return `
        <div class="result-row">
          <div class="result-line">
            <span>${escapeHtml(opt.name)}</span>
            <span>${count} 票</span>
          </div>
          <div class="bar-bg"><div class="bar" style="width:${percent}%"></div></div>
          <p class="muted">占已投票数 ${percent}%</p>
        </div>
      `;
    }).join("")}

    <h3>投票人明细</h3>
    ${detailHtml.join("")}
  `;
}

document.getElementById("applyOptionCountBtn").addEventListener("click", applyOptionCount);
document.getElementById("createPollBtn").addEventListener("click", createPoll);
document.getElementById("resetEditorBtn").addEventListener("click", resetEditor);
document.getElementById("loadResultsBtn").addEventListener("click", () => loadResults());
document.getElementById("refreshResultsBtn").addEventListener("click", () => {
  const id = document.getElementById("resultPollId").value.trim() || lastPollId;
  if (id) loadResults(id);
});

renderOptionEditor(defaultOptions);

const urlPollId = getPollIdFromUrl();
if (urlPollId) {
  document.getElementById("resultPollId").value = urlPollId;
  if (client) loadResults(urlPollId);
}
