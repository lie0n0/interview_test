# 무료 zen 모델 레지스트리 (models.md)

> 이 프로젝트의 모든 LLM 호출은 **opencode zen의 무료 모델**만 사용한다.
> 아래 목록은 현재 환경에서 실제 호출이 성공한(또는 후보인) 무료 모델이다.
> 모델 ID는 `opencode run --model <id>` 형태로 사용한다.

## ✅ 현재 동작 확인 완료 (2026-09-07 환경 기준)

| 모델 ID | 공급사 | 특징 | 용도 |
|---|---|---|---|
| `opencode/nemotron-3-ultra-free` | NVIDIA Nemotron 3 Ultra 550B | 대형·긴 문맥(1M), 한국어 우수 | **면접관(기본 권장)** |
| `opencode/mimo-v2.5-free` | Xiaomi MiMo V2.5 | 한국어 응답 양호, 빠름 | 면접관 대안 / 빨리 답할 때 |
| `opencode/ling-3.0-flash-fin-free` | inclusionAI Ling 3.0 Flash | 빠르고 가벼움 | 보조·요약 |
| `opencode/nemotron-3.5-lightning-free` | NVIDIA Nemotron 3.5 Lightning 30B | 가볍고 빠름 | 보조·가벼운 작업 |

## ⚠️ 환경에서 오류(인증/라우팅)로 현재 미동작 — 재시도 전 확인

- `opencode/qwen3.6-plus-free`, `opencode/glm-5-free`, `opencode/glm-4.7-free`
- `opencode/kimi-k2.5-free`, `opencode/deepseek-v4-flash-free`
- `opencode/ling-3.0-tiny-free`, `opencode/ling-2.6-flash-free`
- `opencode/minimax-m2.1-free`, `opencode/hy3-free`

> 이 모델들은 미래에 라우팅이 활성화되면 사용 가능할 수 있다. 사용 전 반드시
> `opencode run --model <id> "인사"` 로 동작을 1회 확인한다.

## 배정 원칙

1. **면접관(핵심 추론)**: `nemotron-3-ultra-free` 우선. 응답이 느리면 `mimo-v2.5-free`로 폴백.
2. **채점**: 질문별 채점은 추론이 필요하므로 `nemotron-3-ultra-free` 또는 `mimo-v2.5-free`.
3. **음성(STT/TTS)**: 웹 브라우저 내장 **Web Speech API**(SpeechRecognition / SpeechSynthesis) 사용 — 완전 무료·오프라인, 별도 모델 비용 없음.
4. 어떤 상황에서도 **유료 모델**(`freemodel/*`, `openrouter` 유료 라우트 등)을 사용하지 않는다.

## 모델 선택이 프롬프트에 미치는 영향

- 무료 모델은 지시 준수·JSON 출력이 유료 대비 불안정할 수 있다. 반드시:
  - 구조화 JSON을 요구할 때 **출력 스키마를 프롬프트에 명시**하고, 파서는 실패 시
    재요청(1회) 후 마지막 줄 JSON 블록을 파싱하는 폴백을 둔다.
  - 한국어 답변 길이를 명시(예: "질문 1개당 2~3문장")하여 과도한 출력 방지.
