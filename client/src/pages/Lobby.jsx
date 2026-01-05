import React from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { useGame } from "../context/GameContext";

export default function Lobby(){
  const { roomState, roomCode, isHost, startRound } = useGame();
  if(!roomState) return null;

  return (
    <div className="grid">
      <Card title="대기실" right={<span className="badge">ROOM {roomCode}</span>}>
        <div className="small">
          참가자 확인 후 호스트가 라운드를 시작합니다.
        </div>
        <div className="hr" />
        <div className="row">
          <Button variant="secondary" onClick={() => navigator.clipboard.writeText(roomCode)}>방 코드 복사</Button>
          {isHost && <Button onClick={startRound}>라운드 시작</Button>}
        </div>

        <div className="hr" />
        <div className="small"><b>참가자</b></div>
        <div style={{ height: 10 }} />
        <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
          {(roomState.players || []).map(p => (
            <div key={p.playerId} className="row">
              <div>
                <div style={{ fontWeight: 800 }}>{p.name}{p.isHost ? " (Host)" : ""}</div>
                <div className="small">{p.connected ? "ONLINE" : "OFFLINE"}</div>
              </div>
              <span className="badge">{p.connected ? "Connected" : "Disconnected"}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="누적 점수">
        <pre>{JSON.stringify(roomState.scoreboard, null, 2)}</pre>
      </Card>
    </div>
  );
}
