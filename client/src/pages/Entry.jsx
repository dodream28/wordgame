import React, { useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { useGame } from "../context/GameContext";

export default function Entry(){
  const { serverUrl, setServerUrl, connected, connect, nickname, setNickname, createRoom, joinRoom } = useGame();
  const [maxRounds, setMaxRounds] = useState(5);
  const [joinCode, setJoinCode] = useState("");

  async function onCreate(){
    if(!connected) return alert("먼저 서버에 연결하십시오.");
    const res = await createRoom({ name: nickname || "Host", maxRounds });
    if(!res.ok) return alert(res.error);
  }

  async function onJoin(){
    if(!connected) return alert("먼저 서버에 연결하십시오.");
    const code = joinCode.trim().toUpperCase();
    if(!code) return alert("방 코드가 필요합니다.");
    const res = await joinRoom({ roomCode: code, name: nickname || "Player" });
    if(!res.ok) return alert(res.error);
  }

  return (
    <div className="grid">
      <Card title="서버 연결">
        <div className="small">외부 서버라면 IP:PORT로 입력하십시오.</div>
        <div style={{ height: 8 }} />
        <Input placeholder="예) http://4.217.239.35:3001" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
        <div style={{ height: 10 }} />
        <Input placeholder="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        <div style={{ height: 10 }} />
        <Button onClick={() => connect(serverUrl)} disabled={!serverUrl}>
          {connected ? "연결됨" : "연결"}
        </Button>
      </Card>

      <Card title="방 생성 / 참가">
        <div className="small">방 코드는 ‘방 생성’ 시 서버가 발급합니다.</div>
        <div className="hr" />

        <div className="small">라운드 수</div>
        <div style={{ height: 8 }} />
        <Input type="number" min={1} max={50} value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} />
        <div style={{ height: 10 }} />
        <Button onClick={onCreate} disabled={!connected}>방 생성</Button>

        <div className="hr" />
        <div className="small">방 코드</div>
        <div style={{ height: 8 }} />
        <Input placeholder="예) ABC123" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
        <div style={{ height: 10 }} />
        <Button variant="secondary" onClick={onJoin} disabled={!connected}>방 참가/재접속</Button>
      </Card>
    </div>
  );
}
