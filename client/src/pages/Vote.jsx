import React, { useMemo, useState } from "react";
import Card from "../ui/Card";
import Tabs from "../ui/Tabs";
import CandidateCard from "../ui/CandidateCard";
import Button from "../ui/Button";
import { useGame } from "../context/GameContext";

export default function Vote(){
  const { anonBallot, submitVotesAnonymous } = useGame();
  const [tab, setTab] = useState("mutation");
  const [pickMutation, setPickMutation] = useState("");
  const [pickCohesion, setPickCohesion] = useState("");
  const [pickTwist, setPickTwist] = useState("");

  if(!anonBallot) return (
    <Card title="익명 투표">
      <div className="small">투표 배정 대기 중입니다.</div>
    </Card>
  );

  const myLabel = anonBallot.myLabel;

  const mutationCandidates = useMemo(() => (anonBallot.mutationCandidates || []).map(c => ({
    label: c.candidateLabel,
    seedText: c.seedText,
    mutationText: c.mutationText,
    diff: c.diff
  })), [anonBallot]);

  const writingCandidates = useMemo(() => (anonBallot.writingCandidates || []).map(c => ({
    label: c.candidateLabel,
    finalSentence: c.finalSentence,
    essayLines: c.essayLines
  })), [anonBallot]);

  return (
    <div className="grid">
      <Card title="익명 투표" right={<span className="badge">내 라벨: {myLabel} (선택 불가)</span>}>
        <Tabs
          tabs={[
            { key:"mutation", label:"변형 후보" },
            { key:"writing", label:"글 후보" }
          ]}
          active={tab}
          onChange={setTab}
        />
        <div style={{ height: 12 }} />

        {tab === "mutation" && (
          <div style={{ display:"flex", flexDirection:"column", gap: 12 }}>
            {mutationCandidates.map(c => {
              const d = c.diff ? `"${c.diff.from}" → "${c.diff.to}" (idx=${c.diff.index})` : "diff 없음";
              return (
                <CandidateCard
                  key={c.label}
                  label={c.label}
                  kind="변형 후보"
                  summary={d}
                  selected={pickMutation === c.label}
                  onSelect={() => setPickMutation(c.label)}
                  disabled={c.label === myLabel}
                  detail={
                    <>
                      <div className="small"><b>Seed</b></div>
                      <pre>{c.seedText}</pre>
                      <div style={{ height: 10 }} />
                      <div className="small"><b>Mutated</b></div>
                      <pre>{c.mutationText}</pre>
                    </>
                  }
                />
              );
            })}
          </div>
        )}

        {tab === "writing" && (
          <div style={{ display:"flex", flexDirection:"column", gap: 12 }}>
            {writingCandidates.map(c => (
              <Card
                key={c.label}
                title={`글 후보 · ${c.label}`}
                right={<span className="badge">final</span>}
              >
                <div className="small"><b>{c.finalSentence}</b></div>
                <div className="hr" />
                <pre>{(c.essayLines || []).map((l,i)=>`${i+1}) ${l}`).join("\n")}</pre>
                <div className="hr" />
                <div className="row">
                  <label style={{ display:"flex", gap:8, alignItems:"center", color: c.label===myLabel ? "var(--muted)" : "var(--text)" }}>
                    <input type="radio" name="cohesion" checked={pickCohesion===c.label} onChange={()=>setPickCohesion(c.label)} disabled={c.label===myLabel}/>
                    연결력
                  </label>
                  <label style={{ display:"flex", gap:8, alignItems:"center", color: c.label===myLabel ? "var(--muted)" : "var(--text)" }}>
                    <input type="radio" name="twist" checked={pickTwist===c.label} onChange={()=>setPickTwist(c.label)} disabled={c.label===myLabel}/>
                    반전
                  </label>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card title="제출 요약">
        <div className="small">변형력/연결력/반전 각 1명씩 선택 후 제출하십시오.</div>
        <div className="hr" />
        <div className="small">변형력: <b>{pickMutation || "-"}</b></div>
        <div className="small">연결력: <b>{pickCohesion || "-"}</b></div>
        <div className="small">반전: <b>{pickTwist || "-"}</b></div>
        <div className="hr" />
        <Button
          onClick={async ()=>{
            const res = await submitVotesAnonymous({ mutationLabel: pickMutation, cohesionLabel: pickCohesion, twistLabel: pickTwist });
            if(!res.ok) return alert(res.error);
            alert("투표 제출 완료");
          }}
          disabled={!pickMutation || !pickCohesion || !pickTwist}
        >
          투표 제출
        </Button>
      </Card>
    </div>
  );
}
