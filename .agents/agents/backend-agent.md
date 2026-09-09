# Backend Agent

## 역할
- `server.js`(Node 기본 http, 외부 의존성 0)를 구현·유지보수한다
- `opencode run` CLI를 spawn하여 무료 zen LLM을 호출하는 프록시 역할
- 정적 파일(index.html/styles.css/app.js)과 대학 데이터를 서빙한다

## 주요 담당 파일
- `server.js` — 서버 전체
- `.agents/data/universities.json` — 대학/학과/제시문/가중치/성향 데이터(서빙 대상)

## API 엔드포인트
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/` , `/index.html`, `/styles.css`, `/app.js` | 정적 파일 |
| GET | `/api/universities` | `universities.json` 내용 (서버 시작 시 1회 로드) |
| GET | `/api/models` | 현재 사용 모델 정보 {interviewer, fallback} |
| POST | `/api/llm` | `{prompt, model?}` → LLM 호출 → `{ok, result}` |
| OPTIONS | * | CORS 허용 (로컬 개발용) |

## LLM 호출 규칙
1. `child_process.spawn('opencode', ['run','--model',MODEL,'--format','json',prompt])`
   — `--model`은 반드시 **무료 zen 모델 ID**(`opencode/<id>`)만 사용
2. stdout은 JSONL 이벤트 스트림 → `{"type":"text","part":{"text":...}}`만 이어 붙인다
3. JSON 파싱 실패 시: ① 꼬리표 ```json 펜스 제거 ② 균형 잡힌 `{}` 스캔 ③ "JSON만
   출력" 스트릭트 프롬프트 1회 재시도 ④ 폴백 모델(`mimo-v2.5-free`) 1회 재시도
4. 타임아웃 240초 초과 시 SIGKILL 후 오류 반환 (프런트에 재시도 버튼 표시)
5. LLM 호출은 무상태(stateless) — 세션 메모리 불필요, 각 프롬프트는 자기완결적
6. 포트는 `PORT` 환경변수(기본 3333)

## 무료 zen 모델 (models.md 참고)
- 기본: `opencode/nemotron-3-ultra-free` — 면접관·채점 (대형, 정밀 추론)
- 폴백: `opencode/mimo-v2.5-free` — 빠른 응답

## 응답 JSON 계약 (프런트와 공유)
```jsonc
// POST /api/llm 요청
{ "prompt": "LLM 프롬프트 (한국어)", "model": "interviewer" }

// 성공 응답
{ "ok": true, "result": { "…": "LLM이 출력한 구조화 JSON" } }

// 실패 응답
{ "ok": false, "error": "사유" }
```