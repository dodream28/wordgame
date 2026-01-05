import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { createSocket } from "../lib/socket";
import { loadSession, saveSession } from "../lib/storage";

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

export function GameProvider({ children }){
  const socketRef = useRef(null);

  const [serverUrl, setServerUrl] = useState("");
  const [connected, setConnected] = useState(false);

  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [token, setToken] = useState("");

  const [roomState, setRoomState] = useState(null);

  const [mutationJob, setMutationJob] = useState(null);
  const [writingJob, setWritingJob] = useState(null);
  const [anonBallot, setAnonBallot] = useState(null);

  const [lastRoundResult, setLastRoundResult] = useState(null);
  const [gameFinished, setGameFinished] = useState(null);

  const me = useMemo(() => {
    if(!roomState || !playerId) return null;
    return roomState.players?.find(p => p.playerId === playerId) || null;
  }, [roomState, playerId]);

  const isHost = !!me?.isHost;

  function connect(url){
    if(socketRef.current) socketRef.current.disconnect();

    const s = createSocket(url);
    socketRef.current = s;
    setServerUrl(url);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("room_state", (state) => setRoomState(state));

    s.on("round_started", () => {
      setMutationJob(null);
      setWritingJob(null);
      setAnonBallot(null);
      setLastRoundResult(null);
    });

    s.on("mutation_assignment", (msg) => setMutationJob(msg));
    s.on("writing_assignment", (msg) => setWritingJob(msg));
    s.on("voting_started_anonymous", (msg) => setAnonBallot(msg));

    s.on("round_result", (msg) => {
      setLastRoundResult(msg);
      setAnonBallot(null);
      setMutationJob(null);
      setWritingJob(null);
    });

    s.on("game_finished", (msg) => setGameFinished(msg));
  }

  function createRoom({ name, maxRounds }){
    const s = socketRef.current;
    if(!s) throw new Error("소켓이 연결되지 않았습니다.");

    return new Promise((resolve) => {
      s.emit("create_room", { name, maxRounds }, (res) => {
        if(res?.ok){
          setRoomCode(res.roomCode);
          setPlayerId(res.playerId);
          setToken(res.token);
          setNickname(name);
          saveSession(res.roomCode, { token: res.token, playerId: res.playerId, nickname: name });
        }
        resolve(res);
      });
    });
  }

  function joinRoom({ roomCode, name }){
    const s = socketRef.current;
    if(!s) throw new Error("소켓이 연결되지 않았습니다.");

    const saved = loadSession(roomCode);
    const useToken = saved?.token || null;

    return new Promise((resolve) => {
      s.emit("join_room", { roomCode, name, token: useToken }, (res) => {
        if(res?.ok){
          setRoomCode(res.roomCode);
          setPlayerId(res.playerId);
          setToken(res.token);
          setNickname(name);
          saveSession(res.roomCode, { token: res.token, playerId: res.playerId, nickname: name });
        }
        resolve(res);
      });
    });
  }

  function startRound(){
    const s = socketRef.current;
    return new Promise((resolve) => s.emit("start_round", { roomCode }, (res) => resolve(res)));
  }

  function submitSeed(text){
    const s = socketRef.current;
    return new Promise((resolve) => s.emit("submit_seed", { roomCode, text }, (res) => resolve(res)));
  }

  function submitMutation(seedOwnerId, mutatedText){
    const s = socketRef.current;
    return new Promise((resolve) =>
      s.emit("submit_mutation", { roomCode, seedOwnerId, mutatedText }, (res) => resolve(res))
    );
  }
