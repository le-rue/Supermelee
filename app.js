"use strict";

/* =========================================================
   STORAGE
   ========================================================= */
const STORAGE_KEY = "petanque_v1";

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Konnte gespeicherte Daten nicht lesen:", e);
  }
  return { players: [], tournament: null };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* =========================================================
   NAVIGATION
   ========================================================= */
const VIEWS = ["players", "setup", "round", "history", "standings", "summary"];
let currentView = "players";

const STEP_DEFS = [
  { key: "players", label: "Spieler" },
  { key: "setup", label: "Auswahl" },
  { key: "round1", label: "Runde 1" },
  { key: "round2", label: "Runde 2" },
  { key: "round3", label: "Runde 3" },
  { key: "finals", label: "Finale" },
];

function showView(view) {
  currentView = view;
  VIEWS.forEach((v) => {
    document.getElementById("view-" + v).classList.toggle("hidden", v !== view);
  });
  document.getElementById("drop-menu").classList.add("hidden");
  document.getElementById("btn-menu").setAttribute("aria-expanded", "false");
  renderTrack();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function currentStepKey() {
  const t = state.tournament;
  if (!t) return currentView === "setup" ? "setup" : "players";
  if (t.stage === "finals" || t.stage === "done") return "finals";
  if (t.stage === "standings" || t.stage === "round") {
    return "round" + t.roundIndex;
  }
  return "setup";
}

function renderTrack() {
  const track = document.getElementById("track");
  track.innerHTML = "";
  const activeKey = currentView === "players" ? "players"
    : currentView === "setup" ? "setup"
    : currentView === "round" ? "round" + (state.tournament ? state.tournament.roundIndex : 1)
    : currentView === "history" ? (state.tournament && (state.tournament.stage === "finals" || state.tournament.stage === "done") ? "finals" : "round" + (state.tournament ? state.tournament.roundIndex : 1))
    : currentView === "standings" ? "round" + (state.tournament ? state.tournament.roundIndex : 1)
    : currentView === "summary" ? "finals"
    : "players";

  const reachedIndex = STEP_DEFS.findIndex((s) => s.key === currentStepKey());

  STEP_DEFS.forEach((step, i) => {
    const wrap = document.createElement("div");
    wrap.className = "track-step";
    const isDone = i < reachedIndex || (i === reachedIndex && step.key !== activeKey);
    const isActive = step.key === activeKey;
    if (isDone) wrap.classList.add("done");
    if (isActive) wrap.classList.add("active");
    wrap.innerHTML = `<div class="track-dot">${isDone ? "✓" : i + 1}</div><span class="track-label">${step.label}</span>`;
    track.appendChild(wrap);
    if (i < STEP_DEFS.length - 1) {
      const line = document.createElement("div");
      line.className = "track-line";
      track.appendChild(line);
    }
  });
}

document.getElementById("btn-menu").addEventListener("click", () => {
  const menu = document.getElementById("drop-menu");
  const open = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !open);
  document.getElementById("btn-menu").setAttribute("aria-expanded", String(open));
});

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-nav");
    if (target === "round" && !state.tournament) return;
    if (target === "history" && !state.tournament) return;
    if (target === "standings" && (!state.tournament || !state.tournament.rounds.some((r) => r && r.locked))) return;
    if (target === "round") {
      // Während der Finalrunden führt "Aktuelle Runde" direkt zu den Finalrunden in der Rundenübersicht.
      if (state.tournament && (state.tournament.stage === "finals" || state.tournament.stage === "done")) {
        renderHistoryView(); showView("history"); return;
      }
      renderRoundView(); showView("round"); return;
    }
    if (target === "history") { renderHistoryView(); showView("history"); return; }
    if (target === "standings") { renderStandingsView(); showView("standings"); return; }
    if (target === "setup") { renderSetupView(); showView("setup"); return; }
    renderPlayersView();
    showView(target);
  });
});

document.getElementById("btn-reset-tournament").addEventListener("click", () => {
  if (!state.tournament) { document.getElementById("drop-menu").classList.add("hidden"); return; }
  if (!confirm("Aktuelles Turnier wirklich zurücksetzen? Alle Runden- und Ergebnisdaten dieses Turniers gehen verloren. Die Spielerdatenbank bleibt erhalten.")) return;
  state.tournament = null;
  saveState();
  renderSetupView();
  showView("setup");
});

/* =========================================================
   SPIELERVERWALTUNG
   ========================================================= */
function renderPlayersView() {
  const list = document.getElementById("player-list");
  list.innerHTML = "";
  const empty = document.getElementById("player-empty");
  empty.classList.toggle("hidden", state.players.length > 0);

  state.players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .forEach((p) => {
      const li = document.createElement("li");

      const nameWrap = document.createElement("span");
      nameWrap.className = "entity-name";
      const input = document.createElement("input");
      input.type = "text";
      input.value = p.name;
      input.maxLength = 40;
      input.addEventListener("change", () => {
        const val = input.value.trim();
        if (!val) { input.value = p.name; return; }
        p.name = val;
        saveState();
        renderPlayersView();
      });
      nameWrap.appendChild(input);

      const delBtn = document.createElement("button");
      delBtn.className = "icon-action danger";
      delBtn.setAttribute("aria-label", "Löschen");
      delBtn.innerHTML = trashIcon();
      delBtn.addEventListener("click", () => {
        if (!confirm(`"${p.name}" aus der Spielerdatenbank löschen?`)) return;
        state.players = state.players.filter((x) => x.id !== p.id);
        saveState();
        renderPlayersView();
      });

      li.appendChild(nameWrap);
      li.appendChild(delBtn);
      list.appendChild(li);
    });
}

function trashIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

document.getElementById("form-add-player").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("input-new-player");
  const name = input.value.trim();
  if (!name) return;
  state.players.push({ id: uid(), name });
  input.value = "";
  saveState();
  renderPlayersView();
  input.focus();
});

document.getElementById("btn-goto-setup").addEventListener("click", () => {
  renderSetupView();
  showView("setup");
});

/* =========================================================
   TURNIER-AUSWAHL (Setup)
   ========================================================= */
let setupSelection = new Set();

function renderSetupView() {
  const empty = document.getElementById("setup-empty");
  empty.classList.toggle("hidden", state.players.length > 0);

  if (state.tournament && state.tournament.stage) {
    // Turnier läuft bereits -> direkt zur Runde/Tabelle/Finale weiterleiten statt Setup zu zeigen
  }

  if (!state.tournament) {
    setupSelection = new Set(setupSelection); // keep prior picks if any
  } else {
    setupSelection = new Set(state.tournament.participantIds);
  }

  const list = document.getElementById("setup-list");
  list.innerHTML = "";
  state.players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .forEach((p) => {
      const li = document.createElement("li");
      li.className = "selectable";
      const selected = setupSelection.has(p.id);
      li.classList.toggle("selected", selected);
      li.innerHTML = `<span class="check-box"><svg viewBox="0 0 24 24"><path d="M4 12l6 6L20 6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="entity-name" style="cursor:pointer">${escapeHtml(p.name)}</span>`;
      li.addEventListener("click", () => {
        if (state.tournament) return; // Auswahl nach Start nicht mehr über diese Ansicht änderbar
        if (setupSelection.has(p.id)) setupSelection.delete(p.id);
        else setupSelection.add(p.id);
        renderSetupView();
      });
      list.appendChild(li);
    });

  document.getElementById("setup-count").textContent = setupSelection.size;
  const startBtn = document.getElementById("btn-start-tournament");
  startBtn.disabled = setupSelection.size < 4;
  startBtn.textContent = state.tournament
    ? "Turnier läuft bereits — zur aktuellen Runde →"
    : "Turnier starten – Runde 1 auslosen →";
}

document.getElementById("btn-start-tournament").addEventListener("click", () => {
  if (state.tournament) {
    renderRoundView();
    showView("round");
    return;
  }
  if (setupSelection.size < 4) return;

  state.tournament = {
    participantIds: Array.from(setupSelection),
    roundIndex: 1,
    stage: "round",
    rounds: [],
    finals: null,
  };
  saveState();
  renderRoundView();
  showView("round");
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Baut die Kartenzeile eines Spiels: Namen außen in Kästchen, Ergebnis mittig.
 * readonly=true → reines Anzeige-Ergebnis (Text); sonst editierbare Score-Inputs.
 */
function matchRowHTML({ teamANames, teamBNames, matchId = null, scoreA = null, scoreB = null, locked = false, readonly = false }) {
  const chipsA = teamANames.map((n) => `<div class="chip">${n}</div>`).join("");
  const chipsB = teamBNames.map((n) => `<div class="chip">${n}</div>`).join("");
  let mid;
  if (readonly) {
    if (scoreA !== null && scoreB !== null) {
      mid = `<div class="score-mid readonly"><span>${scoreA}</span><span class="score-sep">:</span><span>${scoreB}</span></div>`;
    } else {
      mid = `<div class="score-mid readonly muted"><em>offen</em></div>`;
    }
  } else {
    mid = `<div class="score-mid">
      <input type="number" min="0" max="13" class="team-score" data-match="${matchId}" data-side="A" value="${scoreA ?? ""}" ${locked ? "disabled" : ""}/>
      <span class="score-sep">:</span>
      <input type="number" min="0" max="13" class="team-score" data-match="${matchId}" data-side="B" value="${scoreB ?? ""}" ${locked ? "disabled" : ""}/>
    </div>`;
  }
  return `<div class="match-row">
    <div class="team-chips">${chipsA}</div>
    ${mid}
    <div class="team-chips">${chipsB}</div>
  </div>`;
}

/* =========================================================
   TEAM-AUSLOSUNG
   ========================================================= */

// Prüft, welche Spielerzahlen sich aus Blöcken zu 4 (2v2), 5 (2v3) und 6 (3v3) zusammensetzen lassen.
function buildReachableTable(maxN) {
  const can = new Array(maxN + 1).fill(false);
  can[0] = true;
  for (let n = 1; n <= maxN; n++) {
    can[n] =
      (n >= 4 && can[n - 4]) ||
      (n >= 5 && can[n - 5]) ||
      (n >= 6 && can[n - 6]);
  }
  return can;
}

function partitionSizes(n, can) {
  const parts = [];
  let rest = n;
  while (rest > 0) {
    if (rest >= 4 && can[rest - 4]) { parts.push(4); rest -= 4; }
    else if (rest >= 6 && can[rest - 6]) { parts.push(6); rest -= 6; }
    else if (rest >= 5 && can[rest - 5]) { parts.push(5); rest -= 5; }
    else break; // sollte dank buildReachableTable + Bye-Reduktion nicht vorkommen
  }
  return parts;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Lost eine Runde aus: liefert { matches:[{teamA,teamB,format}], byes:[playerId] }
 */
function drawRound(playerIds) {
  const shuffled = shuffle(playerIds);
  let pool = shuffled.slice();
  const byes = [];

  const can = buildReachableTable(pool.length);
  while (pool.length > 0 && !can[pool.length]) {
    byes.push(pool.pop());
  }

  const parts = pool.length > 0 ? partitionSizes(pool.length, buildReachableTable(pool.length)) : [];

  const matches = [];
  let cursor = 0;
  for (const size of parts) {
    const group = pool.slice(cursor, cursor + size);
    cursor += size;
    let sizeA, format;
    if (size === 4) { sizeA = 2; format = "Doublette"; }
    else if (size === 6) { sizeA = 3; format = "Triplette"; }
    else { sizeA = Math.random() < 0.5 ? 2 : 3; format = "Gemischt 2:3"; }
    const teamA = group.slice(0, sizeA);
    const teamB = group.slice(sizeA);
    matches.push({ id: uid(), teamA, teamB, scoreA: null, scoreB: null, format });
  }
  return { matches, byes };
}

/* =========================================================
   RUNDEN-ANSICHT
   ========================================================= */
function activeRound() {
  const t = state.tournament;
  if (!t) return null;
  return t.rounds[t.roundIndex - 1] || null;
}

function playerName(id) {
  const p = state.players.find((x) => x.id === id);
  return p ? p.name : "?";
}

function renderRoundView() {
  const t = state.tournament;
  if (!t) return;
  const round = activeRound();

  document.getElementById("round-title").textContent = "Runde " + t.roundIndex + " von 3";

  const poolEditor = document.getElementById("round-pool-editor");
  const matchesWrap = document.getElementById("round-matches-wrap");

  if (!round) {
    // Runde noch nicht ausgelost -> Pool bearbeiten
    poolEditor.classList.remove("hidden");
    matchesWrap.classList.add("hidden");

    const hintText = t.roundIndex === 1
      ? "Das sind die für das Turnier ausgewählten Spieler:innen. Auslosung startet Doublette-, Triplette- oder gemischte Teams, je nach Anzahl."
      : "Vor der Auslosung können Spieler:innen ergänzt oder gestrichen werden.";
    document.getElementById("round-hint").textContent = hintText;

    renderPoolEditor();
  } else {
    poolEditor.classList.add("hidden");
    matchesWrap.classList.remove("hidden");
    document.getElementById("round-hint").textContent = round.locked
      ? "Diese Runde ist abgeschlossen."
      : "Trage nach den Spielen die Ergebnisse ein (Punkte je Team).";
    renderMatches(round);
  }
}

function renderPoolEditor() {
  const t = state.tournament;
  const list = document.getElementById("round-pool-list");
  list.innerHTML = "";

  t.participantIds.forEach((id) => {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.className = "entity-name";
    nameSpan.textContent = playerName(id);
    li.appendChild(nameSpan);

    const rmBtn = document.createElement("button");
    rmBtn.className = "icon-action danger";
    rmBtn.setAttribute("aria-label", "Aus Runde entfernen");
    rmBtn.innerHTML = trashIcon();
    rmBtn.addEventListener("click", () => {
      t.participantIds = t.participantIds.filter((x) => x !== id);
      saveState();
      renderPoolEditor();
    });
    li.appendChild(rmBtn);
    list.appendChild(li);
  });

  document.getElementById("pool-count").textContent = t.participantIds.length;

  const select = document.getElementById("select-add-player");
  select.innerHTML = "";
  const available = state.players.filter((p) => !t.participantIds.includes(p.id));
  if (available.length === 0) {
    select.innerHTML = `<option value="">Alle Spieler:innen sind bereits dabei</option>`;
    select.disabled = true;
  } else {
    select.disabled = false;
    select.innerHTML = `<option value="">Spieler:in wählen…</option>` +
      available
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "de"))
        .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
        .join("");
  }

  document.getElementById("btn-draw-round").disabled = t.participantIds.length < 4;
}

document.getElementById("btn-add-to-pool").addEventListener("click", () => {
  const select = document.getElementById("select-add-player");
  const id = select.value;
  if (!id) return;
  const t = state.tournament;
  if (!t.participantIds.includes(id)) t.participantIds.push(id);
  saveState();
  renderPoolEditor();
});

document.getElementById("btn-draw-round").addEventListener("click", () => {
  const t = state.tournament;
  if (t.participantIds.length < 4) return;
  const { matches, byes } = drawRound(t.participantIds);
  t.rounds[t.roundIndex - 1] = {
    number: t.roundIndex,
    matches,
    byes,
    locked: false,
  };
  saveState();
  renderRoundView();
});

document.getElementById("btn-redraw").addEventListener("click", () => {
  const t = state.tournament;
  const { matches, byes } = drawRound(t.participantIds);
  t.rounds[t.roundIndex - 1] = { number: t.roundIndex, matches, byes, locked: false };
  saveState();
  renderRoundView();
});

function renderMatches(round) {
  const wrap = document.getElementById("round-matches");
  wrap.innerHTML = "";

  const byeNote = document.getElementById("bye-note");
  if (round.byes && round.byes.length) {
    byeNote.classList.remove("hidden");
    byeNote.textContent = "Pausiert diese Runde: " + round.byes.map(playerName).join(", ");
  } else {
    byeNote.classList.add("hidden");
  }

  round.matches.forEach((m) => {
    const card = document.createElement("div");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-format">${m.format}</div>
      ${matchRowHTML({
        teamANames: m.teamA.map((id) => escapeHtml(playerName(id))),
        teamBNames: m.teamB.map((id) => escapeHtml(playerName(id))),
        matchId: m.id,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        locked: round.locked,
        readonly: false,
      })}
    `;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll(".team-score").forEach((input) => {
    input.addEventListener("change", () => {
      const matchId = input.getAttribute("data-match");
      const side = input.getAttribute("data-side");
      const match = round.matches.find((x) => x.id === matchId);
      const val = input.value === "" ? null : Math.max(0, parseInt(input.value, 10) || 0);
      if (side === "A") match.scoreA = val; else match.scoreB = val;
      saveState();
    });
  });

  document.getElementById("btn-redraw").classList.toggle("hidden", round.locked);
  document.getElementById("btn-finish-round").classList.toggle("hidden", round.locked);
  document.getElementById("round-error").classList.add("hidden");

  // Nach Abschluss: ein einziger Link direkt zur nächsten Runde bzw. den Finalrunden
  // (die Tabelle bleibt jederzeit über das Menü erreichbar).
  let cta = document.getElementById("round-locked-cta");
  if (round.locked) {
    if (!cta) {
      cta = document.createElement("button");
      cta.id = "round-locked-cta";
      cta.className = "btn primary large";
      document.getElementById("round-actions").appendChild(cta);
    }
    const t = state.tournament;
    const isFinal = t.roundIndex >= 3;
    cta.textContent = isFinal ? "Weiter zu den Finalrunden →" : "Weiter zu Runde " + (t.roundIndex + 1) + " →";
    cta.onclick = goToNextStage;
  } else if (cta) {
    cta.remove();
  }
}

function goToNextStage() {
  const t = state.tournament;
  const isFinal = t.roundIndex >= 3;
  if (isFinal) {
    t.stage = "finals";
    if (!t.finals) t.finals = { grosse: null, kleine: null };
    saveState();
    renderHistoryView();
    showView("history");
  } else {
    t.roundIndex++;
    t.stage = "round";
    saveState();
    renderRoundView();
    showView("round");
  }
}

document.getElementById("btn-finish-round").addEventListener("click", () => {
  const t = state.tournament;
  const round = activeRound();
  const errorEl = document.getElementById("round-error");

  const incomplete = round.matches.some((m) => m.scoreA === null || m.scoreB === null);
  if (incomplete) {
    errorEl.textContent = "Bitte für alle Spiele beide Ergebnisse eintragen.";
    errorEl.classList.remove("hidden");
    return;
  }
  const tied = round.matches.some((m) => m.scoreA === m.scoreB);
  if (tied) {
    errorEl.textContent = "Unentschieden ist bei Pétanque nicht vorgesehen — bitte Ergebnis korrigieren.";
    errorEl.classList.remove("hidden");
    return;
  }
  errorEl.classList.add("hidden");
  round.locked = true;
  saveState();
  renderRoundView();
});

/* =========================================================
   RUNDENÜBERSICHT (alle Runden: Ansetzungen & Ergebnisse)
   ========================================================= */
function renderHistoryView() {
  const t = state.tournament;
  if (!t) return;
  const wrap = document.getElementById("history-content");
  wrap.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const roundNum = i + 1;
    const round = t.rounds[i];
    let statusLabel, statusClass;
    if (round && round.locked) { statusLabel = "Abgeschlossen"; statusClass = "status-done"; }
    else if (round) { statusLabel = "Ausgelost – Ergebnisse ausstehend"; statusClass = "status-pending"; }
    else if (roundNum === t.roundIndex) { statusLabel = "Wird vorbereitet"; statusClass = "status-pending"; }
    else { statusLabel = "Noch nicht gestartet"; statusClass = "status-future"; }

    let inner = "";
    if (round) {
      inner = round.matches.map((m) => {
        return `<div class="history-match">
          <div class="hm-format">${escapeHtml(m.format)}</div>
          ${matchRowHTML({
            teamANames: m.teamA.map((id) => escapeHtml(playerName(id))),
            teamBNames: m.teamB.map((id) => escapeHtml(playerName(id))),
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            readonly: true,
          })}
        </div>`;
      }).join("");
      if (round.byes && round.byes.length) {
        inner += `<div class="history-byes">Pause: ${round.byes.map((id) => escapeHtml(playerName(id))).join(", ")}</div>`;
      }
    } else {
      inner = `<p class="final-note">–</p>`;
    }

    const block = document.createElement("div");
    block.className = "history-round";
    block.innerHTML = `<div class="history-round-head"><h3>Runde ${roundNum}</h3><span class="status-pill ${statusClass}">${statusLabel}</span></div>${inner}`;
    wrap.appendChild(block);
  }

  // Finalrunden sind Teil dieser Übersicht, sobald Runde 3 abgeschlossen ist.
  const finalsWrap = document.getElementById("history-finals-wrap");
  const finalsReachable = t.roundIndex >= 3 && t.rounds[2] && t.rounds[2].locked;
  finalsWrap.classList.toggle("hidden", !finalsReachable);
  if (finalsReachable) {
    if (!t.finals) t.finals = { grosse: null, kleine: null };
    renderFinalsView();
  }
}

/* =========================================================
   TURNIER TEILEN (read-only Link, ohne Server)
   ========================================================= */
function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str)));
}

function buildFinalSnapshot(f) {
  if (!f) return null;
  return {
    format: f.format,
    teamA: f.teamA.map(playerName),
    teamB: f.teamB.map(playerName),
    ranksA: f.ranksA,
    ranksB: f.ranksB,
    scoreA: f.scoreA,
    scoreB: f.scoreB,
    done: f.done,
  };
}

function buildShareSnapshot() {
  const t = state.tournament;
  return {
    app: "Süpermeleé",
    generated: new Date().toISOString(),
    rounds: [0, 1, 2].map((i) => {
      const r = t.rounds[i];
      if (!r) return { number: i + 1, started: false };
      return {
        number: i + 1,
        started: true,
        locked: r.locked,
        byes: (r.byes || []).map(playerName),
        matches: r.matches.map((m) => ({
          format: m.format,
          teamA: m.teamA.map(playerName),
          teamB: m.teamB.map(playerName),
          scoreA: m.scoreA,
          scoreB: m.scoreB,
        })),
      };
    }),
    standings: computeStandings().map((s) => ({
      name: s.name, wins: s.wins, played: s.played, pf: s.pf, pa: s.pa, diff: s.diff,
    })),
    finals: t.finals ? {
      grosse: buildFinalSnapshot(t.finals.grosse),
      kleine: buildFinalSnapshot(t.finals.kleine),
    } : null,
  };
}

function buildShareLink() {
  const snap = buildShareSnapshot();
  const encoded = b64EncodeUnicode(JSON.stringify(snap));
  const base = location.origin + location.pathname;
  return base + "#share=" + encoded;
}

function openShareModal(link) {
  const old = document.getElementById("share-overlay");
  if (old) old.remove();
  const overlay = document.createElement("div");
  overlay.id = "share-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Turnier teilen</h3>
      <p class="hint">Dieser Link zeigt den aktuellen Stand (Ansetzungen, Ergebnisse, Tabelle, Finalrunden) – nur lesbar, ohne Anmeldung. Bei neuen Ergebnissen einfach erneut teilen.</p>
      <textarea readonly class="share-textarea" id="share-link-text">${link}</textarea>
      <div class="modal-actions">
        <button class="btn secondary" id="btn-copy-link">Link kopieren</button>
        <button class="btn ghost" id="btn-close-modal">Schließen</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById("btn-close-modal").addEventListener("click", () => overlay.remove());
  document.getElementById("btn-copy-link").addEventListener("click", async () => {
    const textarea = document.getElementById("share-link-text");
    const btn = document.getElementById("btn-copy-link");
    try {
      await navigator.clipboard.writeText(link);
      btn.textContent = "Kopiert ✓";
    } catch (e) {
      textarea.select();
      btn.textContent = "Bitte manuell kopieren";
    }
  });
}

document.getElementById("btn-share").addEventListener("click", () => {
  document.getElementById("drop-menu").classList.add("hidden");
  triggerShare();
});
document.getElementById("btn-share-history").addEventListener("click", triggerShare);

function triggerShare() {
  if (!state.tournament) { alert("Es läuft noch kein Turnier."); return; }
  const link = buildShareLink();
  if (navigator.share) {
    navigator.share({ title: "Süpermeleé Turnier", text: "Aktueller Turnierstand", url: link }).catch(() => openShareModal(link));
  } else {
    openShareModal(link);
  }
}

function renderSharedReportFromHash() {
  const hash = location.hash;
  if (!hash.startsWith("#share=")) return false;
  let data;
  try {
    const encoded = decodeURIComponent(hash.slice("#share=".length));
    data = JSON.parse(b64DecodeUnicode(encoded));
  } catch (e) {
    console.warn("Konnte geteilte Daten nicht lesen:", e);
    return false;
  }

  document.getElementById("track").classList.add("hidden");
  document.getElementById("btn-menu").classList.add("hidden");
  VIEWS.forEach((v) => document.getElementById("view-" + v).classList.add("hidden"));
  document.getElementById("view-shared").classList.remove("hidden");

  let html = `<div class="shared-banner">🔗 Geteilte Ansicht von <strong>Süpermeleé</strong> – nur lesbar. Stand: ${escapeHtml(new Date(data.generated).toLocaleString("de-DE"))}</div>`;

  html += `<h2 class="view-head-inline">Runden</h2>`;
  data.rounds.forEach((r) => {
    html += `<div class="history-round"><div class="history-round-head"><h3>Runde ${r.number}</h3></div>`;
    if (!r.started) {
      html += `<p class="final-note">Noch nicht gestartet</p>`;
    } else {
      r.matches.forEach((m) => {
        html += `<div class="history-match">
          <div class="hm-format">${escapeHtml(m.format)}</div>
          ${matchRowHTML({
            teamANames: m.teamA.map(escapeHtml),
            teamBNames: m.teamB.map(escapeHtml),
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            readonly: true,
          })}
        </div>`;
      });
      if (r.byes && r.byes.length) html += `<div class="history-byes">Pause: ${r.byes.map(escapeHtml).join(", ")}</div>`;
    }
    html += `</div>`;
  });

  html += `<h2 class="view-head-inline">Tabelle</h2>`;
  html += `<div class="table-wrap"><table class="standings-table"><thead><tr><th class="c-rank">#</th><th class="c-name">Name</th><th class="c-num">S</th><th class="c-num">Sp</th><th class="c-num">Punkte</th><th class="c-num">Diff</th></tr></thead><tbody>`;
  data.standings.forEach((s, i) => {
    const diffClass = s.diff > 0 ? "diff-pos" : s.diff < 0 ? "diff-neg" : "";
    html += `<tr><td class="c-rank">${i + 1}</td><td class="c-name">${escapeHtml(s.name)}</td><td class="c-num">${s.wins}</td><td class="c-num">${s.played}</td><td class="c-num">${s.pf}:${s.pa}</td><td class="c-num ${diffClass}">${s.diff > 0 ? "+" : ""}${s.diff}</td></tr>`;
  });
  html += `</tbody></table></div>`;

  if (data.finals) {
    html += `<h2 class="view-head-inline">Finalrunden</h2><div class="finals-grid">`;
    [["grosse", "🏆 Großes Finale"], ["kleine", "🥈 Kleines Finale"]].forEach(([key, title]) => {
      const f = data.finals[key];
      html += `<div class="final-card"><h3>${title}</h3>`;
      if (!f) {
        html += `<p class="final-note">Nicht ausgetragen.</p>`;
      } else {
        html += matchRowHTML({
          teamANames: f.teamA.map(escapeHtml),
          teamBNames: f.teamB.map(escapeHtml),
          scoreA: f.done ? f.scoreA : null,
          scoreB: f.done ? f.scoreB : null,
          readonly: true,
        });
        html += `<div class="finals-ranks-row"><span>Platz ${f.ranksA.join(", ")}</span><span>Platz ${f.ranksB.join(", ")}</span></div>`;
        if (f.done) {
          const winnerIsA = f.scoreA > f.scoreB;
          const winners = (winnerIsA ? f.teamA : f.teamB).map(escapeHtml).join(" &amp; ");
          html += `<div class="final-result">Sieger: ${winners} (${f.scoreA}:${f.scoreB})</div>`;
        } else {
          html += `<p class="final-note">Ergebnis steht noch aus.</p>`;
        }
      }
      html += `</div>`;
    });
    html += `</div>`;
  }

  document.getElementById("shared-content").innerHTML = html;
  return true;
}

/* =========================================================
   TABELLE
   ========================================================= */
function computeStandings() {
  const t = state.tournament;
  const stats = {};

  function ensure(id) {
    if (!stats[id]) stats[id] = { id, wins: 0, played: 0, pf: 0, pa: 0 };
    return stats[id];
  }

  (t.participantIds || []).forEach(ensure);

  t.rounds.forEach((round) => {
    if (!round || !round.locked) return;
    round.matches.forEach((m) => {
      const aWon = m.scoreA > m.scoreB;
      m.teamA.forEach((id) => {
        const s = ensure(id);
        s.played++; s.pf += m.scoreA; s.pa += m.scoreB;
        if (aWon) s.wins++;
      });
      m.teamB.forEach((id) => {
        const s = ensure(id);
        s.played++; s.pf += m.scoreB; s.pa += m.scoreA;
        if (!aWon) s.wins++;
      });
    });
  });

  const list = Object.values(stats).map((s) => ({
    ...s,
    diff: s.pf - s.pa,
    name: playerName(s.id),
  }));

  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return a.name.localeCompare(b.name, "de");
  });

  return list;
}

function renderStandingsView() {
  const t = state.tournament;
  const isFinal = t.roundIndex >= 3 && t.rounds[2] && t.rounds[2].locked;
  document.getElementById("standings-title").textContent = isFinal
    ? "Endtabelle nach 3 Runden"
    : "Zwischenstand nach Runde " + t.roundIndex;

  const standings = computeStandings();
  const body = document.getElementById("standings-body");
  body.innerHTML = "";
  standings.forEach((s, i) => {
    const tr = document.createElement("tr");
    const diffClass = s.diff > 0 ? "diff-pos" : s.diff < 0 ? "diff-neg" : "";
    tr.innerHTML = `
      <td class="c-rank">${i + 1}</td>
      <td class="c-name">${escapeHtml(s.name)}</td>
      <td class="c-num">${s.wins}</td>
      <td class="c-num">${s.played}</td>
      <td class="c-num">${s.pf}:${s.pa}</td>
      <td class="c-num ${diffClass}">${s.diff > 0 ? "+" : ""}${s.diff}</td>
    `;
    body.appendChild(tr);
  });

  const continueBtn = document.getElementById("btn-standings-continue");
  continueBtn.textContent = isFinal ? "Weiter zu den Finalrunden →" : "Weiter zu Runde " + (t.roundIndex + 1) + " →";
  continueBtn.onclick = goToNextStage;
}

/* =========================================================
   FINALRUNDEN
   ========================================================= */
function finalGroupSize(format) {
  return format === "triplette" ? 6 : 4;
}

function renderFinalsView() {
  const t = state.tournament;
  if (!t.finals) t.finals = { grosse: null, kleine: null };
  renderFinalCard("grosse", 0);
  updateSummaryButton();
}

function renderFinalCard(key, offset) {
  const t = state.tournament;
  const card = document.querySelector(`.final-card[data-final="${key}"]`);
  const body = card.querySelector(".final-body");
  const existing = t.finals[key];

  // Radiobuttons an vorhandenen Stand anpassen
  if (existing && existing.format) {
    card.querySelectorAll(`input[name="format-${key}"]`).forEach((r) => {
      r.checked = r.value === existing.format;
      r.disabled = existing.done;
    });
  }

  body.innerHTML = "";

  const standings = computeStandings();

  if (!existing) {
    const needed = finalGroupSize(getSelectedFormat(key));
    if (standings.length < offset + needed) {
      body.innerHTML = `<p class="final-note">Nicht genügend Spieler:innen für dieses Format (${needed} benötigt, ${Math.max(0, standings.length - offset)} verfügbar). Bitte anderes Format wählen.</p>`;
    } else {
      body.innerHTML = `<p class="final-note">Format wählen und „Teams bilden" klicken.</p>`;
    }
    return;
  }

  const ranksA = existing.ranksA.join(", ");
  const ranksB = existing.ranksB.join(", ");

  body.innerHTML = `
    <div class="match-row">
      <div class="team-chips">
        ${existing.teamA.map((id) => `<div class="chip">${escapeHtml(playerName(id))}</div>`).join("")}
        <div class="final-ranks">Platz ${ranksA}</div>
      </div>
      <div class="score-mid">
        <input type="number" min="0" max="13" class="team-score" id="score-${key}-A" value="${existing.scoreA ?? ""}" ${existing.done ? "disabled" : ""}/>
        <span class="score-sep">:</span>
        <input type="number" min="0" max="13" class="team-score" id="score-${key}-B" value="${existing.scoreB ?? ""}" ${existing.done ? "disabled" : ""}/>
      </div>
      <div class="team-chips">
        ${existing.teamB.map((id) => `<div class="chip">${escapeHtml(playerName(id))}</div>`).join("")}
        <div class="final-ranks">Platz ${ranksB}</div>
      </div>
    </div>
  `;

  if (!existing.done) {
    const submitBtn = document.createElement("button");
    submitBtn.className = "btn primary";
    submitBtn.style.marginTop = "12px";
    submitBtn.textContent = "Ergebnis eintragen";
    submitBtn.addEventListener("click", () => {
      const a = parseInt(document.getElementById(`score-${key}-A`).value, 10);
      const b = parseInt(document.getElementById(`score-${key}-B`).value, 10);
      if (isNaN(a) || isNaN(b)) { alert("Bitte beide Ergebnisse eintragen."); return; }
      if (a === b) { alert("Unentschieden ist bei Pétanque nicht vorgesehen."); return; }
      existing.scoreA = a;
      existing.scoreB = b;
      existing.done = true;
      saveState();
      renderFinalCard(key, offset);
      if (key === "grosse") renderFinalCard("kleine", finalGroupSize(existing.format));
      updateSummaryButton();
    });
    body.appendChild(submitBtn);

    const redoBtn = document.createElement("button");
    redoBtn.className = "btn ghost small";
    redoBtn.style.marginLeft = "8px";
    redoBtn.style.marginTop = "12px";
    redoBtn.textContent = "Neu auslosen";
    redoBtn.addEventListener("click", () => {
      t.finals[key] = null;
      saveState();
      renderFinalCard(key, offset);
      if (key === "grosse") { t.finals.kleine = null; renderFinalCard("kleine", 0); }
      updateSummaryButton();
    });
    body.appendChild(redoBtn);
  } else {
    const winnerIsA = existing.scoreA > existing.scoreB;
    const winnerNames = (winnerIsA ? existing.teamA : existing.teamB).map(playerName).join(" & ");
    const result = document.createElement("div");
    result.className = "final-result";
    result.textContent = `Sieger: ${winnerNames}`;
    body.appendChild(result);
  }
}

function getSelectedFormat(key) {
  const checked = document.querySelector(`input[name="format-${key}"]:checked`);
  return checked ? checked.value : "doublette";
}

document.querySelectorAll('[data-form-teams]').forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-form-teams");
    const t = state.tournament;
    const format = getSelectedFormat(key);
    const size = finalGroupSize(format);

    const offset = key === "kleine"
      ? (t.finals.grosse ? finalGroupSize(t.finals.grosse.format) : null)
      : 0;

    if (offset === null) {
      alert('Bitte zuerst die Teams für das "Großes Finale" bilden.');
      return;
    }

    const standings = computeStandings();
    if (standings.length < offset + size) {
      alert(`Nicht genügend Spieler:innen für dieses Format (${size} benötigt).`);
      return;
    }

    const group = standings.slice(offset, offset + size); // Rang-sortiert
    const teamA = [], teamB = [], ranksA = [], ranksB = [];
    group.forEach((s, idx) => {
      const rank = offset + idx + 1; // echte Turnierplatzierung
      if (idx % 2 === 0) { teamA.push(s.id); ranksA.push(rank); } // ungerade Platzierungen
      else { teamB.push(s.id); ranksB.push(rank); } // gerade Platzierungen
    });

    t.finals[key] = { format, teamA, teamB, ranksA, ranksB, scoreA: null, scoreB: null, done: false };
    saveState();
    renderFinalCard(key, offset);
    updateSummaryButton();
  });
});

function updateSummaryButton() {
  const t = state.tournament;
  const btn = document.getElementById("btn-goto-summary");
  const grosseDone = t.finals && t.finals.grosse && t.finals.grosse.done;
  btn.classList.toggle("hidden", !grosseDone);
}

document.getElementById("btn-goto-summary").addEventListener("click", () => {
  state.tournament.stage = "done";
  saveState();
  renderSummaryView();
  showView("summary");
});

/* =========================================================
   ZUSAMMENFASSUNG
   ========================================================= */
function renderSummaryView() {
  const t = state.tournament;
  const el = document.getElementById("summary-content");
  el.innerHTML = "";

  ["grosse", "kleine"].forEach((key) => {
    const f = t.finals ? t.finals[key] : null;
    const block = document.createElement("div");
    block.className = "summary-block";
    const title = key === "grosse" ? "🏆 Großes Finale" : "🥈 Kleines Finale";
    if (f && f.done) {
      const winnerIsA = f.scoreA > f.scoreB;
      const winners = (winnerIsA ? f.teamA : f.teamB).map(playerName).join(" & ");
      const losers = (winnerIsA ? f.teamB : f.teamA).map(playerName).join(" & ");
      block.innerHTML = `<h3>${title}</h3><p><strong>${escapeHtml(winners)}</strong> gewinnt gegen ${escapeHtml(losers)} (${f.scoreA}:${f.scoreB})</p>`;
    } else {
      block.innerHTML = `<h3>${title}</h3><p class="final-note">Nicht ausgetragen.</p>`;
    }
    el.appendChild(block);
  });

  const standings = computeStandings();
  const table = document.createElement("div");
  table.className = "summary-block";
  table.innerHTML = `<h3>Endtabelle Vorrunde</h3><table class="summary-table">${standings
    .map((s, i) => `<tr><td>${i + 1}.</td><td>${escapeHtml(s.name)}</td><td>${s.wins} S.</td><td>${s.diff > 0 ? "+" : ""}${s.diff}</td></tr>`)
    .join("")}</table>`;
  el.appendChild(table);
}

document.getElementById("btn-new-tournament").addEventListener("click", () => {
  if (!confirm("Neues Turnier starten? Die Spielerdatenbank bleibt erhalten, das aktuelle Turnier wird archiviert-los gelöscht.")) return;
  state.tournament = null;
  setupSelection = new Set();
  saveState();
  renderSetupView();
  showView("setup");
});

/* =========================================================
   INIT
   ========================================================= */
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW-Registrierung fehlgeschlagen:", e));
    });
  }
}

function init() {
  // Geteilter Link (#share=…) hat Vorrang: nur lesbarer Bericht, kein Zugriff auf lokale Daten.
  if (renderSharedReportFromHash()) {
    registerServiceWorker();
    return;
  }

  renderPlayersView();

  if (state.tournament) {
    const t = state.tournament;
    if (t.stage === "done") { renderSummaryView(); showView("summary"); }
    else if (t.stage === "finals") { renderHistoryView(); showView("history"); }
    else if (t.stage === "standings") { renderStandingsView(); showView("standings"); }
    else { renderRoundView(); showView("round"); }
  } else {
    renderSetupView();
    showView("players");
  }

  registerServiceWorker();
}

init();
