import React from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { useGame } from "../context/GameContext";

export default function Result(){
  const { gameFinished, lastRoundResult, isHost, startRound, setLastRoundResult, roomState } = useGame();

  if(gameFinished){
    return (
      <Card title="최종 결과">
        <pre>{JSON.stringify(gameFinished, null, 2)}</pre>
      </Card>
    );
  }

  if(!lastRoundResult) return null;

  const replay = lastRoundResult.replay || [];

  return (
    <div className="grid">
      <Card title={`라운드 ${lastRoundResult.roundNo} 결과`}>
        <div className="small">점수(라운드 / 누적)</div>
        <div className="hr" />
        <pre>{JSON.stringify(lastRoundResult.roundScores, null, 2)}</pre>
        <div className="hr" />
        <pre>{JSON.stringify(lastRoundResult.scoreboard, null, 2)}</pre>
      </Card>

      <Card title="리플레이 타임라인">
        <div className="small">Seed → 변형(diff) → 최종문장 → 5문장</div>
        <div className="hr" />
        <div style={{ display:"flex", flexDirection:"column", gap: 12 }}>
          {replay.map((r, idx) => (
            <Card key={idx} title={`Story #${idx+1}`}>
              <div className="small"><b>Seed</b></div>
              <pre>{r.seedText}</pre>
              <div className="hr" />
              <div className="small"><b>Mutation</b> {r.diff ? `("${r.diff.from}"→"${r.diff.to}", idx=${r.diff.index})` : ""}</div>
              <pre>{r.mutationText}</pre>
              <div className="hr" />
              <div className="small"><b>Essay (5 lines)</b></div>
              <pre>{(r.essayLines || []).map((l,i)=>`${i+1}) ${l}`).join("\n")}</pre>
            </Card>
          ))}
        </div>

        <div className="hr" />
        <div className="row">
          {isHost ? (
            <Button onClick={() => { setLastRoundResult(null); startRound(); }}>
              다음 라운드 시작
            </Button>
          ) : (
            <div className="small">호스트가 다음 라운드를 시작합니다.</div>
          )}
          <span className="badge">
            done {roomState?.roundsCount} / max {roomState?.config?.maxRounds}
          </span>
        </div>
      </Card>
    </div>
  );
}
