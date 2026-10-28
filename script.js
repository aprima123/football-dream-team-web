// ============================================================
// STATE GLOBAL
// ============================================================
const state = {
  allPlayers: [],
  poolA: [],
  poolB: [],
  selectedSlot: null,
  activeTeam: null,
  teamA: {},
  teamB: {},
  benchA: {},
  benchB: {}
};

// 🆕 Simpan hasil match sementara, ditampilkan saat tombol "Lihat Statistik" diklik
let pendingResult = null;

// ============================================================
// NAVIGASI SCREEN
// ============================================================
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  if (screenId === 'screen-draft-a') state.activeTeam = 'A';
  if (screenId === 'screen-draft-b') state.activeTeam = 'B';
  if (screenId === 'screen-preview') renderPreview();

  state.selectedSlot = null;
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));

  // 🆕 Reset tombol "Lihat Statistik" setiap pindah screen
  if (screenId !== 'screen-loading') {
    const actionEl = document.getElementById('fulltime-action');
    if (actionEl) actionEl.classList.remove('show');
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
      clockEl.innerText = "0'";
      clockEl.classList.remove('fulltime');
    }
  }

  updateDraftStatus(); 
}

// ============================================================
// LOAD DATA & SETUP
// ============================================================
async function loadPlayers() {
  try {
    const res = await fetch('players.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.allPlayers = data.players;
    console.log(`✅ ${state.allPlayers.length} pemain dimuat`);

    splitPools();
    renderPool('A');
    renderPool('B');
    updateDraftStatus();
  } catch (err) {
    console.error('❌ Gagal load players.json:', err);
  }
}

function splitPools() {
  const byPos = {};
  state.allPlayers.forEach(p => {
    if (!byPos[p.position]) byPos[p.position] = [];
    byPos[p.position].push(p);
  });
  Object.values(byPos).forEach(arr => shuffle(arr));

  state.poolA = [];
  state.poolB = [];
  Object.values(byPos).forEach(arr => {
    arr.forEach((p, i) => {
      if (i % 2 === 0) state.poolA.push(p);
      else state.poolB.push(p);
    });
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
// RENDER UI DRAFT
// ============================================================
function renderPool(team) {
  const container = document.getElementById(`pool-${team.toLowerCase()}`);
  if (!container) return;
  const pool = team === 'A' ? state.poolA : state.poolB;
  const teamObj = team === 'A' ? state.teamA : state.teamB;
  const benchObj = team === 'A' ? state.benchA : state.benchB;

  if (!state.selectedSlot) {
    const available = pool.filter(p => !isPlayerUsed(p.id, teamObj, benchObj));
    container.innerHTML = available.length === 0 
      ? `<div class="player-card placeholder">Pool kosong.</div>`
      : available.map(p => createPlayerCard(p)).join('');
    setupPlayerCardClick(team);
    return;
  }

  // Kalau slot yang dipilih adalah bench, TAMPILKAN SEMUA PEMAIN (tidak filter posisi)
  const isBenchSlot = state.selectedSlot.classList.contains('bench-slot');
  
  let filtered = pool.filter(p => !isPlayerUsed(p.id, teamObj, benchObj));
  
  // Kalau slot starter, filter berdasarkan posisi
  if (!isBenchSlot) {
    const pos = state.selectedSlot.dataset.pos;
    filtered = filtered.filter(p => p.position === pos);
  }

  if (filtered.length === 0) {
    const msg = isBenchSlot 
      ? 'Pool kosong.' 
      : `Tidak ada pemain ${state.selectedSlot.dataset.pos} tersisa.`;
    container.innerHTML = `<div class="player-card placeholder">${msg}</div>`;
    return;
  }

  container.innerHTML = filtered.map(p => createPlayerCard(p)).join('');
  setupPlayerCardClick(team);
}

function createPlayerCard(p) {
  return `
    <div class="player-card" data-id="${p.id}">
      <div class="pc-left">
        <div class="pc-name">${p.name}</div>
        <div class="pc-meta">
          <span class="pc-pos">${p.position}</span>
          <span class="pc-club">${p.club}</span>
        </div>
      </div>
      <div class="pc-rating">${p.overall}</div>
    </div>
  `;
}

function isPlayerUsed(playerId, teamObj, benchObj) {
  const inStarter = Object.values(teamObj).some(p => p && p.id === playerId);
  const inBench = Object.values(benchObj || {}).some(p => p && p.id === playerId);
  return inStarter || inBench;
}

function setupSlotClick() {
  // Klik slot starter
  document.querySelectorAll('.slot').forEach(slot => {
    slot.addEventListener('click', () => handleSlotClick(slot, 'starter'));
  });
  
  // Klik slot bench
  document.querySelectorAll('.bench-slot').forEach(slot => {
    slot.addEventListener('click', () => handleSlotClick(slot, 'bench'));
  });
}

function handleSlotClick(slot, type) {
  const team = state.activeTeam;
  const teamObj = team === 'A' ? state.teamA : state.teamB;
  const benchObj = team === 'A' ? state.benchA : state.benchB;
  const slotKey = type === 'bench' ? slot.dataset.bench : slot.id;

  // Kalau slot ini SUDAH terisi → kosongkan
  const isFilled = type === 'bench' ? benchObj[slotKey] : teamObj[slotKey];
  if (isFilled) {
    if (type === 'bench') delete benchObj[slotKey];
    else delete teamObj[slotKey];
    renderSlot(slot, null, type);
    state.selectedSlot = null;
    slot.classList.remove('selected');
  } else {
    // Kalau slot BELUM terisi → pilih slot
    document.querySelectorAll('.slot, .bench-slot').forEach(s => s.classList.remove('selected'));
    slot.classList.add('selected');
    state.selectedSlot = slot;
  }

  renderPool(team);
  updateCounter(team);
  updateDraftStatus();
}

function setupPlayerCardClick(team) {
  const teamObj = team === 'A' ? state.teamA : state.teamB;
  const benchObj = team === 'A' ? state.benchA : state.benchB;

  document.querySelectorAll(`#pool-${team.toLowerCase()} .player-card:not(.placeholder)`).forEach(card => {
    card.onclick = () => {
      if (!state.selectedSlot) {
        alert("Klik salah satu posisi di lapangan (atau bench) terlebih dahulu!");
        return;
      }
      const playerId = parseInt(card.dataset.id);
      const player = state.allPlayers.find(p => p.id === playerId);
      const isBenchSlot = state.selectedSlot.classList.contains('bench-slot');

      if (isBenchSlot) {
        benchObj[state.selectedSlot.dataset.bench] = player;
        renderSlot(state.selectedSlot, player, 'bench');
      } else {
        teamObj[state.selectedSlot.id] = player;
        renderSlot(state.selectedSlot, player, 'starter');
      }

      state.selectedSlot.classList.remove('selected');
      state.selectedSlot = null;
      renderPool(team);
      updateCounter(team);
      updateDraftStatus();
    };
  });
}

function renderSlot(slotEl, player, type = 'starter') {
  if (player) {
    slotEl.innerHTML = `
      <div class="slot-filled">
        <span class="slot-name">${getShortName(player.name)}</span>
        <span class="slot-rate">${player.overall}</span>
      </div>`;
    slotEl.classList.add('filled');
  } else {
    const label = type === 'bench' 
      ? `Bench ${parseInt(slotEl.dataset.bench) + 1}` 
      : slotEl.dataset.pos;
    slotEl.innerHTML = `<span class="slot-pos">${label}</span>`;
    slotEl.classList.remove('filled');
  }
}

function getShortName(name) {
  const parts = name.split(' ');
  if (parts.length > 1 && parts[0].length <= 5) return parts.slice(-1)[0]; 
  return parts[0]; 
}

function updateCounter(team) {
  const teamObj = team === 'A' ? state.teamA : state.teamB;
  const benchObj = team === 'A' ? state.benchA : state.benchB;
  const count = Object.keys(teamObj).length + Object.keys(benchObj).length;
  const counterEl = document.querySelector(`#screen-draft-${team.toLowerCase()} .counter`);
  if (counterEl) counterEl.innerText = `${count} / 16 dipilih`;
}

function updateDraftStatus() {
  const btnA = document.querySelector(`#screen-draft-a .btn-primary`);
  const btnB = document.querySelector(`#screen-draft-b .btn-primary`);
  // Tombol A aktif kalau starter=11 DAN bench=5 (total 16)
  if (btnA) btnA.disabled = 
    Object.keys(state.teamA).length !== 11 || Object.keys(state.benchA).length !== 5;
  if (btnB) btnB.disabled = 
    Object.keys(state.teamB).length !== 11 || Object.keys(state.benchB).length !== 5;
}

// ============================================================
// PREVIEW & ENGINE MATCH
// ============================================================
function renderPreview() {
  const posOrder = { GK: 1, LB: 2, CB: 3, RB: 4, CDM: 5, CM: 6, LW: 7, ST: 8, RW: 9 };
  
  const renderTeam = (teamObj, benchObj, selector) => {
    const starters = Object.values(teamObj).sort((a, b) => posOrder[a.position] - posOrder[b.position]);
    const bench = Object.values(benchObj);
    
    let html = starters.map(p => 
      `<li>${p.name} <span class="li-rating">${p.overall}</span></li>`
    ).join('');
    
    if (bench.length > 0) {
      html += `<li class="bench-divider">🪑 Cadangan:</li>`;
      html += bench.map(p => 
        `<li class="bench-li">${p.name} <span class="li-rating">${p.overall}</span></li>`
      ).join('');
    }
    document.querySelector(selector).innerHTML = html;
  };

  renderTeam(state.teamA, state.benchA, '#screen-preview .preview-team.team-a .lineup-list');
  renderTeam(state.teamB, state.benchB, '#screen-preview .preview-team.team-b .lineup-list');
}

// --- ENGINE SIMULASI DENGAN RATING & MOTM ---
// ============================================================
// LIVE MATCH ANIMATION ENGINE
// ============================================================
function startMatch() {
  renderPreview();
  
  // 1. Hitung hasil pertandingan di belakang layar
  const result = simulateMatch(state.teamA, state.teamB);
  
  // 2. Masuk ke layar loading (Live Match)
  goTo('screen-loading');
  
  // 3. Jalankan animasi
  runLiveMatchAnimation(result);
}

// ============================================================
// TAHAP 6.3: LIVE FORMATION RENDERER
// ============================================================

// Helper: Render formasi awal ke lapangan kiri & kanan
function renderInitialFormation(team, teamName, formationId, benchId) {
  const formationEl = document.getElementById(formationId);
  const benchEl = document.getElementById(benchId);
  if (!formationEl || !benchEl) return;

  // Urutan posisi untuk 4-3-3: depan, tengah, belakang, GK
  const positions = [
    ['LW', 'ST', 'RW'],
    ['CM', 'CDM', 'CM'],
    ['LB', 'CB', 'CB', 'RB'],
    ['GK']
  ];

  const teamObj = teamName === 'A' ? state.teamA : state.teamB;
  const benchObj = teamName === 'A' ? state.benchA : state.benchB;

  // Kelompokkan pemain berdasarkan posisi
  const players = Object.values(teamObj);
  
  // Render baris formasi
  formationEl.innerHTML = positions.map(rowPositions => {
    const rowHtml = rowPositions.map(pos => {
      // Cari pemain dengan posisi ini yang belum dirender
      const player = players.find(p => p.position === pos && !p._rendered);
      if (player) {
        player._rendered = true; // Tandai agar tidak dobel
        return `
          <div class="live-player team-${teamName.toLowerCase()}-player" id="player-${player.id}" data-player-id="${player.id}">
            <div class="lp-name">${getShortName(player.name)}</div>
            <div class="lp-rating">${(player.overall / 10).toFixed(1)}</div>
          </div>
        `;
      }
      return `<div class="live-player empty"></div>`;
    }).join('');
    return `<div class="formation-row">${rowHtml}</div>`;
  }).join('');

  // Reset flag _rendered
  players.forEach(p => delete p._rendered);

  // Render bench
  const benchPlayers = Object.values(benchObj);
  benchEl.innerHTML = benchPlayers.map(p => `
    <div class="bench-player team-${teamName.toLowerCase()}-bench" id="bench-${p.id}" data-player-id="${p.id}">
      ${getShortName(p.name)}
    </div>
  `).join('');
}

// Helper: Cari elemen pemain di lapangan berdasarkan ID
function getPlayerEl(playerId) {
  return document.getElementById(`player-${playerId}`);
}

// Helper: Update ikon pemain (gol, assist, kartu, rating)
function updatePlayerIcons(playerId, updates) {
  const el = getPlayerEl(playerId);
  if (!el) return;

  // Update Rating
  if (updates.rating !== undefined) {
    const ratingEl = el.querySelector('.lp-rating');
    if (ratingEl) ratingEl.innerText = updates.rating.toFixed(1);
  }

  // Tambah Gol
  if (updates.goal) {
    el.classList.add('has-goal');
    if (!el.querySelector('.lp-icon.goal')) {
      const icon = document.createElement('div');
      icon.className = 'lp-icon goal';
      icon.innerText = '⚽';
      el.appendChild(icon);
    }
  }

  // Tambah Assist
  if (updates.assist) {
    if (!el.querySelector('.lp-icon.assist')) {
      const icon = document.createElement('div');
      icon.className = 'lp-icon assist';
      icon.innerText = '👟';
      el.appendChild(icon);
    }
  }

  // Tambah Kartu Kuning
  if (updates.yellow) {
    el.classList.add('has-yellow');
    let yellowIcon = el.querySelector('.lp-icon.yellow');
    if (!yellowIcon) {
      yellowIcon = document.createElement('div');
      yellowIcon.className = 'lp-icon yellow';
      el.appendChild(yellowIcon);
    }
    // Kalau sudah ada kartu kuning sebelumnya, jadi merah
    if (updates.isSecondYellow) {
      yellowIcon.innerText = '🟨🟥';
    } else {
      yellowIcon.innerText = '🟨';
    }
  }

  // Tambah Kartu Merah langsung
  if (updates.red) {
    el.classList.add('has-red');
    if (!el.querySelector('.lp-icon.yellow')) {
      const icon = document.createElement('div');
      icon.className = 'lp-icon yellow';
      icon.innerText = '🟥';
      el.appendChild(icon);
    } else {
      el.querySelector('.lp-icon.yellow').innerText = '🟨🟥';
    }
  }
}

// Helper: Animasi pergantian pemain
function animateSubstitution(teamName, outPlayerId, inPlayerId, newRating) {
  const outEl = getPlayerEl(outPlayerId);
  const benchInEl = document.getElementById(`bench-${inPlayerId}`);
  
  if (outEl) {
    // Animasi pemain keluar
    outEl.classList.add('swapping');
    setTimeout(() => {
      outEl.classList.remove('swapping');
      outEl.classList.add('empty');
      outEl.innerHTML = '';
    }, 400);
  }

  if (benchInEl) {
    // Animasi pemain dari bench
    benchInEl.classList.add('used');
  }

  // Delay untuk render pemain baru masuk
  setTimeout(() => {
    if (outEl) {
      // Cari data pemain baru
      const newPlayer = state.allPlayers.find(p => p.id === inPlayerId);
      if (newPlayer) {
        outEl.innerHTML = `
          <div class="lp-name">${getShortName(newPlayer.name)}</div>
          <div class="lp-rating">${(newRating).toFixed(1)}</div>
        `;
        outEl.classList.remove('empty', 'has-goal', 'has-yellow', 'has-red');
        outEl.classList.add('swapping');
        setTimeout(() => outEl.classList.remove('swapping'), 800);
      }
    }
  }, 500);
}

// ============================================================
// FUNGSI UTAMA: ANIMASI LIVE MATCH
// ============================================================
function runLiveMatchAnimation(result) {
  const clockEl = document.getElementById('live-clock');
  const scoreEl = document.getElementById('live-score');
  const tickerEl = document.getElementById('live-ticker');
  const progressEl = document.getElementById('match-progress');
  const ballEl = document.getElementById('mini-ball');

  clockEl.innerText = "0'";
  scoreEl.innerText = "0 - 0";
  const modeLabel = result.matchMode === 'dramatic' ? '🔥 MATCH DRAMATIC! ' 
                  : result.matchMode === 'highScoring' ? '⚡ HIGH SCORING MATCH! ' 
                  : '';
  tickerEl.innerHTML = `<div class="ticker-line event">${modeLabel}⚽ Kick-off! Pertandingan dimulai.</div>`;
  progressEl.style.width = "0%";
  if (ballEl) {
    ballEl.style.left = '50%';
    ballEl.style.top = '50%';
    ballEl.classList.remove('celebrate');
  }

  renderInitialFormation(state.teamA, 'A', 'formation-a', 'live-bench-a');
  renderInitialFormation(state.teamB, 'B', 'formation-b', 'live-bench-b');

  const totalDuration = 120000; // 2 menit
  const matchMinutes = 90;
  let currentMinute = 0;
  let scoreA = 0, scoreB = 0;

  const liveRatings = {};
  result.ratings.forEach(r => {
    liveRatings[r.player.id] = r.rating;
  });

  // 🆕 Map nama → player ID (untuk kartu merah & substitusi)
  const nameToPlayer = {};
  [...Object.values(state.teamA), ...Object.values(state.teamB)].forEach(p => {
    nameToPlayer[p.name] = p;
  });

  const events = [{ minute: 1, type: 'kickoff', text: '⚽ Kick-off! Pertandingan dimulai.' }];
  
  result.events.forEach(e => {
    if (e.type === 'goal') {
      events.push({
        minute: e.minute, type: 'goal', team: e.team,
        playerId: e.scorerId, assistId: e.assistId,
        text: `⚽ GOOOL! ${e.scorer} (Tim ${e.team}) menit ${e.minute}'!${e.assist ? ` Assist: ${e.assist}.` : ''}`
      });
    } else if (e.type === 'yellow') {
      events.push({ minute: e.minute, type: 'yellow', team: e.team, playerId: e.playerId, text: `🟨 Kartu Kuning! ${e.player} (Tim ${e.team}).` });
    } else if (e.type === 'red') {
      events.push({ 
        minute: e.minute, type: 'red', team: e.team, playerId: e.playerId, reason: e.reason,
        text: `🟥 KARTU MERAH! ${e.player} (Tim ${e.team})${e.reason ? ' - ' + e.reason : ''}! Tim bermain dengan 10 orang.` 
      });
    } else if (e.type === 'injury') {
      events.push({ minute: e.minute, type: 'injury', team: e.team, playerId: e.playerId, text: `🤕 Cedera! ${e.player} (Tim ${e.team}) harus ditarik keluar.` });
    } else if (e.type === 'sub') {
      events.push({ 
        minute: e.minute, type: 'sub', team: e.team, 
        outPlayer: e.outPlayer, inPlayer: e.inPlayer,
        text: `🔄 Substitusi (Tim ${e.team}): ${e.outPlayer} → ${e.inPlayer} (${e.reason}).`
      });
    } else if (e.type === 'shot') {
      events.push({ minute: e.minute, type: 'shot', team: e.team, text: `🎯 Tembakan! ${e.shooter} (Tim ${e.team}) ${e.onTarget ? 'mengarah ke gawang!' : 'melenceng.'}` });
    }
  });

  events.push({ minute: 45, type: 'event', text: "⏸️ Half-time! Pemain beristirahat." });
  events.push({ minute: 90, type: 'event', text: "🏁 Full-time! Pertandingan selesai." });

  events.sort((a, b) => a.minute - b.minute);
  let eventIndex = 0;
  const intervalTime = totalDuration / matchMinutes;

  const playerYellowCount = {};

  const animateBall = (type, team) => {
    if (!ballEl) return;
    if (type === 'goal') {
      const targetLeft = team === 'A' ? '88%' : '12%';
      ballEl.style.left = targetLeft;
      ballEl.classList.add('celebrate');
      setTimeout(() => {
        ballEl.classList.remove('celebrate');
        setTimeout(() => { ballEl.style.left = '50%'; }, 400);
      }, 800);
    } else if (type === 'shot') {
      const targetLeft = team === 'A' ? '75%' : '25%';
      ballEl.style.left = targetLeft;
      setTimeout(() => { ballEl.style.left = '50%'; }, 500);
    } else if (type === 'yellow' || type === 'red') {
      ballEl.style.left = '50%';
      ballEl.style.top = '30%';
      setTimeout(() => { ballEl.style.top = '50%'; }, 500);
    } else if (type === 'injury') {
      ballEl.style.left = '50%';
      ballEl.style.top = '70%';
      setTimeout(() => { ballEl.style.top = '50%'; }, 500);
    } else if (type === 'sub') {
      const targetLeft = team === 'A' ? '40%' : '60%';
      ballEl.style.left = targetLeft;
      setTimeout(() => { ballEl.style.left = '50%'; }, 400);
    }
  };

  const timer = setInterval(() => {
    currentMinute++;
    clockEl.innerText = `${currentMinute}'`;
    progressEl.style.width = `${(currentMinute / matchMinutes) * 100}%`;

    while (eventIndex < events.length && events[eventIndex].minute === currentMinute) {
      const ev = events[eventIndex];
      
      if (ev.type === 'goal') {
        if (ev.team === 'A') scoreA++;
        else scoreB++;
        scoreEl.innerText = `${scoreA} - ${scoreB}`;
        scoreEl.style.transform = "scale(1.2)";
        setTimeout(() => scoreEl.style.transform = "scale(1)", 200);

        if (ev.playerId) updatePlayerIcons(ev.playerId, { goal: true, rating: liveRatings[ev.playerId] || 7.0 });
        if (ev.assistId) updatePlayerIcons(ev.assistId, { assist: true, rating: liveRatings[ev.assistId] || 7.0 });
      }

      if (ev.type === 'yellow' && ev.playerId) {
        playerYellowCount[ev.playerId] = (playerYellowCount[ev.playerId] || 0) + 1;
        const isSecond = playerYellowCount[ev.playerId] >= 2;
        updatePlayerIcons(ev.playerId, { 
          yellow: true, isSecondYellow: isSecond,
          rating: liveRatings[ev.playerId] || 6.5 
        });
      }

      // 🆕 Kartu Merah → tampilkan X di slot, TIDAK ada substitusi
      if (ev.type === 'red' && ev.playerId) {
        const el = getPlayerEl(ev.playerId);
        if (el) {
          el.classList.add('has-red', 'red-flash');
          setTimeout(() => el.classList.remove('red-flash'), 800);
        }
      }

      if (ev.playerId && (ev.type === 'goal' || ev.type === 'yellow' || ev.type === 'injury')) {
        if (liveRatings[ev.playerId] !== undefined) {
          updatePlayerIcons(ev.playerId, { rating: liveRatings[ev.playerId] });
        }
      }

      if (ev.type === 'sub' && ev.outPlayer && ev.inPlayer) {
        const outPlayer = nameToPlayer[ev.outPlayer];
        const inPlayer = Object.values(state.benchA).concat(Object.values(state.benchB)).find(p => p.name === ev.inPlayer);
        
        if (outPlayer && inPlayer) {
          const newRating = liveRatings[inPlayer.id] || (inPlayer.overall / 10);
          animateSubstitution(ev.team, outPlayer.id, inPlayer.id, newRating);
        }
      }

      if (ev.team) animateBall(ev.type, ev.team);

      const line = document.createElement('div');
      line.className = `ticker-line ${ev.type}`;
      line.innerText = ev.text;
      tickerEl.appendChild(line);
      tickerEl.scrollTop = tickerEl.scrollHeight;
      eventIndex++;
    }

        if (currentMinute >= matchMinutes) {
      clearInterval(timer);
      
      // 🆕 Jangan auto-jump. Tampilkan tombol "Lihat Statistik"
      pendingResult = result;
      
      // Ubah jam jadi "FT" (Full-Time)
      clockEl.innerText = "FT";
      clockEl.classList.add('fulltime');
      
      // Tampilkan tombol setelah 800ms (efek dramatis)
      setTimeout(() => {
        const actionEl = document.getElementById('fulltime-action');
        if (actionEl) actionEl.classList.add('show');
        
        // Auto-scroll ke tombol
        actionEl?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 800);
    }
  }, intervalTime);
}

// 🆕 Fungsi untuk pindah ke screen Result saat tombol diklik
function goToResult() {
  if (!pendingResult) return;
  
  // Reset UI loading screen
  const clockEl = document.getElementById('live-clock');
  const actionEl = document.getElementById('fulltime-action');
  if (clockEl) {
    clockEl.innerText = "0'";
    clockEl.classList.remove('fulltime');
  }
  if (actionEl) actionEl.classList.remove('show');
  
  // Render & pindah
  renderResult(pendingResult);
  pendingResult = null; // Reset
  goTo('screen-result');
}

function simulateMatch(teamA, teamB) {
  const avgStat = (players, stat) => {
    if (players.length === 0) return 50;
    const sum = players.reduce((acc, p) => acc + p.stats[stat], 0);
    return sum / players.length;
  };
  
  const getByPos = (team, positions) => Object.values(team).filter(p => positions.includes(p.position));

  const a_mid = getByPos(teamA, ['CM', 'CDM']);
  const b_mid = getByPos(teamB, ['CM', 'CDM']);
  const a_att = getByPos(teamA, ['ST', 'LW', 'RW']);
  const b_att = getByPos(teamB, ['ST', 'LW', 'RW']);
  const a_def = getByPos(teamA, ['GK', 'LB', 'CB', 'RB']);
  const b_def = getByPos(teamB, ['GK', 'LB', 'CB', 'RB']);

  const a_midStrength = avgStat(a_mid, 'passing') + avgStat(a_mid, 'physical');
  const b_midStrength = avgStat(b_mid, 'passing') + avgStat(b_mid, 'physical');
  const a_attStrength = avgStat(a_att, 'shooting') + avgStat(a_att, 'dribbling');
  const b_attStrength = avgStat(b_att, 'shooting') + avgStat(b_att, 'dribbling');
  const a_defStrength = avgStat(a_def, 'defending') + avgStat(a_def, 'physical');
  const b_defStrength = avgStat(b_def, 'defending') + avgStat(b_def, 'physical');

  const modeRoll = Math.random();
  let matchMode = 'normal';
  let conversionBoost = 1.0;
  let extraEvents = 0;
  
  if (modeRoll > 0.90) {
    matchMode = 'dramatic'; conversionBoost = 2.0; extraEvents = 3;
  } else if (modeRoll > 0.70) {
    matchMode = 'highScoring'; conversionBoost = 1.5; extraEvents = 1;
  }
  
  console.log(`🎲 Match Mode: ${matchMode} (boost: ${conversionBoost}x)`);

  let a_poss = (a_midStrength / (a_midStrength + b_midStrength)) * 100;
  a_poss = Math.round(Math.min(70, Math.max(30, a_poss + (Math.random() * 6 - 3))));
  const b_poss = 100 - a_poss;

  let a_shots = Math.round((a_attStrength / b_defStrength) * 10 * (a_poss / 50) + (Math.random() * 5 - 2));
  let b_shots = Math.round((b_attStrength / a_defStrength) * 10 * (b_poss / 50) + (Math.random() * 5 - 2));
  a_shots = Math.max(2, a_shots); 
  b_shots = Math.max(2, b_shots);

  let a_onTarget = Math.min(a_shots, Math.round(a_shots * 0.45) + Math.floor(Math.random() * 3));
  let b_onTarget = Math.min(b_shots, Math.round(b_shots * 0.45) + Math.floor(Math.random() * 3));

  const calcXG = (att, shots, onTarget) => {
    const avgShooting = avgStat(att, 'shooting');
    const baseXGPerShot = (avgShooting / 100) * 0.18;
    let xg = 0;
    for (let i = 0; i < shots; i++) {
      const isOnTarget = i < onTarget;
      const shotQuality = isOnTarget ? baseXGPerShot * 1.5 : baseXGPerShot * 0.3;
      xg += shotQuality * (0.7 + Math.random() * 0.6) * conversionBoost;
    }
    return parseFloat(xg.toFixed(2));
  };

  const a_xG = calcXG(a_att, a_shots, a_onTarget);
  const b_xG = calcXG(b_att, b_shots, b_onTarget);

  const findReplacement = (benchPool, injuredPosition) => {
    if (benchPool.length === 0) return null;
    let idx = benchPool.findIndex(p => p.position === injuredPosition);
    if (idx === -1) {
      const positionGroups = {
        'GK': ['GK'], 'LB': ['LB', 'CB', 'RB'], 'CB': ['CB', 'LB', 'RB'], 'RB': ['RB', 'CB', 'LB'],
        'CDM': ['CDM', 'CM'], 'CM': ['CM', 'CDM'], 'LW': ['LW', 'RW', 'ST'],
        'RW': ['RW', 'LW', 'ST'], 'ST': ['ST', 'LW', 'RW']
      };
      const compatible = positionGroups[injuredPosition] || [injuredPosition];
      idx = benchPool.findIndex(p => compatible.includes(p.position));
    }
    if (idx === -1) idx = 0;
    return benchPool.splice(idx, 1)[0];
  };

  // 🆕 REFACTOR TOTAL: Urutan event diperbaiki
  // 1. Generate kartu merah & cedera DULU → dapat daftar pemain keluar + menitnya
  // 2. Baru generate gol, tapi filter pemain yang sudah keluar
  const processTeamEvents = (team, shotsOnTarget, opponentDef, teamName, xG, benchObj, boost) => {
    const allPlayers = Object.values(team);
    const scorerList = getByPos(team, ['ST', 'LW', 'RW', 'CM']);
    const assistList = getByPos(team, ['CM', 'CDM', 'RW', 'LW', 'LB', 'RB']);
    const cardCandidates = getByPos(team, ['CB', 'CDM', 'LB', 'RB']); 
    const allOutfield = allPlayers.filter(p => p.position !== 'GK');
    
    const events = [];
    const ratings = {};
    const removedPlayers = []; // { id, name, position, minute, reason }
    const yellowCards = {};
    let benchPool = [...Object.values(benchObj || {})];
    
    allPlayers.forEach(p => ratings[p.id] = p.overall / 10);

    const oppGK = opponentDef.find(p => p.position === 'GK');
    const saveRate = oppGK ? oppGK.realLife.saveRate : 0.75;

    // ========================================
    // STEP 1: GENERATE KARTU MERAH & CEDERA DULU
    // ========================================
    
    // Kartu Kuning (bisa berujung merah kalau 2)
    const yellowCandidates = cardCandidates.length > 0 ? cardCandidates : allOutfield;
    const yellowCount = Math.floor(Math.random() * 3); 
    for (let i = 0; i < yellowCount; i++) {
      const activePlayers = yellowCandidates.filter(p => !removedPlayers.find(r => r.id === p.id));
      if (activePlayers.length === 0) break;
      const player = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      const minute = Math.floor(Math.random() * 85) + 5;
      
      yellowCards[player.id] = (yellowCards[player.id] || 0) + 1;
      
      if (yellowCards[player.id] >= 2) {
        events.push({ minute, type: 'yellow', team: teamName, player: player.name, playerId: player.id });
        events.push({ minute: minute + 1, type: 'red', team: teamName, player: player.name, playerId: player.id, reason: '2 kartu kuning' });
        ratings[player.id] = Math.max(1.0, ratings[player.id] - 0.8);
        removedPlayers.push({ id: player.id, name: player.name, position: player.position, minute: minute + 1, reason: 'red' });
      } else {
        events.push({ minute, type: 'yellow', team: teamName, player: player.name, playerId: player.id });
        ratings[player.id] = Math.max(1.0, ratings[player.id] - 0.3);
      }
    }

    // Kartu Merah Langsung
    const redChance = matchMode === 'dramatic' ? 0.25 : 0.10;
    if (Math.random() < redChance && allOutfield.length > 0) {
      const activeOutfield = allOutfield.filter(p => !removedPlayers.find(r => r.id === p.id));
      if (activeOutfield.length > 0) {
        const player = activeOutfield[Math.floor(Math.random() * activeOutfield.length)];
        const minute = Math.floor(Math.random() * 75) + 15;
        
        events.push({ minute, type: 'red', team: teamName, player: player.name, playerId: player.id, reason: 'pelanggaran keras' });
        ratings[player.id] = Math.max(1.0, ratings[player.id] - 0.5);
        removedPlayers.push({ id: player.id, name: player.name, position: player.position, minute, reason: 'red' });
      }
    }

    // Cedera (BISA digantikan bench)
    if (Math.random() < 0.25 && allOutfield.length > 0) {
      const activeOutfield = allOutfield.filter(p => !removedPlayers.find(r => r.id === p.id));
      if (activeOutfield.length > 0) {
        const player = activeOutfield[Math.floor(Math.random() * activeOutfield.length)];
        const minute = Math.floor(Math.random() * 80) + 10;
        
        events.push({ minute, type: 'injury', team: teamName, player: player.name, playerId: player.id });
        ratings[player.id] = Math.max(1.0, ratings[player.id] - 0.2);
        removedPlayers.push({ id: player.id, name: player.name, position: player.position, minute, reason: 'injury' });

        const sub = findReplacement(benchPool, player.position);
        if (sub) {
          events.push({ minute: minute + 1, type: 'sub', team: teamName, inPlayer: sub.name, outPlayer: player.name, reason: 'cedera' });
          ratings[sub.id] = sub.overall / 10;
        }
      }
    }

    // ========================================
    // STEP 2: GENERATE GOL (filter pemain yang sudah keluar)
    // ========================================
    
    // Helper: cek apakah pemain masih aktif di menit tertentu
    const isPlayerActiveAt = (playerId, minute) => {
      const removed = removedPlayers.find(r => r.id === playerId);
      if (!removed) return true;
      return minute < removed.minute; // Aktif kalau sebelum menit keluar
    };

    const baseConversion = 0.15 + (avgStat(scorerList, 'shooting') - (saveRate * 100)) / 300;
    const conversionRate = Math.max(0.10, baseConversion) * boost;
    
    let totalGoals = 0;
    for(let i=0; i<shotsOnTarget; i++) {
       if (Math.random() < conversionRate) totalGoals++;
    }
    if (totalGoals === 0 && xG > 1.2 && Math.random() > 0.3) totalGoals = 1;
    if (totalGoals === 0 && matchMode === 'dramatic') {
      totalGoals = 1 + Math.floor(Math.random() * 2);
    }

    // Generate Gol dengan filter pemain aktif
    let attempts = 0;
    const maxAttempts = totalGoals * 10; // Hindari infinite loop
    while (events.filter(e => e.type === 'goal').length < totalGoals && attempts < maxAttempts) {
      attempts++;
      
      // Tentukan menit gol dulu
      let minute;
      if (matchMode === 'dramatic' && Math.random() < 0.4) {
        minute = Math.floor(Math.random() * 30) + 60;
      } else {
        minute = Math.floor(Math.random() * 90) + 1;
      }
      
      // Filter: pemain yang AKTIF di menit tersebut
      const activeScorers = scorerList.filter(p => isPlayerActiveAt(p.id, minute));
      if (activeScorers.length === 0) continue;
      
      const weighted = activeScorers.map(p => ({ p, weight: p.realLife.goalsPer90 + (p.position === 'ST' ? 0.2 : 0) }));
      const totalWeight = weighted.reduce((acc, obj) => acc + obj.weight, 0);
      let r = Math.random() * totalWeight;
      let selected = weighted[0].p;
      for (const obj of weighted) {
        if (r < obj.weight) { selected = obj.p; break; }
        r -= obj.weight;
      }

      // Pilih assist (filter juga)
      let assist = null;
      if (Math.random() < 0.7 && assistList.length > 0) {
        const activeAssists = assistList.filter(p => 
          p.id !== selected.id && isPlayerActiveAt(p.id, minute)
        );
        if (activeAssists.length > 0) {
          const aWeighted = activeAssists.map(p => ({ p, weight: p.realLife.assistsPer90 * 100 + p.stats.passing / 10 }));
          const aTotal = aWeighted.reduce((acc, obj) => acc + obj.weight, 0);
          let ar = Math.random() * aTotal;
          for (const obj of aWeighted) {
            if (ar < obj.weight) { assist = obj.p; break; }
            ar -= obj.weight;
          }
        }
      }

      events.push({
        minute, type: 'goal', team: teamName,
        scorer: selected.name, scorerId: selected.id,
        assist: assist ? assist.name : null, assistId: assist ? assist.id : null
      });

      ratings[selected.id] = Math.min(10.0, ratings[selected.id] + (0.5 + Math.random() * 0.5));
      if (assist) ratings[assist.id] = Math.min(10.0, ratings[assist.id] + (0.3 + Math.random() * 0.3));
    }

    // ========================================
    // STEP 3: GENERATE TEMBAKAN (filter juga)
    // ========================================
    const shotCount = Math.max(3, Math.floor(Math.random() * 6) + 3 + extraEvents);
    for (let i = 0; i < shotCount; i++) {
      const minute = Math.floor(Math.random() * 90) + 1;
      const activeOutfield = allOutfield.filter(p => isPlayerActiveAt(p.id, minute));
      if (activeOutfield.length === 0) break;
      const shooter = activeOutfield[Math.floor(Math.random() * activeOutfield.length)];
      events.push({
        minute, type: 'shot', team: teamName,
        shooter: shooter.name, onTarget: Math.random() > 0.5
      });
    }

    // Urutkan event berdasarkan menit
    events.sort((a, b) => a.minute - b.minute);

    // Kumpulkan pemain kartu merah untuk render
    const redCardedPlayers = removedPlayers
      .filter(r => r.reason === 'red')
      .map(r => ({ id: r.id, name: r.name, position: r.position, team: teamName }));

    return { events, ratings, redCardedPlayers };
  };

  const a_result = processTeamEvents(teamA, a_onTarget, b_def, 'A', a_xG, state.benchA, conversionBoost);
  const b_result = processTeamEvents(teamB, b_onTarget, a_def, 'B', b_xG, state.benchB, conversionBoost);

  const allEvents = [...a_result.events, ...b_result.events].sort((x, y) => x.minute - y.minute);
  const allGoals = allEvents.filter(e => e.type === 'goal');
  
  const scoreTimeline = [];
  let runningA = 0, runningB = 0;
  allGoals.forEach(g => {
    if (g.team === 'A') runningA++;
    else runningB++;
    scoreTimeline.push({ minute: g.minute, A: runningA, B: runningB, team: g.team });
  });

  let comeback = null;
  for (let i = 0; i < scoreTimeline.length; i++) {
    const st = scoreTimeline[i];
    const diff = st.A - st.B;
    if (st.team === 'B' && diff <= -2) comeback = { team: 'B', minute: st.minute };
    if (st.team === 'A' && diff >= 2) comeback = { team: 'A', minute: st.minute };
  }
  let comebackNote = null;
  const finalA = a_result.events.filter(e => e.type === 'goal').length;
  const finalB = b_result.events.filter(e => e.type === 'goal').length;
  if (comeback) {
    if (comeback.team === 'A' && finalA >= finalB && finalB >= 2) {
      comebackNote = `🔥 COMEBACK! Tim A bangkit dari ketertinggalan!`;
    } else if (comeback.team === 'B' && finalB >= finalA && finalA >= 2) {
      comebackNote = `🔥 COMEBACK! Tim B bangkit dari ketertinggalan!`;
    }
  }
  
  const allRatings = [];
  Object.keys(a_result.ratings).forEach(id => {
    const p = state.allPlayers.find(x => x.id === parseInt(id));
    if (p) allRatings.push({ player: p, rating: a_result.ratings[id] });
  });
  Object.keys(b_result.ratings).forEach(id => {
    const p = state.allPlayers.find(x => x.id === parseInt(id));
    if (p) allRatings.push({ player: p, rating: b_result.ratings[id] });
  });
  allRatings.sort((a, b) => b.rating - a.rating);

  const allRedCards = [...a_result.redCardedPlayers, ...b_result.redCardedPlayers];

  return {
    scoreA: finalA,
    scoreB: finalB,
    possession: { A: a_poss, B: b_poss },
    shots: { A: a_shots, B: b_shots },
    onTarget: { A: a_onTarget, B: b_onTarget },
    offTarget: { A: a_shots - a_onTarget, B: b_shots - b_onTarget },
    xG: { A: a_xG, B: b_xG },
    goals: allGoals,
    events: allEvents,
    ratings: allRatings,
    motm: allRatings[0],
    matchMode: matchMode,
    comeback: comebackNote,
    redCards: allRedCards
  };
}

// ============================================================
// RENDER HASIL (Termasuk MOTM & Rating)
// ============================================================
function renderResult(res) {
  document.querySelector('.score-number').innerText = `${res.scoreA} - ${res.scoreB}`;
    let resultText = res.scoreA === res.scoreB 
    ? "Pertandingan berakhir imbang." 
    : `Tim ${res.scoreA > res.scoreB ? 'A' : 'B'} memenangkan pertandingan!`;
  
  // 🆕 Tambah info mode & comeback
  if (res.comeback) {
    resultText = res.comeback;
  }
  const modeEmoji = res.matchMode === 'dramatic' ? '🔥 ' : res.matchMode === 'highScoring' ? '⚡ ' : '';
  document.querySelector('.result-note').innerText = modeEmoji + resultText;

  const statRows = document.querySelectorAll('.stats-box .stat-row');
  statRows[0].querySelector('.stat-val:first-child').innerText = `${res.possession.A}%`;
  statRows[0].querySelector('.stat-val:last-child').innerText = `${res.possession.B}%`;
  statRows[1].querySelector('.stat-val:first-child').innerText = res.shots.A;
  statRows[1].querySelector('.stat-val:last-child').innerText = res.shots.B;
  statRows[2].querySelector('.stat-val:first-child').innerText = res.onTarget.A;
  statRows[2].querySelector('.stat-val:last-child').innerText = res.onTarget.B;
  statRows[3].querySelector('.stat-val:first-child').innerText = res.offTarget.A;
  statRows[3].querySelector('.stat-val:last-child').innerText = res.offTarget.B;
  statRows[4].querySelector('.stat-val:first-child').innerText = res.xG.A.toFixed(2);
  statRows[4].querySelector('.stat-val:last-child').innerText = res.xG.B.toFixed(2);
  statRows[4].classList.add('xg');

  const timeline = document.querySelector('.timeline-list');
  if (res.events.length === 0) {
    timeline.innerHTML = `<li class="placeholder">Tidak ada kejadian berarti.</li>`;
  } else {
    timeline.innerHTML = res.events.map(e => {
      const teamBadge = `<span class="goal-team team-${e.team.toLowerCase()}">TIM ${e.team}</span>`;
      
      if (e.type === 'goal') {
        return `<li><span class="goal-min">${e.minute}'</span> ${teamBadge} ⚽ <strong>${e.scorer}</strong>${e.assist ? ` <span class="assist-text">(assist: ${e.assist})</span>` : ''}</li>`;
      }
      if (e.type === 'yellow') {
        return `<li class="yellow-card"><span class="goal-min">${e.minute}'</span> ${teamBadge} 🟨 <strong>${e.player}</strong></li>`;
      }
      if (e.type === 'red') {
        return `<li class="red-card"><span class="goal-min">${e.minute}'</span> ${teamBadge} 🟥 <strong>${e.player}</strong> <span style="color:#ef4444">(KELUAR)</span></li>`;
      }
      if (e.type === 'injury') {
        return `<li class="injury-event"><span class="goal-min">${e.minute}'</span> ${teamBadge} 🤕 <strong>${e.player}</strong> cedera</li>`;
      }
      if (e.type === 'sub') {
        return `<li class="sub-event"><span class="goal-min">${e.minute}'</span> ${teamBadge} 🔄 ${e.outPlayer} → <strong>${e.inPlayer}</strong> (${e.reason})</li>`;
      }
      return ''; // Sembunyikan shot
    }).join('');
  }

  const motmBox = document.getElementById('motm-box');
  motmBox.innerHTML = `
    <div class="motm-card">
      <div class="motm-title">🏆 Man of the Match</div>
      <div class="motm-name">${res.motm.player.name}</div>
      <div class="motm-rating">${res.motm.rating.toFixed(1)}</div>
    </div>
  `;

  const ratingList = document.getElementById('rating-list');
  ratingList.innerHTML = res.ratings.map(r => `
    <div class="rating-item">
      <span class="r-name">${r.player.name}</span>
      <span class="r-score ${r.player.position === 'GK' ? 'gk' : ''}">${r.rating.toFixed(1)}</span>
    </div>
  `).join('');
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  let idCounter = 0;
  document.querySelectorAll('.slot').forEach(slot => {
    slot.id = `slot-${idCounter++}`;
  });

  loadPlayers();
  setupSlotClick();
  console.log('✅ App loaded. Bench system ready.');
});