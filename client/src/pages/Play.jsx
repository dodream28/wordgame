import React, { useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Textarea from "../ui/Textarea.jsx";
import Stepper from "../ui/Stepper.jsx";
import { useGame } from "../context/GameContext.jsx";

export default function Play(){
  const { roomState, mutationJob, writingJob, submitSeed, submitMutation, submitEssay } = useGame();
  const cr = roomState?.currentRound;
  if(!cr) return null;

  const phase = cr.phase;
  const prog = cr.progress;

  const [seedText, setSeedText] = useState("");
  const [mutationText, setMutationText] = useState("");
  const [essayText, setEssayText] = useState("");

  const essayLines = useMemo(
    () => essayText.split("\n").map(s => s.trim()).filter(Boolean),
    [essayText]
  );

  return (
    <div className="grid">
      <Card title="라운드 진행" right={<span className="badge">Round {cr.roundNo}</span>}>
        <Stepper phase={phase} />
        <div style={{ height: 10 }} />
        <div className="small">
          Seed {prog.seedSubmitted}/{prog.total} · Mutation {prog.mutationSubmitted}/{prog.total} · Essay {prog.essaySubmitted}/{prog.total}
        </div>
      </Card>

      {phase === "SEED" && (
        <Card title="Seed 제출">
          <div className="small">문장 1개를 제출하십시오.</div>
          <div style={{ height: 10 }} />
          <Textarea rows={3} value={seedText} onChange={(e)=>setSeedText(e.target.value)} />
          <div style={{ height: 10 }} />
          <Button
            onClick={async ()=>{
              const res = await submitSeed(seedText);
              if(!res.ok) return alert(res.error);
              setSeedText("");
            }}
            disabled={!seedText.trim()}
          >
            제출
          </Button>
        </Card>
      )}

      {phase === "MUTATION" && (
        <Card title="변형 제출">
          {!mutationJob ? (
            <div className="small">배정 대기 중입니다.</div>
          ) : (
            <>
              <div className="small"><b>배정 Seed</b></div>
              <pre>{mutationJob.seedText}</pre>
              <div className="hr" />
              <div className="small">띄어쓰기 토큰 기준 단어 1개만 교체하십시오.</div>
              <div style={{ height: 10 }} />
              <Textarea rows={3} value={mutationText} onChange={(e)=>setMutationText(e.target.value)} />
              <div style={{ height: 10 }} />
              <Button
                onClick={async ()=>{
                  const res = await submitMutation(mutationJob.seedOwnerId, mutationText);
                  if(!res.ok) return alert(res.error);
                  setMutationText("");
                }}
                disabled={!mutationText.trim()}
              >
                제출
              </Button>
            </>
          )}
        </Card>
      )}

      {phase === "WRITING" && (
        <Card title="5문장 글 제출">
          {!writingJob ? (
            <div className="small">배정 대기 중입니다.</div>
          ) : (
            <>
              <div className="small"><b>최종문장(수정 금지)</b></div>
              <pre>{writingJob.finalSentence}</pre>
              <div className="hr" />
              <div className="small">줄바꿈 5줄로 작성하고, 그중 1줄은 최종문장을 완전 일치로 포함하십시오.</div>
              <div style={{ height: 10 }} />
              <Textarea rows={10} value={essayText} onChange={(e)=>setEssayText(e.target.value)} />
              <div className="hr" />
              <div className="small">
                현재 줄 수: {essayLines.length}/5 · 최종문장 포함: {essayLines.includes(writingJob.finalSentence) ? "YES" : "NO"}
              </div>
              <div style={{ height: 10 }} />
              <Button
                onClick={async ()=>{
                  const res = await submitEssay(writingJob.seedOwnerId, essayText);
                  if(!res.ok) return alert(res.error);
                  setEssayText("");
                }}
                disabled={!essayText.trim()}
              >
                제출
              </Button>
            </>
          )}
        </Card>
      )}

      {phase !== "SEED" && phase !== "MUTATION" && phase !== "WRITING" && (
        <Card title="대기">
          <div className="small">현재 단계는 다른 페이지에서 처리됩니다.</div>
        </Card>
      )}
    </div>
  );
}