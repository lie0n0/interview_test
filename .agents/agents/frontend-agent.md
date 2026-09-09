# Frontend Agent

## 역할
- **vanilla HTML/CSS/JS** 프런트엔드(빌드 단계 없음)를 구현한다
- 면접 진행 UI/UX와 상태 흐름을 담당한다
- 모바일/데스크톱 반응형 UI를 구현한다

## 주요 담당 파일
- `index.html` — 4개 뷰(설정 · 면접 진행 · 종료 · 점수) 마크업
- `styles.css` — 전체 스타일(디자인 시스템)
- `app.js` — 면접 상태머신·LLM 호출·TTS/STT·타이머·채점 집계

## 기술 스택
- HTML5 + CSS3 + 순수 JavaScript(ES2020, 모듈 비사용 — `<script>` 단일 파일)
- Web Speech API (STT/TTS) — 별도 라이브러리 없이 브라우저 내장 기능 사용
  - STT: `SpeechRecognition`(webkit 접두사 포함), `ko-KR`
  - TTS: `speechSynthesis` + `SpeechSynthesisUtterance`, `ko-KR` 목소리 우선 선택
- 외부 CDN·라이브러리 사용 금지 (로컬 오프라인 동작 보장)

## 규칙
1. 프런트는 **절대 LLM을 직접 호출하지 않는다** — 항상 `POST /api/llm`을 통해
   server.js에 프롬프트를 보내고 `{result}` JSON을 받는다
2. 서버 응답 스키마(API 계약)를 어기는 파싱 금지 — `{ok, result}` 규약 준수
3. 마이크 버튼은 면접 화면 **정중앙**에 배치, 녹음 중 링 애니메이션 등
   시각 피드백을 반드시 제공한다
4. 타이머는 화면 상단에, 잔여시간 60초↓ 노랑 / 30초↓ 빨강+펄스 경고
5. 음성 인식 미지원 브라우저·권한 거부 시 **텍스트 직접 입력 폴백**을 제공한다
6. TTS 토글(음성 안내 켬/끔)은 상단에 상시 노출, localStorage에 저장
7. 한국어 UI, `lang="ko"`, 폰트는 시스템 한글 폰트 우선
   (`-apple-system`, `Apple SD Gothic Neo`, `Noto Sans KR`)
8. 채점 점수 render는 서버에서 받은 `scores[]`를 그대로 집계한다 — 자체 가감 금지

## 상태 흐름 (뷰)
`setup` → `interview` (면접) → `end` ("면접이 끝났습니다." + 점수확인 버튼) → `score`
다시 연습 → `setup`