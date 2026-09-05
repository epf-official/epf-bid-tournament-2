// Supabase Setup
const SUPABASE_URL = 'https://mkvwrotnpyqscipmaujn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y_lWfoWmIST7HTcATF1MIg_A3JIKGhv';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let loggedInCaptain = null;
let activeFixtureId = null;

// Page Load
window.onload = function() {
    init();
};

async function init() {
    await fetchNotice();
    await fetchTeams();
    await fetchFixtures();
    await calculatePoints();
}

// Modal Control
function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// CAPTAIN AUTHENTICATION
async function openCaptainLoginModal() {
    const { data: teams } = await db.from('teams').select('*');
    const select = document.getElementById('login-team-select');
    select.innerHTML = teams ? teams.map(t => `<option value="${t.id}">${t.team_name} (${t.captain_name})</option>`).join('') : '';
    document.getElementById('captainLoginModal').style.display = 'flex';
}

async function processCaptainLogin() {
    const teamId = document.getElementById('login-team-select').value;
    const pass = document.getElementById('login-pass').value;

    const { data: team } = await db.from('teams').select('*').eq('id', teamId).eq('captain_pass', pass).single();

    if (team) {
        loggedInCaptain = team;
        document.getElementById('login-status-text').innerText = `লগইনড: ${team.captain_name} (${team.team_name})`;
        document.getElementById('cap-login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        closeModals();
        alert("লগইন সফল হয়েছে!");
    } else {
        alert("ভুল পাসওয়ার্ড!");
    }
}

function logout() {
    loggedInCaptain = null;
    document.getElementById('login-status-text').innerText = 'স্ট্যাটাস: সাধারণ ভিজিটর';
    document.getElementById('cap-login-btn').style.display = 'inline-block';
    document.getElementById('logout-btn').style.display = 'none';
}

// DATA FETCHING
async function fetchNotice() {
    const { data } = await db.from('notices').select('*').order('id', { ascending: false }).limit(1);
    if (data && data.length > 0) document.getElementById('notice-display').innerText = data[0].notice_text;
}

async function fetchTeams() {
    const { data: teams } = await db.from('teams').select('*, players(*)');
    const container = document.getElementById('teams-list');
    if (!teams || teams.length === 0) { container.innerHTML = '<p>কোনো টিম নিবন্ধিত হয়নি।</p>'; return; }
    container.innerHTML = teams.map(t => `
        <div class="team-card">
            <h3>${t.team_name}</h3>
            <div style="color:var(--cyan)">ক্যাপ্টেন: ${t.captain_name}</div>
            <ol>
                <li><strong>${t.captain_name} (Captain)</strong></li>
                ${t.players ? t.players.map(p => `<li>${p.player_name}</li>`).join('') : ''}
            </ol>
        </div>
    `).join('');
}

async function fetchFixtures() {
    const { data: fixtures } = await db.from('fixtures').select('*').order('matchday', { ascending: true });
    const { data: teams } = await db.from('teams').select('*');
    const { data: results } = await db.from('match_results').select('*');

    const teamMap = {};
    if (teams) teams.forEach(t => teamMap[t.id] = t);

    const container = document.getElementById('fixtures-list');
    const resultContainer = document.getElementById('result-submit-list');

    if (!fixtures || fixtures.length === 0) {
        container.innerHTML = '<p>ফিকশ্চার তৈরি হয়নি।</p>';
        resultContainer.innerHTML = '<p>কোনো ম্যাচ পাওয়া যায়নি।</p>';
        return;
    }

    container.innerHTML = fixtures.map(f => {
        let teamA = teamMap[f.team_a_id] ? teamMap[f.team_a_id].team_name : 'Team A';
        let teamB = teamMap[f.team_b_id] ? teamMap[f.team_b_id].team_name : 'Team B';

        let matchRes = results ? results.filter(r => r.fixture_id === f.id && r.status === 'Approved') : [];
        let res = matchRes.length > 0 ? matchRes[matchRes.length - 1] : null;

        let headerTitle = `${teamA} VS ${teamB}`;
        if (res) {
            headerTitle = `${teamA} <span style="color:var(--gold); font-size:1.2rem;">(${res.score_a})</span> <span style="color:var(--cyan);">VS</span> <span style="color:var(--gold); font-size:1.2rem;">(${res.score_b})</span> ${teamB}`;
        }

        let versusHtml = '';
        if (f && f.squad_matches) {
            let matches = f.squad_matches.split('|');
            versusHtml = `
                <div class="versus-box">
                    <strong style="color:var(--cyan)">১v১ ম্যাচের প্লেয়ার বিস্তারিত:</strong>
                    <div style="margin-top:8px; font-size:0.88rem; line-height: 1.6;">
                        ${matches.map((m, i) => `<div style="border-bottom:1px dashed #272d3d; padding:3px 0;"><strong>${m.includes('[SUPER]') ? 'সুপার ম্যাচ' : 'ম্যাচ ' + (i+1)}:</strong> ${m.trim()}</div>`).join('')}
                    </div>
                </div>
            `;
        }

        let actionBtn = `<button class="btn-action" onclick="openSquadModal(${f.id}, ${f.team_a_id}, ${f.team_b_id})">Squad Submit</button>`;
        if (f.status === 'Super Match Needed') {
            actionBtn = `<button class="btn-action btn-super" onclick="openSuperSquadModal(${f.id}, ${f.team_a_id}, ${f.team_b_id})">Super Player Select</button>`;
        }

        return `
            <div class="fixture-card">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <span class="badge">Match ${f.matchday} (${f.match_date ? f.match_date : 'Date: TBD'})</span>
                        <div style="font-weight:bold; margin-top:5px; font-size:1.1rem;">${headerTitle}</div>
                        <small>স্ট্যাটাস: <strong style="color:${f.status && f.status.includes('Super') ? 'var(--gold)' : 'var(--cyan)'}">${f.status}</strong></small>
                    </div>
                    ${actionBtn}
                </div>
                ${versusHtml}
            </div>
        `;
    }).join('');

    resultContainer.innerHTML = fixtures.map(f => {
        let teamA = teamMap[f.team_a_id] ? teamMap[f.team_a_id].team_name : 'Team A';
        let teamB = teamMap[f.team_b_id] ? teamMap[f.team_b_id].team_name : 'Team B';

        let submitBtn = `<button class="btn-action" onclick="openResultModal(${f.id})">Submit Score</button>`;
        if (f.status === 'Super Match Scheduled') {
            submitBtn = `<button class="btn-action btn-super" onclick="openSuperResultModal(${f.id})">Submit Super Score</button>`;
        }

        return `
            <div class="fixture-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="badge">Match ${f.matchday} (${f.match_date ? f.match_date : 'Date: TBD'})</span>
                        <div style="font-weight:bold; margin-top:5px;">${teamA} VS ${teamB}</div>
                        <small>স্ট্যাটাস: ${f.status}</small>
                    </div>
                    ${submitBtn}
                </div>
            </div>
        `;
    }).join('');
}

// SQUAD SUBMISSION
async function openSquadModal(fixtureId, teamAId, teamBId) {
    if (!loggedInCaptain) { alert("প্রথমে 'Captain Login' করে আসুন!"); return; }
    if (loggedInCaptain.id !== teamAId && loggedInCaptain.id !== teamBId) {
        alert("আপনি এই ম্যাচের অংশ নন!"); return;
    }

    activeFixtureId = fixtureId;
    const { data: players } = await db.from('players').select('*').eq('team_id', loggedInCaptain.id);

    let allPlayerList = [loggedInCaptain.captain_name];
    if (players) {
        players.forEach(p => {
            if (p.player_name.trim().toLowerCase() !== loggedInCaptain.captain_name.trim().toLowerCase()) {
                allPlayerList.push(p.player_name);
            }
        });
    }

    const selectors = document.querySelectorAll('.squad-select');
    selectors.forEach((s, index) => {
        s.innerHTML = allPlayerList.map(p => `<option value="${p}">${p}</option>`).join('');
        if (allPlayerList[index]) s.selectedIndex = index;
    });

    document.getElementById('squadModal').style.display = 'flex';
}

async function submitSquad() {
    const selects = document.querySelectorAll('.squad-select');
    const selectedPlayers = Array.from(selects).map(s => s.value);

    const uniquePlayers = new Set(selectedPlayers);
    if (uniquePlayers.size < selectedPlayers.length) {
        alert("একই প্লেয়ারকে বারবার সিলেক্ট করা যাবে না! ৫ জন আলাদা প্লেয়ার বেছে নিন।");
        return;
    }

    const squadList = selectedPlayers.join(', ');

    const { error } = await db.from('squad_submissions').insert([{
        fixture_id: activeFixtureId,
        team_id: loggedInCaptain.id,
        player_list: squadList,
        status: 'Pending'
    }]);

    if (error) { alert("স্কোয়াড সাবমিটে সমস্যা: " + error.message); return; }

    closeModals();
    alert("স্কোয়াড সাবমিট করা হয়েছে! অ্যাডমিন প্যানেল থেকে এপ্রুভ হলে ১v১ ম্যাচ শো করবে।");
    init();
}

// SUPER MATCH SQUAD
async function openSuperSquadModal(fixtureId, teamAId, teamBId) {
    if (!loggedInCaptain) { alert("প্রথমে 'Captain Login' করে আসুন!"); return; }
    if (loggedInCaptain.id !== teamAId && loggedInCaptain.id !== teamBId) {
        alert("আপনি এই ম্যাচের অংশ নন!"); return;
    }

    activeFixtureId = fixtureId;
    const { data: players } = await db.from('players').select('*').eq('team_id', loggedInCaptain.id);

    let allPlayerList = [loggedInCaptain.captain_name];
    if (players) {
        players.forEach(p => {
            if (p.player_name.trim().toLowerCase() !== loggedInCaptain.captain_name.trim().toLowerCase()) {
                allPlayerList.push(p.player_name);
            }
        });
    }

    const select = document.getElementById('super-player-select');
    select.innerHTML = allPlayerList.map(p => `<option value="${p}">${p}</option>`).join('');

    document.getElementById('superSquadModal').style.display = 'flex';
}

async function submitSuperSquad() {
    const player = document.getElementById('super-player-select').value;

    const { error } = await db.from('squad_submissions').insert([{
        fixture_id: activeFixtureId,
        team_id: loggedInCaptain.id,
        player_list: `[SUPER] ${player}`,
        status: 'Super_Pending'
    }]);

    if (error) { alert("সুপার প্লেয়ার সাবমিটে সমস্যা: " + error.message); return; }

    closeModals();
    alert("সুপার প্লেয়ার সাবমিট করা হয়েছে! অ্যাডমিন এপ্রুভালের অপেক্ষা করুন।");
    init();
}

// REGULAR RESULT SUBMISSION
async function openResultModal(fixtureId) {
    if (!loggedInCaptain) { alert("প্রথমে 'Captain Login' করে আসুন!"); return; }

    const { data: fixture } = await db.from('fixtures').select('*').eq('id', fixtureId).single();
    if (!fixture || !fixture.squad_matches) {
        alert("এই ম্যাচের ১v১ ভার্সেস এখনো জেনারেট হয়নি! অ্যাডমিন থেকে স্কোয়াড এপ্রুভ করান।");
        return;
    }

    const { data: teamA } = await db.from('teams').select('*').eq('id', fixture.team_a_id).single();
    const { data: teamB } = await db.from('teams').select('*').eq('id', fixture.team_b_id).single();

    activeFixtureId = fixtureId;

    const { data: playersA } = await db.from('players').select('player_name').eq('team_id', fixture.team_a_id);
    const { data: playersB } = await db.from('players').select('player_name').eq('team_id', fixture.team_b_id);

    let listA = [teamA.captain_name];
    if (playersA) playersA.forEach(p => { if (p.player_name.trim().toLowerCase() !== teamA.captain_name.trim().toLowerCase()) listA.push(p.player_name); });

    let listB = [teamB.captain_name];
    if (playersB) playersB.forEach(p => { if (p.player_name.trim().toLowerCase() !== teamB.captain_name.trim().toLowerCase()) listB.push(p.player_name); });

    const matches = fixture.squad_matches.split('|');
    const container = document.getElementById('modal-5-matches-container');

    container.innerHTML = matches.map((m, idx) => {
        let currentP_A = listA.find(p => m.includes(p)) || listA[0];
        let currentP_B = listB.find(p => m.includes(p)) || listB[0];

        let optionsA = listA.map(p => `<option value="${p}" ${p === currentP_A ? 'selected' : ''}>${p}</option>`).join('');
        let optionsB = listB.map(p => `<option value="${p}" ${p === currentP_B ? 'selected' : ''}>${p}</option>`).join('');

        return `
            <div class="match-score-row">
                <strong style="color:var(--gold); font-size:0.85rem;">ম্যাচ ${idx+1} (Sub/Swap Editable):</strong>
                <div class="edit-select-box">
                    <select class="edit-player-a">${optionsA}</select>
                    <span style="color:var(--cyan); font-weight:bold;">VS</span>
                    <select class="edit-player-b">${optionsB}</select>
                </div>
                <div class="score-inputs">
                    <span style="font-size:0.8rem; width:90px; text-overflow:ellipsis; overflow:hidden;">${teamA.team_name}</span>
                    <input type="number" class="match-score-a" value="0">
                    <span>-</span>
                    <input type="number" class="match-score-b" value="0">
                    <span style="font-size:0.8rem; width:90px; text-overflow:ellipsis; overflow:hidden;">${teamB.team_name}</span>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('resultModal').style.display = 'flex';
}

async function submitMatchResult() {
    const inputsA = document.querySelectorAll('.match-score-a');
    const inputsB = document.querySelectorAll('.match-score-b');
    const selectsA = document.querySelectorAll('.edit-player-a');
    const selectsB = document.querySelectorAll('.edit-player-b');
    const url = document.getElementById('screenshot-url-input').value;

    let scoreA = 0;
    let scoreB = 0;
    let updatedMatches = [];

    for (let i = 0; i < inputsA.length; i++) {
        let pA = selectsA[i].value;
        let pB = selectsB[i].value;
        let sA = parseInt(inputsA[i].value) || 0;
        let sB = parseInt(inputsB[i].value) || 0;

        scoreA += sA;
        scoreB += sB;
        updatedMatches.push(`${pA} (${sA}) vs ${pB} (${sB})`);
    }

    const newSquadMatches = updatedMatches.join(' | ');

    await db.from('fixtures').update({ squad_matches: newSquadMatches }).eq('id', activeFixtureId);

    const { error } = await db.from('match_results').insert([{
        fixture_id: activeFixtureId,
        score_a: scoreA,
        score_b: scoreB,
        screenshot_url: url,
        status: 'Pending'
    }]);

    if (error) { alert("রেজাল্ট সাবমিটে সমস্যা: " + error.message); return; }

    closeModals();
    alert("রেজাল্ট সফলভাবে সাবমিট করা হয়েছে! অ্যাডমিন এপ্রুভালের জন্য অপেক্ষা করুন।");
    init();
}

// SUPER MATCH RESULT SUBMISSION
async function openSuperResultModal(fixtureId) {
    if (!loggedInCaptain) { alert("প্রথমে 'Captain Login' করে আসুন!"); return; }
    activeFixtureId = fixtureId;

    const { data: fixture } = await db.from('fixtures').select('*').eq('id', fixtureId).single();
    const { data: teamA } = await db.from('teams').select('*').eq('id', fixture.team_a_id).single();
    const { data: teamB } = await db.from('teams').select('*').eq('id', fixture.team_b_id).single();

    const matches = fixture.squad_matches ? fixture.squad_matches.split('|') : [];
    const superMatchStr = matches.length > 0 ? matches[matches.length - 1] : '';

    const container = document.getElementById('super-match-input-box');
    container.innerHTML = `
        <strong style="color:var(--gold); font-size:0.85rem;">সুপার ম্যাচ (১v১):</strong>
        <div style="margin-top:5px; font-size:0.9rem; color:var(--cyan);">${superMatchStr}</div>
        <div class="score-inputs" style="margin-top:10px;">
            <span style="font-size:0.8rem; width:90px; text-overflow:ellipsis; overflow:hidden;">${teamA.team_name}</span>
            <input type="number" id="super-score-a" value="0">
            <span>-</span>
            <input type="number" id="super-score-b" value="0">
            <span style="font-size:0.8rem; width:90px; text-overflow:ellipsis; overflow:hidden;">${teamB.team_name}</span>
        </div>
    `;

    document.getElementById('superResultModal').style.display = 'flex';
}

async function submitSuperMatchResult() {
    const scoreA = parseInt(document.getElementById('super-score-a').value) || 0;
    const scoreB = parseInt(document.getElementById('super-score-b').value) || 0;
    const url = document.getElementById('super-screenshot-url-input').value;

    if (scoreA === scoreB) {
        alert("সুপার ম্যাচে অবশ্যই একজন বিজয়ী হতে হবে! ড্র গ্রহণযোগ্য নয়।");
        return;
    }

    const { error } = await db.from('match_results').insert([{
        fixture_id: activeFixtureId,
        score_a: scoreA,
        score_b: scoreB,
        screenshot_url: url,
        status: 'Super_Pending'
    }]);

    if (error) { alert("সুপার রেজাল্ট সাবমিটে সমস্যা: " + error.message); return; }

    closeModals();
    alert("সুপার ম্যাচের রেজাল্ট সাবমিট হয়েছে! অ্যাডমিন এপ্রুভালের জন্য অপেক্ষা করুন।");
    init();
}

// ADMIN PANEL CONTROL
function openAdminModal() {
    document.getElementById('adminModal').style.display = 'flex';
}

function verifyAdmin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === 'admin123' || pass === '1234') {
        document.getElementById('admin-auth').style.display = 'none';
        document.getElementById('admin-controls').style.display = 'block';
        loadAdminPendingData();
    } else {
        alert("ভুল অ্যাডমিন পাসওয়ার্ড!");
    }
}

async function loadAdminPendingData() {
    const { data: squads } = await db.from('squad_submissions').select('*, fixtures(*)').eq('status', 'Pending');
    const { data: superSquads } = await db.from('squad_submissions').select('*, fixtures(*)').eq('status', 'Super_Pending');
    const { data: results } = await db.from('match_results').select('*, fixtures(*)').eq('status', 'Pending');
    const { data: superResults } = await db.from('match_results').select('*, fixtures(*)').eq('status', 'Super_Pending');
    const { data: teams } = await db.from('teams').select('*');

    const teamMap = {};
    if (teams) teams.forEach(t => teamMap[t.id] = t.team_name);

    // Render Pending Squads
    const pendingSquadsContainer = document.getElementById('pending-squads-list');
    const squadGroup = {};
    if (squads) {
        squads.forEach(s => {
            if (!squadGroup[s.fixture_id]) squadGroup[s.fixture_id] = [];
            squadGroup[s.fixture_id].push(s);
        });
    }

    const fIds = Object.keys(squadGroup);
    if (fIds.length > 0) {
        pendingSquadsContainer.innerHTML = fIds.map(fId => {
            const list = squadGroup[fId];
            const teamAName = teamMap[list[0]?.fixtures?.team_a_id] || 'Team A';
            const teamBName = teamMap[list[0]?.fixtures?.team_b_id] || 'Team B';
            return `
                <div class="approval-card">
                    <div><strong>Match ID: ${fId}</strong> (${teamAName} VS ${teamBName})</div>
                    <small>জমা পড়া স্কোয়াড: ${list.length}/২ টি টিম</small><br>
                    <button class="btn-action" style="margin-top:5px;" onclick="approveSquadAndGenerate1v1(${fId})">
                        ${list.length >= 2 ? 'এপ্রুভ ও ১v১ জেনারেট করুন' : 'অপেক্ষা করুন (২টি টিম লাগব)'}
                    </button>
                </div>
            `;
        }).join('');
    } else {
        pendingSquadsContainer.innerHTML = 'কোনো স্কোয়াড পেন্ডিং নেই।';
    }

    // Render Pending Results
    const pendingResultsContainer = document.getElementById('pending-results-list');
    if (results && results.length > 0) {
        pendingResultsContainer.innerHTML = results.map(r => `
            <div class="approval-card">
                <div>Match ID: ${r.fixture_id} | ${teamMap[r.fixtures.team_a_id]} (${r.score_a}) VS (${r.score_b}) ${teamMap[r.fixtures.team_b_id]}</div>
                <small><a href="${r.screenshot_url}" target="_blank" style="color:var(--cyan)">স্ক্রিনশট দেখুন</a></small><br>
                <button class="btn-action" onclick="approveResult(${r.id}, ${r.fixture_id}, ${r.score_a}, ${r.score_b})">এপ্রুভ করুন</button>
            </div>
        `).join('');
    } else {
        pendingResultsContainer.innerHTML = 'কোনো রেজাল্ট পেন্ডিং নেই।';
    }

    // Render Pending Super Squads
    const pendingSuperSquadsContainer = document.getElementById('pending-super-squads-list');
    const superSquadGroup = {};
    if (superSquads) {
        superSquads.forEach(s => {
            if (!superSquadGroup[s.fixture_id]) superSquadGroup[s.fixture_id] = [];
            superSquadGroup[s.fixture_id].push(s);
        });
    }

    const superFIds = Object.keys(superSquadGroup);
    if (superFIds.length > 0) {
        pendingSuperSquadsContainer.innerHTML = superFIds.map(fId => {
            const list = superSquadGroup[fId];
            return `
                <div class="approval-card">
                    <div><strong>Super Match ID: ${fId}</strong></div>
                    <small>জমা পড়া প্লেয়ার: ${list.length}/২ টি টিম</small><br>
                    <button class="btn-action btn-super" style="margin-top:5px;" onclick="approveSuperSquad(${fId})">
                        ${list.length >= 2 ? 'সুপার প্লেয়ার এপ্রুভ করুন' : 'অপেক্ষা করুন (২টি টিম লাগব)'}
                    </button>
                </div>
            `;
        }).join('');
    } else {
        pendingSuperSquadsContainer.innerHTML = 'কোনো সুপার প্লেয়ার পেন্ডিং নেই।';
    }

    // Render Pending Super Results
    const pendingSuperResultsContainer = document.getElementById('pending-super-results-list');
    if (superResults && superResults.length > 0) {
        pendingSuperResultsContainer.innerHTML = superResults.map(r => `
            <div class="approval-card">
                <div>Super Match ID: ${r.fixture_id} | Score: ${r.score_a} - ${r.score_b}</div>
                <small><a href="${r.screenshot_url}" target="_blank" style="color:var(--cyan)">স্ক্রিনশট দেখুন</a></small><br>
                <button class="btn-action btn-super" onclick="approveSuperResult(${r.id}, ${r.fixture_id}, ${r.score_a}, ${r.score_b})">এপ্রুভ করুন</button>
            </div>
        `).join('');
    } else {
        pendingSuperResultsContainer.innerHTML = 'কোনো সুপার রেজাল্ট পেন্ডিং নেই।';
    }
}

// RANDOM SHUFFLE FUNCTION
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// ADMIN ACTIONS
async function approveSquadAndGenerate1v1(fixtureId) {
    try {
        const { data: squads, error: squadErr } = await db.from('squad_submissions').select('*').eq('fixture_id', fixtureId).eq('status', 'Pending');

        if (squadErr || !squads || squads.length < 2) {
            alert("দুইটি দলই স্কোয়াড সাবমিট না করা পর্যন্ত এপ্রুভ করা যাবে না!");
            return;
        }

        let squadA = squads[0].player_list.split(',').map(p => p.trim());
        let squadB = squads[1].player_list.split(',').map(p => p.trim());

        // র্যান্ডম শাফেল (Fisher-Yates)
        squadA = shuffle(squadA);
        squadB = shuffle(squadB);

        let matchPairs = [];
        for (let i = 0; i < 5; i++) {
            let playerA = squadA[i] ? squadA[i] : `Player A${i+1}`;
            let playerB = squadB[i] ? squadB[i] : `Player B${i+1}`;
            matchPairs.push(`${playerA} vs ${playerB}`);
        }

        const squadMatchesString = matchPairs.join(' | ');

        await db.from('fixtures').update({
            squad_matches: squadMatchesString,
            status: 'Scheduled'
        }).eq('id', fixtureId);

        await db.from('squad_submissions').update({ status: 'Approved' }).eq('fixture_id', fixtureId);

        alert("১v১ ম্যাচ র্যান্ডমলি জেনারেট ও এপ্রুভ হয়েছে!");
        closeModals();
        init();
    } catch (err) {
        alert("সমস্যা হয়েছে: " + err.message);
    }
}

async function approveSuperSquad(fixtureId) {
    try {
        const { data: squads } = await db.from('squad_submissions').select('*').eq('fixture_id', fixtureId).eq('status', 'Super_Pending');

        if (!squads || squads.length < 2) {
            alert("দুই টিম সুপার প্লেয়ার সাবমিট করা পর্যন্ত অপেক্ষা করুন!");
            return;
        }

        const { data: fixture } = await db.from('fixtures').select('*').eq('id', fixtureId).single();
        let existingMatches = fixture.squad_matches ? fixture.squad_matches : '';
        
        const superPlayerA = squads[0].player_list.replace('[SUPER]', '').trim();
        const superPlayerB = squads[1].player_list.replace('[SUPER]', '').trim();

        const superPair = `[SUPER MATCH] ${superPlayerA} vs ${superPlayerB}`;
        const updatedSquadMatches = existingMatches ? `${existingMatches} | ${superPair}` : superPair;

        await db.from('fixtures').update({
            squad_matches: updatedSquadMatches,
            status: 'Super Match Scheduled'
        }).eq('id', fixtureId);

        await db.from('squad_submissions').update({ status: 'Approved' }).eq('fixture_id', fixtureId);

        alert("সুপার প্লেয়ার এপ্রুভ হয়েছে! এখন ১v১ সুপার ম্যাচ খেলা যাবে।");
        closeModals();
        init();
    } catch (err) {
        alert("সমস্যা হয়েছে: " + err.message);
    }
}

async function approveResult(resultId, fixtureId, scoreA, scoreB) {
    await db.from('match_results').update({ status: 'Approved' }).eq('id', resultId);
    
    let fixtureStatus = 'Completed';
    if (scoreA === scoreB) {
        fixtureStatus = 'Super Match Needed';
    }

    await db.from('fixtures').update({ status: fixtureStatus }).eq('id', fixtureId);
    alert("রেজাল্ট এপ্রুভ করা হয়েছে!");
    loadAdminPendingData();
    init();
}

async function approveSuperResult(resultId, fixtureId, scoreA, scoreB) {
    await db.from('match_results').update({ status: 'Approved' }).eq('id', resultId);
    await db.from('fixtures').update({ status: 'Completed' }).eq('id', fixtureId);
    alert("সুপার ম্যাচের রেজাল্ট এপ্রুভ করা হয়েছে!");
    loadAdminPendingData();
    init();
}

async function generateRandomFixtures() {
    const { data: teams } = await db.from('teams').select('id');
    if (!teams || teams.length < 2) { alert("অন্তত ২টি দল রেজিস্টার্ড থাকতে হবে!"); return; }

    let matchday = 1;
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            await db.from('fixtures').insert([{
                matchday: matchday++,
                team_a_id: teams[i].id,
                team_b_id: teams[j].id,
                status: 'Scheduled'
            }]);
        }
    }
    alert("ফিকশ্চার জেনারেট সম্পন্ন হয়েছে!");
    init();
}

async function updateNotice() {
    const noticeText = document.getElementById('admin-notice-input').value;
    if (!noticeText) return;
    await db.from('notices').insert([{ notice_text: noticeText }]);
    alert("নোটিশ আপডেট করা হয়েছে!");
    fetchNotice();
}

async function saveTeam() {
    const teamName = document.getElementById('team-name').value;
    const captainName = document.getElementById('captain-name').value;
    const capPass = document.getElementById('team-cap-pass').value;
    const playerStr = document.getElementById('player-names').value;

    if (!teamName || !captainName || !capPass) { alert("সব তথ্য দিন!"); return; }

    const { data: team, error } = await db.from('teams').insert([{
        team_name: teamName,
        captain_name: captainName,
        captain_pass: capPass
    }]).select().single();

    if (error) { alert("টিম সেভ করতে সমস্যা: " + error.message); return; }

    if (playerStr) {
        const playerList = playerStr.split(',').map(p => ({ team_id: team.id, player_name: p.trim() }));
        await db.from('players').insert(playerList);
    }

    alert("টিম ও প্লেয়ার সেভ হয়েছে!");
    init();
}

// POINTS TABLE CALCULATION
async function calculatePoints() {
    const { data: teams } = await db.from('teams').select('*');
    const { data: results } = await db.from('match_results').select('*, fixtures(*)').eq('status', 'Approved');

    if (!teams) return;

    const table = {};
    teams.forEach(t => {
        table[t.id] = { name: t.team_name, played: 0, won: 0, drawn: 0, lost: 0, gd: 0, points: 0 };
    });

    if (results) {
        results.forEach(r => {
            const tA = r.fixtures.team_a_id;
            const tB = r.fixtures.team_b_id;

            if (table[tA] && table[tB]) {
                table[tA].played++;
                table[tB].played++;

                const diff = r.score_a - r.score_b;
                table[tA].gd += diff;
                table[tB].gd -= diff;

                if (r.score_a > r.score_b) {
                    table[tA].won++;
                    table[tA].points += 3;
                    table[tB].lost++;
                } else if (r.score_b > r.score_a) {
                    table[tB].won++;
                    table[tB].points += 3;
                    table[tA].lost++;
                } else {
                    table[tA].drawn++;
                    table[tA].points += 1;
                    table[tB].drawn++;
                    table[tB].points += 1;
                }
            }
        });
    }

    const sorted = Object.values(table).sort((a, b) => b.points - a.points || b.gd - a.gd);
    const tbody = document.getElementById('points-table-body');
    tbody.innerHTML = sorted.map(t => `
        <tr>
            <td><strong>${t.name}</strong></td>
            <td>${t.played}</td>
            <td>${t.won}</td>
            <td>${t.drawn}</td>
            <td>${t.lost}</td>
            <td>${t.gd > 0 ? '+' + t.gd : t.gd}</td>
            <td><strong>${t.points}</strong></td>
        </tr>
    `).join('');
}
