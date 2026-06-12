
const client = initSupabaseClient();
let currentPoll = null;

async function loadPollForVote() {
  if (!client) return alert("尚未配置 Supabase。");

  const pollId = document.getElementById("votePollId").value.trim();
  const voterNo = Math.max(1, parseInt(document.getElementById("voterNo").value || "1", 10));
  const voterName = document.getElementById("voterName").value.trim();

  if (!pollId) return alert("请填写投票 ID。");
  if (!voterName) return alert("请填写你的投票人名称。");

  try {
    const poll = await fetchPollWithOptions(client, pollId);
    currentPoll = poll;

    if (voterNo > poll.voter_count) {
      document.getElementById("voteBox").innerHTML = `<p class="error">该投票只设置了 ${poll.voter_count} 位投票人，请检查编号。</p>`;
      return;
    }

    await upsertVoter(pollId, voterNo, voterName);
    await renderVoteBox(poll, voterNo, voterName);
  } catch (err) {
    console.error(err);
    document.getElementById("voteBox").innerHTML = `<p class="error">读取失败：${escapeHtml(err.message)}</p>`;
  }
}

async function upsertVoter(pollId, voterNo, voterName) {
  const { error } = await client
    .from("voters")
    .upsert({
      poll_id: pollId,
      voter_no: voterNo,
      voter_name: voterName
    }, {
      onConflict: "poll_id,voter_no"
    });

  if (error) throw error;
}

async function renderVoteBox(poll, voterNo, voterName) {
  const { data: oldVotes, error } = await client
    .from("votes")
    .select("option_id")
    .eq("poll_id", poll.id)
    .eq("voter_no", voterNo);

  if (error) throw error;

  const selected = new Set((oldVotes || []).map(v => v.option_id));

  document.getElementById("voteBox").innerHTML = `
    <h3>${escapeHtml(poll.title)}</h3>
    <p>
      <span class="pill">投票人编号：${voterNo}</span>
      <span class="pill">名称：${escapeHtml(voterName)}</span>
      <span class="pill">最多可投：${poll.votes_per_person} 票</span>
      <span class="pill">投票人数：${poll.voter_count}</span>
    </p>
    <p class="notice">
      投票规则：请在下方选项中选择最多 ${poll.votes_per_person} 项。再次提交会覆盖你这个编号之前的选择。
    </p>
    <div id="choices">
      ${poll.options.map(opt => `
        <label class="choice">
          <input type="checkbox" value="${escapeHtml(opt.id)}" ${selected.has(opt.id) ? "checked" : ""} />
          <div>
            <div class="option-title">${escapeHtml(opt.name)}</div>
            ${opt.description ? `<div class="option-desc">${escapeHtml(opt.description)}</div>` : ""}
          </div>
        </label>
      `).join("")}
    </div>
    <div class="btns">
      <button id="submitVoteBtn">提交投票</button>
      <button class="secondary" id="reloadVoteBtn">刷新我的投票</button>
    </div>
  `;

  document.getElementById("submitVoteBtn").addEventListener("click", () => submitVote(poll, voterNo, voterName));
  document.getElementById("reloadVoteBtn").addEventListener("click", () => renderVoteBox(poll, voterNo, voterName));
}

async function submitVote(poll, voterNo, voterName) {
  const checked = [...document.querySelectorAll("#choices input:checked")].map(input => input.value);
  if (checked.length === 0) return alert("请至少选择 1 个选项。");
  if (checked.length > poll.votes_per_person) {
    return alert(`最多只能选择 ${poll.votes_per_person} 个选项。`);
  }

  try {
    await upsertVoter(poll.id, voterNo, voterName);

    const { error: deleteError } = await client
      .from("votes")
      .delete()
      .eq("poll_id", poll.id)
      .eq("voter_no", voterNo);

    if (deleteError) throw deleteError;

    const rows = checked.map(optionId => ({
      poll_id: poll.id,
      option_id: optionId,
      voter_no: voterNo
    }));

    const { error: insertError } = await client.from("votes").insert(rows);
    if (insertError) throw insertError;

    alert("投票已提交。");
    await renderVoteBox(poll, voterNo, voterName);
  } catch (err) {
    console.error(err);
    alert("提交失败：" + err.message);
  }
}

document.getElementById("loadPollBtn").addEventListener("click", loadPollForVote);

const urlPollId = getPollIdFromUrl();
if (urlPollId) {
  document.getElementById("votePollId").value = urlPollId;
}
