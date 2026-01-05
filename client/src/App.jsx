import React, { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useGame } from "./context/GameContext";

import Entry from "./pages/Entry.jsx";
import Lobby from "./pages/Lobby.jsx";
import Play from "./pages/Play.jsx";
import Vote from "./pages/Vote.jsx";
import Result from "./pages/Result.jsx";

export default function App(){
  const nav = useNavigate();
  const { roomState, lastRoundResult, gameFinished } = useGame();

  useEffect(() => {
    if(gameFinished) { nav("/result"); return; }
    if(!roomState) { nav("/"); return; }
    if(lastRoundResult) { nav("/result"); return; }

    const cr = roomState.currentRound;
    if(!cr) { nav("/lobby"); return; }
    if(cr.phase === "VOTING") nav("/vote");
    else nav("/play");
  }, [roomState, lastRoundResult, gameFinished, nav]);

  return (
    <div className="container">
      <div className="header">
        <div style={{ fontSize: 22, fontWeight: 900 }}>Word Relay Game</div>
        <div className="badge">React UI · Multi-Page Flow</div>
      </div>

      <Routes>
        <Route path="/" element={<Entry />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/play" element={<Play />} />
        <Route path="/vote" element={<Vote />} />
        <Route path="/result" element={<Result />} />
      </Routes>
    </div>
  );
}
