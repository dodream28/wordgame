const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// 운영에서는 같은 도메인/포트로 들어오므로 CORS가 필요 없지만,
// 개발에서는 Vite(5173)에서 들어오니 허용이 필요합니다.
const io = new Server(server, {
  cors: { origin: "*" }
});

// ---------- (옵션) React dist 정적 서빙 ----------
// client를 build 하면 ../client/dist 가 생깁니다.
// 운영 모드에서만 유효. 개발 모드에서는 Vite가 제공.
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("/health", (req, res) => res.send("ok"));
app.get("/", (req, res) => {
  const indexPath = path.join(clientDist, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) res.send("Server is running. Build client to serve UI.");
  });
});

// ---------- Utilities ----------
function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function cryptoId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function cryptoToken() {
  return cryptoId() + cryptoId() + cryptoId();
}
function splitTokens(sentence) {
  return sentence.trim().split(/\s+/).filter(Boolean);
}
function validateOneTokenReplacement(before, after) {
  const a = splitTokens(before);
  const b = splitTokens(after);
  if (a.length !== b.length) return { ok: false, reason: "토큰 개수가 달라 추가/삭제가 발생했습니다." };

  let diffIndex = -1;
  let diffCount = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      diffCount++;
      diffIndex = i;
    }
  }
  if (diffCount !== 1) return { ok: false, reason: "띄어쓰기 토큰 기준 정확히 1개만 변경해야 합니다." };

  return { ok: true, diff: { index: diffIndex, from: a[diffIndex], to: b[diffIndex] } };
}
function splitEssayToFiveLines(essayText) {
  return essayText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
function buildAnonLabels(playerIds) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const labels = [];
  for (let i = 0; i < playerIds.length; i++) {
    let n = i;
    let s = "";
    do {
      s = alpha[n % 26] + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    labels.push(s);
  }
  const shuffledLabels = shuffle(labels);
  const map = {};
  const inv = {};
  for (let i = 0; i < playerIds.length; i++) {
    map[playerIds[i]] = shuffledLabels[i];
    inv[shuffledLabels[i]] = playerIds[i];
  }
  return { map, inv };
}

// ---------- In-memory Store ----------
const games = new Map(); // roomCode -> game

function clampMaxRounds(maxRounds) {
  const n = Number(maxRounds);
  if (!Number.isFinite(n)) return 5;
  if (n < 1) return 1;
  if (n > 50) return 50;
  return Math.floor(n);
}
function ensureGame(roomCode) {
  const g = games.get(roomCode);
  if (!g) throw new Error("존재하지 않는 방입니다.");
  return g;
}
function ensurePlayer(game, socketId) {
  const playerId = game.socketToPlayerId.get(socketId);
  if (!playerId) throw new Error("방에 참가되어 있지 않습니다.");
  const p = game.players.get(playerId);
  if (!p) throw new Error("플레이어 정보를 찾을 수 없습니다.");
  return p;
}
function summarizeProgress(round) {
  const seeds = Object.values(round.seeds);
  return {
    seedSubmitted: seeds.filter((s) => !!s.seedText).length,
    mutationSubmitted: seeds.filter((s) => !!s.mutationText).length,
    essaySubmitted: seeds.filter((s) => !!s.essayText).length,
    total: seeds.length,
    votesSubmitted: Object.keys(round.votes).length
  };
}
function publicGameView(game) {
  const players = Array.from(game.players.values()).map((p) => ({
    playerId: p.playerId,
    name: p.name,
    isHost: p.playerId === game.hostId,
    connected: !!p.socketId
  }));

  const round = game.currentRound
    ? {
        roundNo: game.currentRound.roundNo,
        phase: game.currentRound.phase,
        progress: summarizeProgress(game.currentRound)
      }
    : null;

  return {
    roomCode: game.roomCode,
    status: game.status,
    config: { maxRounds: game.maxRounds },
    players,
    scoreboard: game.scoreboard,
    currentRound: round,
    roundsCount: game.rounds.length
  };
}
function broadcastState(game) {
  io.to(game.roomCode).emit("room_state", publicGameView(game));
}

// ---------- Game lifecycle ----------
function createGame(hostSocket, hostName, maxRounds) {
  let code = makeRoomCode();
  while (games.has(code)) code = makeRoomCode();

  const hostId = cryptoId();
  const hostToken = cryptoToken();

  const game = {
    roomCode: code,
    status: "LOBBY", // LOBBY | IN_ROUND | FINISHED
    hostId,
    maxRounds: clampMaxRounds(maxRounds),
    players: new Map(), // playerId -> {playerId, name, socketId, token}
    tokenToPlayerId: new Map(), // token -> playerId
    socketToPlayerId: new Map(), // socketId -> playerId
    scoreboard: {}, // playerId -> {mutation, cohesion, twist, sum}
    rounds: [],
    currentRound: null
  };

  game.players.set(hostId, { playerId: hostId, name: hostName, socketId: hostSocket.id, token: hostToken });
  game.tokenToPlayerId.set(hostToken, hostId);
  game.socketToPlayerId.set(hostSocket.id, hostId);
  game.scoreboard[hostId] = { mutation: 0, cohesion: 0, twist: 0, sum: 0 };

  games.set(code, game);
  return { game, hostId, hostToken };
}

function joinOrReconnect(game, socket, name, token) {
  if (token) {
    const existingId = game.tokenToPlayerId.get(token);
    if (existingId) {
      const p = game.players.get(existingId);
      if (p?.socketId) game.socketToPlayerId.delete(p.socketId);
      p.socketId = socket.id;
      if (name && name.trim()) p.name = name.trim();
      game.socketToPlayerId.set(socket.id, existingId);
      socket.join(game.roomCode);
      resendAssignmentsIfNeeded(game, existingId);
      return { playerId: existingId, token };
    }
  }

  const playerId = cryptoId();
  const newToken = cryptoToken();
  game.players.set(playerId, { playerId, name: name?.trim() || "Player", socketId: socket.id, token: newToken });
  game.tokenToPlayerId.set(newToken, playerId);
  game.socketToPlayerId.set(socket.id, playerId);
  game.scoreboard[playerId] = game.scoreboard[playerId] || { mutation: 0, cohesion: 0, twist: 0, sum: 0 };
  socket.join(game.roomCode);
  return { playerId, token: newToken };
}

function startRound(game) {
  if (game.status === "FINISHED") throw new Error("이미 종료된 게임입니다.");
  if (game.currentRound) throw new Error("이미 진행 중인 라운드가 있습니다.");
  if (game.rounds.length >= game.maxRounds) throw new Error("설정된 라운드 수에 도달했습니다.");

  const playerIds = Array.from(game.players.keys());
  if (playerIds.length < 3) throw new Error("최소 3명부터 시작 가능합니다.");

  const order = shuffle(playerIds);
  const roundNo = game.rounds.length + 1;

  const round = {
    roundNo,
    phase: "SEED", // SEED -> MUTATION -> WRITING -> VOTING -> RESULT
    order,
    seeds: {}, // ownerId -> seed object
    votes: {}, // voterId -> {mutationLabel, cohesionLabel, twistLabel}
    anon: null,
    roundScores: null
  };

  const n = order.length;
  for (let i = 0; i < n; i++) {
    const ownerId = order[i];
    const mutateBy = order[(i + 1) % n];
    const writeBy = order[(i + 2) % n];

    round.seeds[ownerId] = {
      seedOwnerId: ownerId,
      mutateBy,
      writeBy,
      seedText: null,
      mutationText: null,
      diff: null,
      finalSentence: null,
      essayText: null,
      essayLines: null
    };
  }

  game.currentRound = round;
  game.rounds.push(round);
  game.status = "IN_ROUND";
}

function allSeedsSubmitted(round) {
  return Object.values(round.seeds).every((s) => typeof s.seedText === "string" && s.seedText.length > 0);
}
function allMutationsSubmitted(round) {
  return Object.values(round.seeds).every((s) => typeof s.mutationText === "string" && s.mutationText.length > 0);
}
function allEssaysSubmitted(round) {
  return Object.values(round.seeds).every((s) => typeof s.essayText === "string" && s.essayText.length > 0);
}
function allVotesSubmitted(round, playerCount) {
  return Object.keys(round.votes).length === playerCount;
}

function emitMutationAssignments(game) {
  const round = game.currentRound;
  for (const s of Object.values(round.seeds)) {
    const mutator = game.players.get(s.mutateBy);
    if (!mutator?.socketId) continue;
    io.to(mutator.socketId).emit("mutation_assignment", {
      roundNo: round.roundNo,
      seedOwnerId: s.seedOwnerId,
      seedText: s.seedText,
      rule: "띄어쓰기 토큰 기준 1개만 교체(추가/삭제 금지)"
    });
  }
}

function emitWritingAssignments(game) {
  const round = game.currentRound;
  for (const s of Object.values(round.seeds)) {
    const writer = game.players.get(s.writeBy);
    if (!writer?.socketId) continue;
    io.to(writer.socketId).emit("writing_assignment", {
      roundNo: round.roundNo,
      seedOwnerId: s.seedOwnerId,
      finalSentence: s.finalSentence,
      rule: "5문장(줄바꿈 5줄) + 최종문장 그대로 1줄 포함(수정 금지)"
    });
  }
}

function uniqueByLabel(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    if (seen.has(e.candidateLabel)) continue;
    seen.add(e.candidateLabel);
    out.push(e);
  }
  return out;
}

function setupAnonymousVoting(round, game) {
  const playerIds = Array.from(game.players.keys());
  round.anon = buildAnonLabels(playerIds);
}

function emitAnonymousBallot(game) {
  const round = game.currentRound;
  const anon = round.anon;

  const mutationEntries = [];
  const writingEntries = [];

  for (const seed of Object.values(round.seeds)) {
    mutationEntries.push({
      candidateLabel: anon.map[seed.mutateBy],
      seedText: seed.seedText,
      diff: seed.diff,
      mutationText: seed.mutationText
    });

    writingEntries.push({
      candidateLabel: anon.map[seed.writeBy],
      finalSentence: seed.finalSentence,
      essayLines: seed.essayLines
    });
  }

  for (const p of game.players.values()) {
    if (!p.socketId) continue;
    io.to(p.socketId).emit("voting_started_anonymous", {
      roundNo: round.roundNo,
      myLabel: anon.map[p.playerId],
      mutationCandidates: uniqueByLabel(mutationEntries),
      writingCandidates: uniqueByLabel(writingEntries),
      rule: "익명 투표: 변형력(변형 후보) 1명 + 연결력/반전(글 후보) 각 1명. 자기 라벨 선택 불가."
    });
  }
}

function calcMvp(game) {
  const entries = Object.entries(game.scoreboard).map(([playerId, sc]) => ({
    playerId,
    ...sc,
    name: game.players.get(playerId)?.name || "Unknown"
  }));
  entries.sort((a, b) => b.sum - a.sum || b.twist - a.twist || b.cohesion - a.cohesion || b.mutation - a.mutation);
  return entries[0] || null;
}

function buildReplay(round, game) {
  const replay = [];
  for (const s of Object.values(round.seeds)) {
    const owner = game.players.get(s.seedOwnerId);
    const mutator = game.players.get(s.mutateBy);
    const writer = game.players.get(s.writeBy);

    replay.push({
      seedOwner: { playerId: owner.playerId, name: owner.name },
      seedText: s.seedText,
      mutator: { playerId: mutator.playerId, name: mutator.name },
      diff: s.diff,
      mutationText: s.mutationText,
      writer: { playerId: writer.playerId, name: writer.name },
      finalSentence: s.finalSentence,
      essayLines: s.essayLines
    });
  }
  return replay;
}

function finalizeRound(game) {
  const round = game.currentRound;
  const anon = round.anon;

  const tally = { mutation: {}, cohesion: {}, twist: {} };
  for (const v of Object.values(round.votes)) {
    const mId = anon.inv[v.mutationLabel];
    const cId = anon.inv[v.cohesionLabel];
    const tId = anon.inv[v.twistLabel];

    tally.mutation[mId] = (tally.mutation[mId] || 0) + 1;
    tally.cohesion[cId] = (tally.cohesion[cId] || 0) + 1;
    tally.twist[tId] = (tally.twist[tId] || 0) + 1;
  }

  const roundScores = {};
  for (const p of game.players.values()) {
    const id = p.playerId;
    const m = tally.mutation[id] || 0;
    const c = tally.cohesion[id] || 0;
    const t = tally.twist[id] || 0;
    roundScores[id] = { mutation: m, cohesion: c, twist: t, sum: m + c + t };
  }

  for (const [playerId, sc] of Object.entries(roundScores)) {
    game.scoreboard[playerId].mutation += sc.mutation;
    game.scoreboard[playerId].cohesion += sc.cohesion;
    game.scoreboard[playerId].twist += sc.twist;
    game.scoreboard[playerId].sum += sc.sum;
  }

  round.roundScores = roundScores;
  round.phase = "RESULT";

  io.to(game.roomCode).emit("round_result", {
    roundNo: round.roundNo,
    replay: buildReplay(round, game),
    roundScores,
    scoreboard: game.scoreboard,
    mvp: calcMvp(game)
  });

  game.currentRound = null;
  game.status = "LOBBY";

  if (game.rounds.length >= game.maxRounds) {
    game.status = "FINISHED";
    io.to(game.roomCode).emit("game_finished", {
      mvp: calcMvp(game),
      scoreboard: game.scoreboard,
      totalRounds: game.rounds.length
    });
  }
}

function advancePhaseIfPossible(game) {
  const round = game.currentRound;
  const playerCount = game.players.size;

  if (round.phase === "SEED" && allSeedsSubmitted(round)) {
    round.phase = "MUTATION";
    emitMutationAssignments(game);
    broadcastState(game);
    return;
  }

  if (round.phase === "MUTATION" && allMutationsSubmitted(round)) {
    round.phase = "WRITING";
    emitWritingAssignments(game);
    broadcastState(game);
    return;
  }

  if (round.phase === "WRITING" && allEssaysSubmitted(round)) {
    round.phase = "VOTING";
    setupAnonymousVoting(round, game);
    emitAnonymousBallot(game);
    broadcastState(game);
    return;
  }

  if (round.phase === "VOTING" && allVotesSubmitted(round, playerCount)) {
    finalizeRound(game);
    broadcastState(game);
  }
}

function resendAssignmentsIfNeeded(game, playerId) {
  const round = game.currentRound;
  if (!round) return;
  const p = game.players.get(playerId);
  if (!p?.socketId) return;

  if (round.phase === "MUTATION") {
    for (const s of Object.values(round.seeds)) {
      if (s.mutateBy === playerId) {
        io.to(p.socketId).emit("mutation_assignment", {
          roundNo: round.roundNo,
          seedOwnerId: s.seedOwnerId,
          seedText: s.seedText,
          rule: "띄어쓰기 토큰 기준 1개만 교체(추가/삭제 금지)"
        });
      }
    }
  }

  if (round.phase === "WRITING") {
    for (const s of Object.values(round.seeds)) {
      if (s.writeBy === playerId) {
        io.to(p.socketId).emit("writing_assignment", {
          roundNo: round.roundNo,
          seedOwnerId: s.seedOwnerId,
          finalSentence: s.finalSentence,
          rule: "5문장(줄바꿈 5줄) + 최종문장 그대로 1줄 포함(수정 금지)"
        });
      }
    }
  }

  if (round.phase === "VOTING") {
    emitAnonymousBallot(game);
  }
}

// ---------- Socket handlers ----------
io.on("connection", (socket) => {
  socket.on("create_room", ({ name, maxRounds }, cb) => {
    try {
      const hostName = name?.trim() || "Host";
      const { game, hostId, hostToken } = createGame(socket, hostName, maxRounds);
      socket.join(game.roomCode);
      broadcastState(game);
      cb?.({ ok: true, roomCode: game.roomCode, playerId: hostId, token: hostToken, maxRounds: game.maxRounds });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("join_room", ({ roomCode, name, token }, cb) => {
    try {
      const game = ensureGame(roomCode);
      if (game.status === "FINISHED") throw new Error("종료된 방입니다.");
      const result = joinOrReconnect(game, socket, name, token);
      broadcastState(game);
      cb?.({ ok: true, roomCode: game.roomCode, playerId: result.playerId, token: result.token, maxRounds: game.maxRounds });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("start_round", ({ roomCode }, cb) => {
    try {
      const game = ensureGame(roomCode);
      const player = ensurePlayer(game, socket.id);
      if (player.playerId !== game.hostId) throw new Error("호스트만 라운드를 시작할 수 있습니다.");
      startRound(game);
      io.to(game.roomCode).emit("round_started", { roundNo: game.rounds.length, phase: "SEED" });
      broadcastState(game);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("submit_seed", ({ roomCode, text }, cb) => {
    try {
      const game = ensureGame(roomCode);
      const player = ensurePlayer(game, socket.id);
      const round = game.currentRound;
      if (!round || round.phase !== "SEED") throw new Error("현재는 Seed 제출 단계가 아닙니다.");

      const t = (text || "").trim();
      if (!t) throw new Error("Seed 문장이 비어 있습니다.");

      const seedObj = round.seeds[player.playerId];
      if (seedObj.seedText) throw new Error("이미 Seed를 제출했습니다.");
      seedObj.seedText = t;

      broadcastState(game);
      advancePhaseIfPossible(game);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("submit_mutation", ({ roomCode, seedOwnerId, mutatedText }, cb) => {
    try {
      const game = ensureGame(roomCode);
      const player = ensurePlayer(game, socket.id);
      const round = game.currentRound;
      if (!round || round.phase !== "MUTATION") throw new Error("현재는 변형 단계가 아닙니다.");

      const seedObj = round.seeds[seedOwnerId];
      if (!seedObj) throw new Error("해당 Seed를 찾을 수 없습니다.");
      if (seedObj.mutateBy !== player.playerId) throw new Error("배정된 변형자가 아닙니다.");

      const t = (mutatedText || "").trim();
      if (!t) throw new Error("변형 문장이 비어 있습니다.");

      const v = validateOneTokenReplacement(seedObj.seedText, t);
      if (!v.ok) throw new Error(v.reason);

      seedObj.mutationText = t;
      seedObj.diff = v.diff;
      seedObj.finalSentence = t;

      broadcastState(game);
      advancePhaseIfPossible(game);
      cb?.({ ok: true, diff: v.diff });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("submit_essay", ({ roomCode, seedOwnerId, essayText }, cb) => {
    try {
      const game = ensureGame(roomCode);
      const player = ensurePlayer(game, socket.id);
      const round = game.currentRound;
      if (!round || round.phase !== "WRITING") throw new Error("현재는 글쓰기 단계가 아닙니다.");

      const seedObj = round.seeds[seedOwnerId];
      if (!seedObj) throw new Error("해당 Seed를 찾을 수 없습니다.");
      if (seedObj.writeBy !== player.playerId) throw new Error("배정된 글쓴이가 아닙니다.");

      const raw = (essayText || "").trim();
      if (!raw) throw new Error("글이 비어 있습니다.");

      const lines = splitEssayToFiveLines(raw);
      if (lines.length !== 5) throw new Error("5문장 규칙: 줄바꿈 기준으로 정확히 5줄이어야 합니다.");
      if (!lines.some((l) => l === seedObj.finalSentence)) {
        throw new Error("5문장 중 1문장은 최종 문장을 그대로 포함해야 합니다(완전 일치).");
      }

      seedObj.essayText = raw;
      seedObj.essayLines = lines;

      broadcastState(game);
      advancePhaseIfPossible(game);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("submit_votes_anonymous", ({ roomCode, votes }, cb) => {
    try {
      const game = ensureGame(roomCode);
      const voter = ensurePlayer(game, socket.id);
      const round = game.currentRound;
      if (!round || round.phase !== "VOTING") throw new Error("현재는 투표 단계가 아닙니다.");
      if (round.votes[voter.playerId]) throw new Error("이미 투표를 제출했습니다.");

      const { mutationLabel, cohesionLabel, twistLabel } = votes || {};
      if (!mutationLabel || !cohesionLabel || !twistLabel) throw new Error("변형력/연결력/반전 모두 1명씩 선택해야 합니다.");

      const inv = round.anon.inv;
      if (!inv[mutationLabel] || !inv[cohesionLabel] || !inv[twistLabel]) throw new Error("투표 라벨이 유효하지 않습니다.");

      const selfLabel = round.anon.map[voter.playerId];
      if ([mutationLabel, cohesionLabel, twistLabel].includes(selfLabel)) throw new Error("자기 라벨에 투표할 수 없습니다.");

      round.votes[voter.playerId] = { mutationLabel, cohesionLabel, twistLabel };

      broadcastState(game);
      advancePhaseIfPossible(game);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("disconnect", () => {
    for (const game of games.values()) {
      const playerId = game.socketToPlayerId.get(socket.id);
      if (!playerId) continue;
      game.socketToPlayerId.delete(socket.id);
      const p = game.players.get(playerId);
      if (p) p.socketId = null;
      broadcastState(game);
      break;
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`Server listening on :${PORT}`));
