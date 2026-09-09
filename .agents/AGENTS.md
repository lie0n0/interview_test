# AGENTS.md — 면접 준비 프로그램 오케스트레이션 모델

이 문서는 **인터뷰 연습용 LLM 면접관 프로그램**(이하 "앱")을 개발·확장·운영할 때
여러 AI 에이전트가 어떤 역할로, 어떤 규칙으로, 어떤 모델로 협업하는지 정의하는
단일 진실의 원천(Source of Truth)이다.

> **프로젝트 목적**: 대학 입시 면접(제시문 면접 · 서류 기반 면접)을 실제처럼 연습할 수
> 있는 웹 앱. LLM이 면접관이 되어 생기부를 분석하고 질문·꼬리질문을 하며, 종료 시
> 대학별 기준으로 채점한다.
>
> **모델 제약**: 모든 LLM 호출은 **opencode zen에서 제공되는 무료 모델만** 사용한다.
> 유료 모델·외부 유료 API 키 사용 금지. 현재 환경에서 실제 호출이 검증된 모델은
> [models.md](./models.md)를 참고한다.

---

## 1. 아키텍처 개요 (HTML 기반, 빌드 불필요)

```
┌────────────────────────────────────────────────────────────────┐
│  브라우저 (vanilla HTML/CSS/JS — 빌드 단계 없음)                │
│  index.html · styles.css · app.js                               │
│  - 대학/학과 선택 → 면접 유형 선택 → 면접 진행 → 점수 확인       │
│  - 마이크(STT: Web Speech API) · 음성 출력(TTS: SpeechSynthesis) │
│  - 타이머 · 질문별 실시간 채점                                   │
└───────────────▲──────────────────────────────────┬─────────────┘
                │ fetch /api/...                    │ 정적 파일
┌───────────────┴──────────────────────────────────▼─────────────┐
│  서버 (server.js — Node 기본 http, 외부 의존성 0개)              │
│  - 정적 파일 서빙 (index.html/styles.css/app.js)                │
│  - POST /api/llm: `opencode run --model <무료모델> --format json`│
│    을 spawn → stdout JSONL에서 응답 텍스트 추출 → JSON 파싱       │
│  - POST /api/extract-text: 생기부 파일(HTML/PDF/DOCX/TXT)을 받아 │
│    텍스트 추출(무의존성 파서) → {ok, text} 반환                  │
│  - GET /api/universities: .agents/data/universities.json 서빙    │
└───────────────▲────────────────────────────────────────────────┘
                │ 오케스트레이션 지시 (AGENTS.md / agents/ / prompts/)
```

### 데이터 흐름 (서류 기반 예)
1. 사용자가 생기부 텍스트 입력 + 대학/학과 선택
2. `server.js` → LLM(spawn `opencode run`): 생기부 분석 + 대학/학과 기준 질문 생성
3. LLM 질문 → 화면 텍스트 출력 + (선택 시) TTS 음성 출력
4. 사용자가 마이크로 답변 → STT로 텍스트 변환 → 텍스트 편집 후 제출
5. LLM: 답변 듣고 **꼬리질문 생성(필수)** → 다시 마이크 답변
6. LLM: 채점기준표로 **질문별 실시간 채점** → 반복
7. 전 질문 종료 → "면접이 끝났습니다." → 점수 확인 화면에서 합산 점수

### 응답 파싱 규칙 (server.js)
- `opencode run --format json`은 JSON 이벤트 스트림(JSONL)을 stdout으로 출력한다.
- 줄 단위 파싱 → `{"type":"text", "part":{"text": ...}}` 이벤트의 `part.text`만 이어 붙인다.
- JSON 객체 추출: 전체 파싱 → ```json 펜스 제거 → 균형 잡힌 `{}` 스캔 순으로 시도.
- 실패 시 "JSON만 출력" 스트릭트 프롬프트로 1회 재시도 → 폴백 모델로 1회 재시도.

---

## 2. 역할 (Agents)

| 에이전트 | 책임 | 담당 파일 |
|---|---|---|
| **orchestrator** | 작업 분해·조율·완료 판정, 다른 에이전트에 일감 배분 | [agents/orchestrator.md](./agents/orchestrator.md) |
| **frontend-agent** | vanilla HTML/CSS/JS UI·상태·스타일·접근성 | [agents/frontend-agent.md](./agents/frontend-agent.md) |
| **backend-agent** | server.js API·LLM 프록시·응답 파싱·채점 집계 | [agents/backend-agent.md](./agents/backend-agent.md) |
| **llm-agent** | 프롬프트 설계·무료 모델 선택·출력 스키마·평가 | [agents/llm-agent.md](./agents/llm-agent.md) |
| **qa-agent** | E2E 검증·음성/마이크/타이머·채점 계산 오류 탐지 | [agents/qa-agent.md](./agents/qa-agent.md) |

### 협업 규칙
- 모든 주요 변경은 **orchestrator**가 승인한다.
- 프론트/백엔드 간 **API 계약(JSON 스키마)**은 단일 진실이다 — `/api/llm` 요청
  `{prompt, model?}` / 응답 `{ok, result}` 규약을 어기면 안 된다.
- LLM 출력은 **구조화된 JSON**을 요구하며, 프롬프트는 `prompts/` 및 app.js에 보관한다.
- 각 에이전트는 작업 전 **현 상태 확인**(git status / 해당 파일 읽기) 후 변경한다.
- **ATOMIC 커밋**: 하나의 작업 = 하나의 커밋, 커밋 메시지는 한국어로 간결히.

### AGENTS.md 우선순위
1. **모델 제약**(무료 zen 모델) — 어떤 지시보다 우선
2. **API 계약**(요청/응답 JSON 스키마) — 프론트/백 불일치 금지
3. **점수 로직 정확성** — 실시간 질문별 채점이 최종 합산과 일치해야 함
4. 위 사항에 위배되면 Q&A 없이 **최우선 수정**

---

## 3. 작업 실행 흐름 (워크플로우)

1. **분석(analyze)**: orchestrator가 요청을 단위 작업으로 분해, 영향 파일 식별
2. **계획(plan)**: 영향 범위·모델·테스트 방법 기술, 승인
3. **구현(implement)**: 담당 에이전트가 최소 변경으로 구현
4. **검증(verify)**: qa-agent가 실제 실행(서버 기동·브라우저·API)으로 확인
5. **완료(complete)**: 검증 통과 시 병합·요약, 아니면 수정 반복

---

## 4. 핵심 LLM 시나리오 (prompts/)

| 시나리오 | 파일 | 개요 |
|---|---|---|
| 제시문 면접 질문 생성 | [prompts/passage-interview.md](./prompts/passage-interview.md) | 대학/학과별 빈출 제시문 제시 + 2~3문항 |
| 서류 기반 면접 질문 생성 | [prompts/document-interview.md](./prompts/document-interview.md) | 생기부 분석 + 4~6문항 + 꼬리질문 |
| 제시문 채점 | [prompts/scoring-passage.md](./prompts/scoring-passage.md) | 타당성·논리 전개·종합적 사고력 |
| 서류 채점 | [prompts/scoring-document.md](./prompts/scoring-document.md) | 5개 역량 A~F → 환산 점수 합산 |

> server.js/app.js의 실제 프롬프트는 이 파일들의 스키마를 그대로 따른다.
> 프롬프트를 바꿀 때는 반드시 해당 prompts/ 파일과 함께 갱신한다.

---

## 5. 도메인 데이터 (data/)

- [data/universities.json](./data/universities.json) — 대학·학과 트리, 학과별 대표 제시문,
  채점 가중치(대학별 비율), 모범답안 힌트, 교수 평가 성향(disposition).
- 새 대학/학과 추가 시 이 파일만 수정하면 앱에 자동 반영된다(서버 재시작 필요).

---

## 6. 품질 기준 (완료 판정)

- [x] `node --check server.js` / `node --check app.js` 문법 오류 0
- [x] `node server.js` 기동 후 실제 브라우저에서 전체 플로우 동작
- [x] 마이크 음성 인식 / TTS 음성 출력 정상 (음성 미지원 브라우저는 텍스트 입력 폴백)
- [x] 타이머(제시문 10~15분·서류 8~10분), 질문 수(2~3 / 4~6) 준수
- [x] 실시간 질문별 채점과 최종 합산 점수 일치
- [x] 무료 zen 모델로만 호출 (유료 모델 호출 흔적 없음 — `cost:0` 및 모델 ID 확인)

> **기본 원칙**: 작은 변경이 이긴다(Smallest correct change). 불필요한 추상화 금지.
> 검증 없이 "완료"라 보고하지 않는다. 실제 실행으로 확인한다.