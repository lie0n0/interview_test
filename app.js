'use strict';
/* ============================================================
   AI 면접 연습실 — 프런트엔드 로직
   (vanilla JS · LLM은 항상 POST /api/llm 경유 · 무료 zen 모델)
   ============================================================ */

/* ---------------- 상수 ---------------- */
// 모드별 문항 수·면접 시간 선택 범위 (면접 연습 설정에서 조절 가능)
const MODE_CFG = {
  passage:  { qMin: 2, qMax: 3, qDefault: 3, tMin: 10, tMax: 15, tDefault: 12 },
  document: { qMin: 4, qMax: 6, qDefault: 5, tMin: 8,  tMax: 10, tDefault: 9  },
};

const PASSAGE_CATS = ['타당성', '논리적전개', '종합적사고력'];
const DOC_CATS = ['전공적합성', '진로역량', '발전가능성', '인성및공동체역량', '의사소통능력'];

/* ---------------- 상태 ---------------- */
const S = {
  view: 'setup',
  unis: [],
  univ: null,
  dept: null,
  mode: null, // 'passage' | 'document'

  questions: [],
  qIndex: 0,
  scores: [],   // [{ total, feedback, scores: { cat: {grade,score,max,comment} } }]
  passage: '',
  recordText: { value: '' }, // 서류 면접: 생기부 추출/수정 텍스트 (DOM el.recordText와 동기화)
  followupQ: null, // 서류 면접: 현재 꼬리질문 텍스트

  qCount: MODE_CFG.passage.qDefault, // 선택한 문항 수 (setMode에서 모드별 초기화)
  totalMin: MODE_CFG.passage.tDefault, // 선택한 면접 시간(분) (setMode에서 모드별 초기화)

  followupActive: false,
  ttsOn: loadTtsPref(),

  timer: { id: null, left: 0 },
  phase: 'idle',   // idle | ready | listening | thinking
  busy: false,
  timerExpired: false,

  /* 계정·기록 */
  token: '',
  username: '',
  compBusy: false,      // 종합 피드백 생성 중 여부
  transcript: [],       // [{question, answer, followupQ, followupAnswer, score}]
  comprehensive: null,  // {overall, strengths, weaknesses, advice, questions:[{intent,betterAnswer}]}
  viewRecordsData: [],  // 내 기록 목록 캐시
  currentRecord: null,  // 다시 보기 중인 기록
};

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const el = {
  viewSetup: $('view-setup'),
  viewInterview: $('view-interview'),
  viewEnd: $('view-end'),
  viewScore: $('view-score'),
  viewRecords: $('view-records'),
  viewRecord: $('view-record'),

  hdrMeta: $('hdr-meta'),
  ttsChk: $('tts-chk'),

  viewLogin: $('view-login'),
  logoutMsg: $('logout-msg'),
  userChip: $('user-chip'),
  userName: $('user-name'),
  btnMyRecords: $('btn-my-records'),
  btnLogout: $('btn-logout'),

  searchUniv: $('search-univ'),
  searchDept: $('search-dept'),
  univCount: $('univ-count'),
  deptCount: $('dept-count'),
  selUniv: $('sel-univ'),
  selDept: $('sel-dept'),
  recordField: $('record-field'),
  dropZone: $('drop-zone'),
  recordFile: $('record-file'),
  recordMeta: $('record-meta'),
  recordFname: $('record-fname'),
  btnRecordClear: $('btn-record-clear'),
  recordText: $('record-text'),
  recordCharcnt: $('record-charcnt'),
  qtimeField: $('qtime-field'),
  qCount: $('q-count'),
  qRange: $('q-range'),
  tMin: $('t-min'),
  tRange: $('t-range'),
  btnQMinus: $('btn-q-minus'),
  btnQPlus: $('btn-q-plus'),
  btnTMinus: $('btn-t-minus'),
  btnTPlus: $('btn-t-plus'),
  btnStart: $('btn-start'),
  startHint: $('start-hint'),

  timer: $('timer'),
  progress: $('progress'),
  passagePanel: $('passage-panel'),
  passageText: $('passage-text'),
  btnReplayPassage: $('btn-replay-passage'),

  chat: $('chat'),
  micBtn: $('mic-btn'),
  micLabel: $('mic-label'),
  answerBox: $('answer-box'),
  answerText: $('answer-text'),
  btnRetryMic: $('btn-retry-mic'),
  btnSubmit: $('btn-submit'),

  btnScore: $('btn-score'),
  btnRetry: $('btn-retry'),
  btnHome: $('btn-home'),

  scoreTitle: $('score-title'),
  gauge: $('gauge'),
  finalScore: $('final-score'),
  scoreGrade: $('score-grade'),
  scoreFeedback: $('score-feedback'),
  qScores: $('q-scores'),
  catScores: $('cat-scores'),
  catTitle: $('cat-title'),
  disposition: $('disposition'),
  weightsNote: $('weights-note'),
  compSection: $('comp-section'),
  compBody: $('comp-body'),
  compLoading: $('comp-loading'),
  trvSection: $('trv-section'),
  trvBody: $('trv-body'),
  trvLoading: $('trv-loading'),
  btnSaveRecord: $('btn-save-record'),

  viewRecords: $('view-records'),
  recordsList: $('records-list'),
  recordsEmpty: $('records-empty'),
  btnRecordsBack: $('btn-records-back'),
  btnBackup: $('btn-backup'),
  btnRestore: $('btn-restore'),
  restoreFile: $('restore-file'),

  viewRecord: $('view-record'),
  recvTitle: $('recv-title'),
  recvGauge: $('recv-gauge'),
  recvFinal: $('recv-final'),
  recvGrade: $('recv-grade'),
  recvFeedback: $('recv-feedback'),
  recvQScores: $('recv-q-scores'),
  recvCatScores: $('recv-cat-scores'),
  recvCatTitle: $('recv-cat-title'),
  recvDisposition: $('recv-disposition'),
  recvWeightsNote: $('recv-weights-note'),
  recvComp: $('recv-comp'),
  recvCompBody: $('recv-comp-body'),
  recvTrv: $('recv-trv'),
  recvTrvBody: $('recv-trv-body'),
  btnRecordDelete: $('btn-record-delete'),
  btnRecordsAgain: $('btn-records-again'),
  btnRecordsBack2: $('btn-records-back2'),

  authTitle: $('auth-title'),
  authTabs: document.querySelectorAll('.auth-tab'),
  authForm: $('auth-form'),
  authUsername: $('auth-username'),
  authPassword: $('auth-password'),
  fldPassword: $('fld-password'),
  fldRecovery: $('fld-recovery'),
  authRecovery: $('auth-recovery'),
  authMsg: $('auth-msg'),
  authSubmit: $('auth-submit'),
  registerNote: $('register-note'),
  resetNote: $('reset-note'),

  rcModal: $('rc-modal'),
  rcCode: $('rc-code'),
  rcCopy: $('rc-copy'),
  rcDownload: $('rc-download'),
  rcConfirm: $('rc-confirm'),

  toast: $('toast'),
};

/* ---------------- 유틸 ---------------- */
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.className = 'toast' + (isError ? ' error' : '');
  el.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.toast.hidden = true; }, 3400);
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- 계정 인증 ---------------- */

const TOKEN_KEY = 'ai_interview_token';

function loadToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function saveToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '요청에 실패했습니다.');
  return data;
}

let authTab = 'login';

function openAuth(tab = 'login') {
  authTab = tab;
  switchView('login');
  syncAuthTab();
  setTimeout(() => el.authUsername.focus(), 60);
}

function syncAuthTab() {
  const isLogin = authTab === 'login';
  const isReset = authTab === 'reset';
  el.authTabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === authTab));
  el.authTitle.textContent = isLogin ? '로그인' : authTab === 'register' ? '회원가입' : '비밀번호 찾기';
  el.authSubmit.textContent = isLogin ? '로그인' : authTab === 'register' ? '가입하기' : '비밀번호 재설정';
  el.fldPassword.hidden = isReset;
  el.fldRecovery.hidden = !isReset;
  el.registerNote.hidden = authTab !== 'register';
  el.resetNote.hidden = authTab !== 'reset';
  el.authMsg.textContent = '';
  el.authPassword.placeholder = isReset ? '새 비밀번호 (4~64자)' : '4~64자';
  el.authRecovery.value = '';
}

async function submitAuth(e) {
  e.preventDefault();
  const username = el.authUsername.value.trim();
  const password = el.authPassword.value;
  const recovery = el.authRecovery.value.trim().toUpperCase();
  if (!username) { el.authMsg.textContent = '아이디를 입력해 주세요.'; return; }
  if (!password) { el.authMsg.textContent = '비밀번호를 입력해 주세요.'; return; }
  if (authTab === 'reset' && !recovery) { el.authMsg.textContent = '복구 코드를 입력해 주세요.'; return; }
  el.authMsg.textContent = '';
  el.authSubmit.disabled = true;
  try {
    if (authTab === 'register') {
      const r = await api('/api/register', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (!r.recoveryCode) throw new Error('복구 코드를 받지 못했습니다. 다시 시도해 주세요.');
      setSession(r.token, r.username);
      switchView('setup');
      showRecoveryCode(r.recoveryCode);
    } else if (authTab === 'reset') {
      const r = await api('/api/reset-password', { method: 'POST', body: JSON.stringify({ username, recoveryCode: recovery, newPassword: password }) });
      setSession(r.token, r.username);
      switchView('setup');
      toast('비밀번호가 재설정되고 로그인되었습니다.');
    } else {
      const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      setSession(r.token, r.username);
      switchView('setup');
      toast(`${r.username}님, 로그인되었습니다.`);
    }
  } catch (err) {
    el.authMsg.textContent = err.message;
  } finally {
    el.authSubmit.disabled = false;
  }
}

function setSession(token, username) {
  S.token = token;
  S.username = username;
  saveToken(token);
  updateAuthUI();
}

function logout() {
  api('/api/logout', { method: 'POST', body: '{}' }).catch(() => {});
  S.token = '';
  S.username = '';
  saveToken('');
  updateAuthUI();
  resetInterview(true);
  switchView('login');
  el.logoutMsg.hidden = false;
  toast('로그아웃되었습니다.');
}

function updateAuthUI() {
  const logged = !!S.token;
  el.userChip.hidden = !logged;
  if (logged) el.userName.textContent = S.username;
}

async function restoreSession() {
  const token = loadToken();
  if (!token) { updateAuthUI(); switchView('login'); return; }
  S.token = token;
  try {
    const me = await api('/api/me');
    S.username = me.username;
  } catch {
    S.token = '';
    saveToken('');
  }
  updateAuthUI();
  switchView(S.username ? 'setup' : 'login');
}

function showRecoveryCode(code) {
  el.rcCode.textContent = code;
  el.rcModal.hidden = false;
}

function downloadRecoveryCode() {
  const text = [
    'AI 면접 연습실 — 계정 복구 코드',
    '',
    '아이디: ' + S.username,
    '복구 코드: ' + el.rcCode.textContent,
    '',
    '이 코드는 아이디/비밀번호를 잊었을 때 계정을 복구하는 유일한 방법입니다.',
    '안전한 곳에 보관하세요.',
  ].join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ai-interview-recovery-' + S.username + '.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- LLM 호출 (server.js 경유) ---------------- */
async function callLLM(prompt, model = 'interviewer') {
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'LLM 요청 실패');
  return data.result;
}

/* ================= 프롬프트 구성 (prompts/ 스키마 준수) ================= */

function weightsOf() {
  return (S.dept && S.dept.weights) || { '전공적합성': 25, '진로역량': 25, '발전가능성': 20, '인성및공동체역량': 15, '의사소통능력': 15 };
}

function passageStartPrompt() {
  const qExample = Array.from({ length: S.qCount }, (_, i) => `"질문${i + 1}"`).join(',');
  return `당신은 한국 대학 입시 제시문 면접관이다. ${S.univ.name} ${S.dept.name} 면접을 진행한다.
이 학과에서 실제로 자주 출제되는 주제와 유사한 제시문을 하나 제시하고, 그에 기반한 면접 질문 ${S.qCount}개를 생성하라.

참고 대표 제시문: ${S.dept.passage}
모범답안 힌트: ${S.dept.modelAnswerHint || '없음'}

규칙:
- 제시문은 3~5문장 분량의 논제문 형태로, ${S.dept.name}에 어울리는 주제
- 질문은 제시문의 핵심 주제·탐구력·종합적 사고를 묻되 ${S.dept.name} 특성이 드러나도록
- 질문 ${S.qCount}개를 정확히 생성
- 각 질문은 2~3문장, 한국어

다음 JSON만 출력하라 (추가 텍스트 금지):
{"intro":"면접 시작 인사말 (2문장)","passage":"제시문 본문","questions":[${qExample}]}`;
}

function passageScorePrompt(question, answer) {
  return `당신은 한국 대학 입시 제시문 면접 평가자다.
대학: ${S.univ.name}, 학과: ${S.dept.name}
제시문: ${S.passage || S.dept.passage}
질문: ${question}
지원자 답변: ${answer}
대학 모범답안 힌트: ${S.dept.modelAnswerHint || '없음'}

제시문 면접 채점기준표 (100점):
- 타당성 (40점): 답변이 제시문 주제와 질문 의도에 부합하는가
- 논리적 전개 (30점): 주장→근거→결론의 논리 구조가 명확한가
- 종합적 사고력 (30점): 여러 관점을 고려하고 창의적·심화 통찰이 있는가

등급 규칙: A=만점, B=만점의 80%, C=만점의 60%, D=만점의 40%, F=만점의 20%. score는 등급 기준으로 산출하라.
답변이 한 문장 미만이면 D 이하, 빈 답변이면 F. 모범답안 힌트와 비교해 객관적으로 채점하라.

다음 JSON만 출력하라 (추가 텍스트 금지):
{"scores":{"타당성":{"grade":"A","score":40,"comment":"한 줄 코멘트"},"논리적전개":{"grade":"B","score":24,"comment":"한 줄 코멘트"},"종합적사고력":{"grade":"A","score":30,"comment":"한 줄 코멘트"}},"total":94,"feedback":"종합 피드백 (2~3문장)"}`;
}

function docStartPrompt() {
  const w = weightsOf();
  const qExample = Array.from({ length: S.qCount }, (_, i) => `{"question":"질문${i + 1}","basedOn":"근거 항목"}`).join(',');
  return `당신은 한국 대학 입시 서류 기반 면접관이다. ${S.univ.name} ${S.dept.name} 지원자의 학교생활기록부를 분석하고 면접 질문 ${S.qCount}개를 생성하라.

[학교생활기록부]
${S.recordText.value}

[채점 역량 반영 비율 — 고르게 질문하라]
- 전공적합성 ${w['전공적합성']}%
- 진로역량 ${w['진로역량']}%
- 발전가능성 ${w['발전가능성']}%
- 인성및공동체역량 ${w['인성및공동체역량']}%
- 의사소통능력 ${w['의사소통능력']}%

규칙:
- 생기부의 구체적 근거(수상·활동·세특·진로희망 등)에서 유래한 질문으로
- 질문 ${S.qCount}개를 정확히 생성
- 각 질문은 2~3문장, 한국어

다음 JSON만 출력하라 (추가 텍스트 금지):
{"analysis":"생기부 핵심 분석 요약 (2~3문장)","questions":[${qExample}]}`;
}

function docFollowupPrompt(question, answer) {
  return `당신은 한국 대학 입시 서류 기반 면접관이다. 지원자의 답변을 듣고 꼬리질문 1개를 반드시 생성하라.

대학: ${S.univ.name}, 학과: ${S.dept.name}

[학교생활기록부]
${S.recordText.value}

직전 질문: ${question}
지원자 답변: ${answer}

규칙:
- 꼬리질문은 필수이며 정확히 1개만 생성
- 답변의 핵심 키워드·논리 허점·심화 포인트를 파고들 것
- 생기부 내용과 연결한 구체적·개인화된 질문
- 답변이 모호하면 구체적 예시를 요청하고, 잘 정리됐으면 한 단계 심화
- 2~3문장, 한국어

다음 JSON만 출력하라 (추가 텍스트 금지):
{"question":"꼬리질문","reason":"왜 이 꼬리질문을 했는지 (짧게)"}`;
}

function docScorePrompt(main, answer, followup, followupAnswer) {
  const w = weightsOf();
  return `당신은 한국 대학 입시 서류 기반 면접 평가자다. ${S.univ.name} ${S.dept.name} 지원자의 답변을 대학별 반영 비율에 따라 5개 역량을 A~F로 채점하고 환산 점수로 합산하라.

[학교생활기록부]
${S.recordText.value}

질문: ${main}
지원자 첫 답변: ${answer}
꼬리질문: ${followup || '없음'}
꼬리질문 답변: ${followupAnswer || '없음'}

[해당 학과 교수 평가 성향 참고]
${S.dept.disposition || '평가 성향 정보가 없어 표준 기준을 적용한다.'}

[역량별 배점 (합계 100)]
전공적합성: ${w['전공적합성']}점
진로역량: ${w['진로역량']}점
발전가능성: ${w['발전가능성']}점
인성및공동체역량: ${w['인성및공동체역량']}점
의사소통능력: ${w['의사소통능력']}점

등급 환산: A=100, B=90, C=80, D=70, E=60, F=50. 각 역량 score = (환산값/100) × 배점(정수 반올림). total은 5개 score의 합(0~100).
생기부 근거 활동과 답변을 종합하고, 교수 평가 성향을 감안해 객관적으로 채점하라.

다음 JSON만 출력하라 (추가 텍스트 금지):
{"scores":{"전공적합성":{"grade":"A","score":25,"comment":"한 줄 코멘트"},"진로역량":{"grade":"B","score":23,"comment":"한 줄 코멘트"},"발전가능성":{"grade":"A","score":20,"comment":"한 줄 코멘트"},"인성및공동체역량":{"grade":"B","score":14,"comment":"한 줄 코멘트"},"의사소통능력":{"grade":"A","score":15,"comment":"한 줄 코멘트"}},"total":97,"feedback":"종합 피드백 (2~3문장)"}`;
}

/* ================= TTS (음성 출력) ================= */

function loadTtsPref() {
  try { return localStorage.getItem('tts') !== 'off'; } catch { return true; }
}
function saveTtsPref(on) {
  try { localStorage.setItem('tts', on ? 'on' : 'off'); } catch {}
}
function cleanForSpeech(t) {
  return t.replace(/[#*`>_~]/g, '').replace(/\s+/g, ' ').trim();
}
function koVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const ko = vs.filter((v) => /^ko/i.test(v.lang));
  return ko.find((v) => /yuna|유나|yujeong|sinji|sora|heami|kyuri|보람/i.test(v.name)) || ko[0] || null;
}
function speak(text, onend) {
  if (!S.ttsOn || !('speechSynthesis' in window)) return;
  stopSpeak();
  const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
  u.lang = 'ko-KR';
  u.rate = 1.02;
  const v = koVoice();
  if (v) u.voice = v;
  u.onend = () => { if (typeof onend === 'function') onend(); };
  speechSynthesis.speak(u);
}
function stopSpeak() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

/* ================= STT (마이크 인식) ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let listening = false;
let finalTranscript = '';

function startListen() {
  stopSpeak();
  if (S.busy) return;
  if (!SR) {
    toast('이 브라우저는 음성 인식을 지원하지 않습니다. 직접 입력해 주세요.');
    revealAnswerBox();
    return;
  }
  try { rec = new SR(); } catch { toast('음성 인식을 시작할 수 없습니다.'); revealAnswerBox(); return; }

  rec.lang = 'ko-KR';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
    let interim = '';
    let fin = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) fin += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (fin) finalTranscript += fin;
    const shown = (finalTranscript + (interim ? ' ' + interim : '')).trim();
    if (shown) {
      revealAnswerBox();
      el.answerText.value = shown;
    }
    enableSubmit(!!finalTranscript.trim());
  };
  rec.onend = () => {
    listening = false;
    updateMicUI();
    if (!finalTranscript.trim()) {
      toast('음성이 감지되지 않았습니다. 다시 시도하거나 직접 입력하세요.');
      revealAnswerBox();
    }
  };
  rec.onerror = (e) => {
    listening = false;
    updateMicUI();
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      toast('마이크 권한이 거부되었습니다. 브라우저 설정에서 허용한 뒤 다시 시도하거나 직접 입력하세요.', true);
      revealAnswerBox();
    } else if (e.error === 'no-speech') {
      toast('음성이 감지되지 않았습니다.');
      revealAnswerBox();
    } else if (e.error === 'audio-capture') {
      toast('마이크 장치를 찾을 수 없습니다. 직접 입력해 주세요.', true);
      revealAnswerBox();
    }
  };

  finalTranscript = '';
  el.answerText.value = '';
  el.answerText.placeholder = '듣는 중... 말씀해 주세요.';
  revealAnswerBox();
  rec.start();
  listening = true;
  updateMicUI();
}

function stopListen() {
  if (rec) { try { rec.stop(); } catch {} }
  listening = false;
  updateMicUI();
}

function updateMicUI() {
  el.micBtn.classList.toggle('listening', listening);
  el.micBtn.disabled = S.busy || !(S.phase === 'ready');
  if (listening) {
    el.micLabel.classList.add('listening');
    el.micLabel.textContent = '듣는 중... 마이크를 다시 누르면 종료됩니다';
  } else {
    el.micLabel.classList.remove('listening');
    el.micLabel.innerHTML = S.phase === 'thinking'
      ? '면접관이 듣고 있어요...'
      : '면접관 질문이 나오면<br />마이크를 눌러 답변하세요';
  }
}

/* ================= 채팅 렌더링 ================= */

function addBot(text, opt = {}) {
  if (opt.speakIt) speak(text);
  const msg = document.createElement('div');
  msg.className = 'msg bot';
  let head = '';
  if (opt.tag) {
    head = `<div class="bubble-top"><span class="q-tag">${esc(opt.tag)}</span>
      <button class="replay" type="button" title="다시 듣기">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>
      </button></div>`;
  }
  msg.innerHTML = `<div class="avatar">AI</div>
    <div class="bubble">${head}<div class="b-text"></div></div>`;
  msg.querySelector('.b-text').textContent = text;
  if (opt.sub) {
    const sub = document.createElement('div');
    sub.className = 'hint';
    sub.style.cssText = 'margin-top:6px;font-size:12px;';
    sub.textContent = opt.sub;
    msg.querySelector('.bubble').appendChild(sub);
  }
  msg.querySelector('.replay')?.addEventListener('click', () => speak(text));
  el.chat.appendChild(msg);
  scrollChat();
  return msg;
}

function addUser(text) {
  const msg = document.createElement('div');
  msg.className = 'msg user';
  msg.innerHTML = `<div class="avatar">나</div><div class="bubble"></div>`;
  msg.querySelector('.bubble').textContent = text;
  el.chat.appendChild(msg);
  scrollChat();
}

function addSystem(text, cls = '') {
  const msg = document.createElement('div');
  msg.className = 'msg system' + (cls ? ' ' + cls : '');
  msg.innerHTML = `<div class="bubble"></div>`;
  msg.querySelector('.bubble').textContent = text;
  el.chat.appendChild(msg);
  scrollChat();
}

function addTyping() {
  const msg = document.createElement('div');
  msg.className = 'msg bot';
  msg.innerHTML = `<div class="avatar">AI</div><div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  el.chat.appendChild(msg);
  scrollChat();
  return msg;
}
function removeMsg(m) { if (m && m.parentNode) m.parentNode.removeChild(m); }

function scrollChat() {
  el.chat.scrollTop = el.chat.scrollHeight;
}

/* ================= 뷰 전환 ================= */

function switchView(name) {
  S.view = name;
  el.viewLogin.hidden = name !== 'login';
  el.viewSetup.hidden = name !== 'setup';
  el.viewInterview.hidden = name !== 'interview';
  el.viewEnd.hidden = name !== 'end';
  el.viewScore.hidden = name !== 'score';
  el.viewRecords.hidden = name !== 'records';
  el.viewRecord.hidden = name !== 'record';
  el.hdrMeta.hidden = name === 'setup' || name === 'login';
}

/* ================= 세팅 ================= */

async function loadUniversities() {
  try {
    const res = await fetch('/api/universities');
    const data = await res.json();
    if (!data || !Array.isArray(data.universities)) throw new Error('대학 데이터 형식 오류');
    S.unis = data.universities;
    let totalDepts = 0;
    for (const u of S.unis) totalDepts += u.departments.length;
    el.univCount.textContent = S.unis.length + '개 대학 (' + totalDepts + '개 학과)';
    for (const u of S.unis) {
      const o = document.createElement('option');
      o.value = u.id; o.textContent = u.name + ' (' + u.departments.length + '개 학과)';
      el.selUniv.appendChild(o);
    }
  } catch (e) {
    el.startHint.textContent = '대학 데이터를 불러오지 못했습니다. ' + e.message;
    el.startHint.style.color = 'var(--danger)';
    toast('대학 데이터 로드 실패 — server.js가 실행 중인지 확인하세요 (' + e.message + ')', true);
    el.btnStart.disabled = true;
  }
}

function onUnivChange() {
  const u = S.unis.find((x) => x.id === el.selUniv.value);
  S.univ = u || null;
  S.dept = null;
  el.selDept.innerHTML = '<option value="">' + (u ? '학과를 선택하세요' : '대학을 먼저 선택하세요') + '</option>';
  el.selDept.disabled = !u;
  el.searchDept.disabled = !u;
  el.searchDept.value = '';
  if (u) {
    filterDepts('');
    el.deptCount.textContent = u.departments.length + '개 학과';
  } else {
    el.deptCount.textContent = '';
  }
  updateStart();
}

function onDeptChange() {
  S.dept = (S.univ && S.univ.departments.find((d) => d.id === el.selDept.value)) || null;
  updateStart();
}

function setMode(mode) {
  S.mode = mode;
  document.querySelectorAll('.mode-card').forEach((c) => c.classList.toggle('active', c.dataset.mode === mode));
  el.recordField.hidden = mode !== 'document';
  el.qtimeField.hidden = !mode;
  if (mode && MODE_CFG[mode]) {
    S.qCount = MODE_CFG[mode].qDefault;
    S.totalMin = MODE_CFG[mode].tDefault;
  }
  syncQTimeUI();
  updateStart();
}

/* ---- 문항 수 · 면접 시간 스테퍼 ---- */

function syncQTimeUI() {
  const cfg = MODE_CFG[S.mode];
  if (!cfg) return;
  el.qCount.textContent = S.qCount;
  el.qRange.textContent = `${cfg.qMin}~${cfg.qMax}문항`;
  el.tMin.textContent = S.totalMin;
  el.tRange.textContent = `${cfg.tMin}~${cfg.tMax}분`;
  el.btnQMinus.disabled = S.qCount <= cfg.qMin;
  el.btnQPlus.disabled = S.qCount >= cfg.qMax;
  el.btnTMinus.disabled = S.totalMin <= cfg.tMin;
  el.btnTPlus.disabled = S.totalMin >= cfg.tMax;
}

function adjustQTime(kind, delta) {
  const cfg = MODE_CFG[S.mode];
  if (!cfg) return;
  if (kind === 'q') S.qCount = Math.min(cfg.qMax, Math.max(cfg.qMin, S.qCount + delta));
  else S.totalMin = Math.min(cfg.tMax, Math.max(cfg.tMin, S.totalMin + delta));
  syncQTimeUI();
}

function updateStart() {
  const ok = S.univ && S.dept && S.mode;
  el.btnStart.disabled = !ok;
  if (ok && S.mode === 'document' && S.recordText.value.trim().length < 50) {
    el.btnStart.disabled = true;
    el.startHint.textContent = '서류 기반 면접은 생기부 파일을 첨부해 50자 이상 텍스트가 추출되어야 시작할 수 있습니다.';
    el.startHint.style.color = 'var(--warn)';
    return;
  }
  el.startHint.textContent = ok
    ? '면접을 시작하면 타이머가 즉시 시작됩니다.'
    : '대학 · 학과 · 면접 유형을 선택하면 시작할 수 있습니다.';
  el.startHint.style.color = '';
}

/* ================= 생기부 파일 첨부 ================= */

function b64FromBuffer(buf) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function handleRecordFile(file) {
  if (!file) return;
  const okExt = /\.(html?|txt|pdf|docx)$/i;
  if (!okExt.test(file.name)) {
    toast('지원하지 않는 형식입니다. HTML/PDF/DOCX/TXT 파일을 첨부하세요.', true);
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    toast('파일이 너무 큽니다 (10MB 이하).', true);
    return;
  }
  if (S.busy) return;
  S.busy = true;
  el.recordText.disabled = true;
  el.recordCharcnt.textContent = '텍스트 추출 중...';
  el.dropZone.classList.add('busy');
  try {
    const data = b64FromBuffer(new Uint8Array(await file.arrayBuffer()));
    const res = await fetch('/api/extract-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, data }),
    });
    const r = await res.json();
    if (!r.ok || typeof r.text !== 'string' || !r.text.trim()) {
      throw new Error(r.error || '텍스트 추출에 실패했습니다.');
    }
    S.recordText.value = r.text;
    el.recordText.value = r.text;
    el.recordText.disabled = false;
    el.recordMeta.hidden = false;
    el.recordFname.textContent = file.name;
    el.recordCharcnt.textContent = `추출 완료 · ${r.chars.toLocaleString()}자 (${String(r.source).toUpperCase()}) · 아래에서 수정할 수 있습니다.`;
    toast('생기부 텍스트 추출 완료');
  } catch (e) {
    el.recordCharcnt.textContent = '추출 실패. ' + e.message;
    toast(e.message, true);
  } finally {
    S.busy = false;
    el.dropZone.classList.remove('busy');
    el.recordFile.value = '';
    updateStart();
  }
}

/* ================= 타이머 ================= */

// LLM 준비 시간(thinking/busy)은 면접 시간에서 제외 — 실제 활동(질문 확인·답변) 중에만 카운트
function timerShouldTick() {
  return S.phase === 'ready' && !S.busy;
}

function startTimer(totalSec) {
  S.timer.left = totalSec;
  renderTimer();
  clearInterval(S.timer.id);
  S.timer.id = setInterval(() => {
    if (!timerShouldTick()) return;
    S.timer.left--;
    if (S.timer.left <= 0) {
      S.timer.left = 0;
      clearInterval(S.timer.id);
      S.timerExpired = true;
      el.timer.classList.remove('warn', 'danger');
      if (!S.busy) {
        addSystem('면접 시간이 종료되었습니다.');
        finalize();
      }
    }
    renderTimer();
  }, 1000);
}

function renderTimer() {
  const m = String(Math.floor(S.timer.left / 60)).padStart(2, '0');
  const s = String(S.timer.left % 60).padStart(2, '0');
  el.timer.textContent = `${m}:${s}`;
  el.timer.classList.toggle('warn', S.timer.left <= 60 && S.timer.left > 30);
  el.timer.classList.toggle('danger', S.timer.left <= 30 && S.timer.left > 0);
}

function clearTimer() {
  clearInterval(S.timer.id);
  S.timer.id = null;
  el.timer.classList.remove('warn', 'danger');
}

/* ================= 면접 진행 ================= */

async function startInterview() {
  if (S.busy) return;
  if (S.mode === 'document' && S.recordText.value.trim().length < 50) {
    toast('생기부 내용을 50자 이상 입력해 주세요.');
    return;
  }

  S.questions = [];
  S.qIndex = 0;
  S.scores = [];
  S.passage = '';
  S.followupActive = false;
  S.followupQ = null;
  S.timerExpired = false;
  S.transcript = [];
  S.comprehensive = null;
  S.compBusy = false;
  el.compSection.hidden = true;
  el.trvSection.hidden = true;
  el.btnSaveRecord.hidden = true;

  switchView('interview');
  el.hdrMeta.textContent = `${S.univ.name} · ${S.dept.name} · ${S.mode === 'passage' ? '제시문 면접' : '서류 기반 면접'}`;
  el.chat.innerHTML = '';
  el.passagePanel.hidden = true;
  el.answerBox.hidden = true;
  el.micLabel.innerHTML = '면접을 준비하고 있어요...';

  startTimer(S.totalMin * 60);
  setPhase('thinking');

  const ty = addTyping();
  try {
    if (S.mode === 'passage') {
      const r = await callLLM(passageStartPrompt());
      removeMsg(ty);
      S.passage = String(r.passage || S.dept.passage || '');
      el.passageText.textContent = S.passage;
      el.passagePanel.hidden = false;
      addBot(String(r.intro || `${S.univ.name} ${S.dept.name} 면접에 오신 것을 환영합니다.`), { tag: '면접관', speakIt: true });
      const qs = Array.isArray(r.questions) ? r.questions : [];
      if (!qs.length) throw new Error('면접관이 질문을 생성하지 못했습니다.');
      S.questions = qs.slice(0, S.qCount);
      if (S.ttsOn) {
        speak(S.passage, () => { if (!S.timerExpired && S.ttsOn) speak(String(S.questions[0])); });
        askQuestion(0, { speakIt: false });
      } else {
        askQuestion(0, { speakIt: true });
      }
    } else {
      const r = await callLLM(docStartPrompt());
      removeMsg(ty);
      addBot(String(r.analysis || '생기부를 분석했습니다.'), { tag: '면접관 분석', speakIt: true });
      const qs = Array.isArray(r.questions) ? r.questions : [];
      if (!qs.length) throw new Error('면접관이 질문을 생성하지 못했습니다.');
      S.questions = qs.slice(0, S.qCount);
      askQuestion(0);
    }
  } catch (e) {
    removeMsg(ty);
    addSystem('오류: ' + e.message, 'error');
    addBot('잠시 후 다시 시도해 주세요. 아직 대기 중이라면 브라우저를 새로고침하세요.', {});
    setPhase('ready');
  }
}

function askQuestion(i, opt) {
  S.qIndex = i;
  const raw = S.questions[i];
  const text = typeof raw === 'string' ? raw : (raw && (raw.question || raw.text)) || '';
  const basedOn = typeof raw === 'object' && raw ? (raw.basedOn || '') : '';
  updateProgress();
  addBot(text, {
    tag: S.mode === 'passage' ? `문항 ${i + 1}` : `문항 ${i + 1}`,
    sub: basedOn ? '〔생기부 근거: ' + basedOn + '〕' : '',
    speakIt: !opt || opt.speakIt !== false,
  });
  setPhase('ready');
}

function updateProgress() {
  el.progress.textContent = `문항 ${Math.min(S.qIndex + 1, S.questions.length)}/${S.questions.length}`;
}

function setPhase(p) {
  S.phase = p;
  if (p === 'ready' || p === 'thinking') updateMicUI();
  if (p === 'ready') {
    el.micLabel.innerHTML = '면접관 질문이 나오면<br />마이크를 눌러 답변하세요';
    el.answerBox.hidden = true;
    el.answerText.value = '';
    enableSubmit(false);
    finalTranscript = '';
  }
}

function revealAnswerBox() {
  el.answerBox.hidden = false;
  el.answerText.focus();
}
function enableSubmit(on) {
  el.btnSubmit.disabled = !on;
}

/* ---- 제출 ----- */

let pendingMain = null; // 서류 면접: 1차 답변 보관 {question, answer}

async function submitAnswer() {
  if (S.busy) return;
  if (!S.questions.length) { toast('먼저 면접을 시작해 주세요.'); return; }
  const text = el.answerText.value.trim();
  if (!text) { toast('답변을 입력해 주세요.'); return; }

  stopSpeak();
  el.answerBox.hidden = true;
  el.answerText.value = '';
  finalTranscript = '';
  addUser(text);

  if (S.mode === 'document') {
    if (!S.followupActive) {
      pendingMain = { question: typeof S.questions[S.qIndex] === 'string' ? S.questions[S.qIndex] : S.questions[S.qIndex].question, answer: text };
      await doFollowup();
      return;
    }
    const main = pendingMain;
    const fuAnswer = text;
    pendingMain = null;
    S.followupActive = false;
    await scoreAndAdvance(main, fuAnswer);
    return;
  }

  await scoreAndAdvance({ question: S.questions[S.qIndex], answer: text });
}

async function doFollowup() {
  setPhase('thinking');
  const ty = addTyping();
  try {
    const r = await callLLM(docFollowupPrompt(pendingMain.question, pendingMain.answer));
    removeMsg(ty);
    S.followupActive = true;
    S.followupQ = String(r.question || '');
    if (!S.followupQ) throw new Error('꼬리질문이 비어 있습니다.');
    addBot(S.followupQ, { tag: '꼬리질문', speakIt: true });
    setPhase('ready');
  } catch (e) {
    removeMsg(ty);
    addSystem('꼬리질문 생성에 실패해 이 답변으로 채점을 진행합니다. (' + e.message + ')', 'error');
    S.followupActive = false;
    const main = pendingMain;
    pendingMain = null;
    await scoreAndAdvance(main, null);
  }
}

async function scoreAndAdvance(main, followupAnswer) {
  setPhase('thinking');
  const ty = addTyping();
  try {
    const result = S.mode === 'passage'
      ? await callLLM(passageScorePrompt(main.question, main.answer))
      : await callLLM(docScorePrompt(main.question, main.answer, S.followupQ, followupAnswer));
    removeMsg(ty);

    const sc = normalizeScore(result, S.mode);
    S.scores[S.qIndex] = sc;
    S.transcript[S.qIndex] = {
      question: main.question,
      answer: main.answer,
      followupQ: S.followupQ,
      followupAnswer: followupAnswer || null,
      score: sc,
    };

    addSystem(`문항 ${S.qIndex + 1} 채점 완료 · ${sc.total}점`, 'score');
    if (sc.feedback) addBot(sc.feedback, {});

    const next = S.qIndex + 1;
    if (next < S.questions.length) {
      askQuestion(next);
    } else {
      if (S.timerExpired && !S.busy) addSystem('면접 시간이 종료되었습니다.');
      await finalize();
    }
  } catch (e) {
    removeMsg(ty);
    addSystem('채점 중 오류가 발생했습니다: ' + e.message, 'error');
    addBot('답변을 다시 시도해 주세요.', {});
    S.followupActive = false;
    pendingMain = null;
    setPhase('ready');
  }
}

/* ---- 채점 정규화 & 집계 ---- */

function normalizeScore(result, mode) {
  const raw = (result && typeof result.scores === 'object') ? result.scores : {};
  const cats = mode === 'passage' ? PASSAGE_CATS : DOC_CATS;
  const scores = {};
  for (const key of cats) {
    const foundKey = Object.keys(raw).find((k) => k.replace(/\s/g, '') === key.replace(/\s/g, ''));
    const c = foundKey ? raw[foundKey] : {};
    scores[key] = {
      grade: String(c.grade || 'F').toUpperCase(),
      score: Number(c.score) || 0,
      max: Number(c.max) || 0,
      comment: String(c.comment || ''),
    };
  }
  const total = Math.min(100, Math.max(0, Math.round(Number(result.total) || 0)));
  return { total, feedback: String(result.feedback || ''), scores };
}

function gradeFromRatio(ratio, mode) {
  if (mode === 'document') {
    if (ratio >= 0.95) return 'A';
    if (ratio >= 0.85) return 'B';
    if (ratio >= 0.75) return 'C';
    if (ratio >= 0.65) return 'D';
    if (ratio >= 0.55) return 'E';
    return 'F';
  }
  if (ratio >= 0.9) return 'A';
  if (ratio >= 0.7) return 'B';
  if (ratio >= 0.5) return 'C';
  if (ratio >= 0.3) return 'D';
  return 'F';
}

function computeAggregates(scores = S.scores, mode = S.mode) {
  const n = scores.length;
  const cats = mode === 'passage' ? PASSAGE_CATS : DOC_CATS;
  const agg = {};
  for (const key of cats) {
    let s = 0, m = 0;
    for (const sc of scores) {
      s += sc.scores[key] ? sc.scores[key].score : 0;
      m += sc.scores[key] ? sc.scores[key].max : 0;
    }
    const avgScore = n ? s / n : 0;
    const avgMax = n ? m / n : 0;
    agg[key] = { avgScore, avgMax, ratio: avgMax ? avgScore / avgMax : 0 };
  }
  const avgTotal = n ? scores.reduce((a, b) => a + b.total, 0) / n : 0;
  const finalTotal = Math.round(avgTotal);
  const feedbacks = [...new Set(scores.map((x) => x.feedback).filter(Boolean))];
  return { n, agg, avgTotal, finalTotal, feedbacks };
}

async function finalize() {
  clearTimer();
  setPhase('idle');
  el.micBtn.disabled = true;
  switchView('end');
  if (S.ttsOn) speak('면접이 끝났습니다.');
  generateComprehensive();
}

/* ================= 점수 화면 ================= */

function paintScore(targets, scores, mode, meta = {}) {
  const { agg, finalTotal, feedbacks } = computeAggregates(scores, mode);
  const C = 2 * Math.PI * 78;
  targets.gauge.innerHTML = `<svg viewBox="0 0 180 180" aria-hidden="true">
    <defs><linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4f5dff"/><stop offset="100%" stop-color="#7c4dff"/>
    </linearGradient></defs>
    <circle class="ring-bg" cx="90" cy="90" r="78"></circle>
    <circle class="ring-fg" cx="90" cy="90" r="78" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - finalTotal / 100)).toFixed(1)}"></circle>
  </svg>`;
  targets.final.textContent = finalTotal;

  const totalGrade = gradeFromRatio(finalTotal / 100, mode);
  const totalWord = finalTotal >= 90 ? '매우 우수' : finalTotal >= 80 ? '우수' : finalTotal >= 70 ? '양호' : finalTotal >= 60 ? '보통' : '미흡';
  targets.grade.textContent = `${totalWord} (${totalGrade} 등급)`;
  targets.feedback.textContent = feedbacks.join(' ') || '모든 문항이 채점되었습니다.';

  targets.qScores.innerHTML = '';
  scores.forEach((sc, i) => {
    const card = document.createElement('div');
    card.className = 'q-score';
    let rows = '';
    const cats = mode === 'passage' ? PASSAGE_CATS : DOC_CATS;
    for (const key of cats) {
      const c = sc.scores[key] || { grade: 'F', score: 0, max: 0, comment: '' };
      const pct = c.max ? Math.round((c.score / c.max) * 100) : 0;
      rows += `<div class="bar-row">
        <span class="bar-name">${esc(key)}</span>
        <span class="bar-track"><span class="bar-fill${pct < 40 ? ' low' : ''}" style="width:${pct}%"></span></span>
        <span class="bar-val">${c.score}/${c.max}</span>
      </div>`;
    }
    card.innerHTML = `<div class="q-score-head">
        <span class="q-score-num">문항 ${i + 1}</span>
        <span class="q-score-total">${sc.total}점</span>
      </div>${rows}${sc.feedback ? `<div class="q-comment">${esc(sc.feedback)}</div>` : ''}`;
    targets.qScores.appendChild(card);
  });

  targets.catScores.innerHTML = '';
  for (const key of Object.keys(agg)) {
    const { avgScore, avgMax, ratio } = agg[key];
    const grade = gradeFromRatio(ratio, mode);
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `<span class="cat-name">${esc(key)}</span>
      <span class="cat-val">${avgMax ? Math.round(avgScore) : 0}/${Math.round(avgMax)}<span class="grade-pill">${grade}</span></span>`;
    targets.catScores.appendChild(row);
  }

  if (!meta.catTitle) meta = mode === 'document'
    ? {
        catTitle: '역량별 평균 (대학 반영 비율)',
        disposition: '교수 평가 성향 참고: ' + (S.dept?.disposition || '표준 기준 적용'),
        weightsNote: '반영 비율: ' + Object.entries(weightsOf()).map(([k, v]) => `${k} ${v}%`).join(' · '),
      }
    : {
        catTitle: '채점 항목 평균 (제시문 면접)',
        disposition: '모범답안 힌트: ' + (S.dept?.modelAnswerHint || '-'),
        weightsNote: '채점기준: 타당성 40 · 논리적 전개 30 · 종합적 사고력 30 (대학 모범답안 기반)',
      };
  targets.catTitle.textContent = meta.catTitle;
  targets.disposition.textContent = meta.disposition;
  targets.weightsNote.textContent = meta.weightsNote;
}

function showScore() {
  const { n } = computeAggregates();
  if (!n) { toast('채점된 답변이 없습니다. 다시 면접을 진행해 주세요.'); return; }
  paintScore({
    gauge: el.gauge, final: el.finalScore, grade: el.scoreGrade, feedback: el.scoreFeedback,
    qScores: el.qScores, catScores: el.catScores,
    catTitle: el.catTitle, disposition: el.disposition, weightsNote: el.weightsNote,
  }, S.scores, S.mode);
  el.btnSaveRecord.hidden = !S.token;
  renderComprehensive();
  renderTranscriptReview();
  switchView('score');
}

/* ---- 종합 피드백 (면접 종료 후 생성) ---- */

function compMeta() {
  return S.mode === 'document'
    ? {
        catTitle: '역량별 평균 (대학 반영 비율)',
        disposition: '교수 평가 성향 참고: ' + (S.dept?.disposition || '표준 기준 적용'),
        weightsNote: '반영 비율: ' + Object.entries(weightsOf()).map(([k, v]) => `${k} ${v}%`).join(' · '),
      }
    : {
        catTitle: '채점 항목 평균 (제시문 면접)',
        disposition: '모범답안 힌트: ' + (S.dept?.modelAnswerHint || '-'),
        weightsNote: '채점기준: 타당성 40 · 논리적 전개 30 · 종합적 사고력 30 (대학 모범답안 기반)',
      };
}

function comprehensivePrompt() {
  const avg = S.scores.reduce((a, b) => a + b.total, 0) / S.scores.length;
  const lines = S.transcript.map((t, i) => {
    const parts = [`Q${i + 1}: ${t.question}`, `답변: ${t.answer}`];
    if (t.followupQ) parts.push(`꼬리질문: ${t.followupQ}`, `꼬리답변: ${t.followupAnswer || '(답변 없음)'}`);
    if (t.score) parts.push(`채점 ${t.score.total}점`);
    return parts.join('\n');
  }).join('\n\n');
  return `당신은 한국 대학 입시 면접 전문 평가관이다. 아래 ${S.mode === 'passage' ? '제시문 면접' : '서류 기반 면접'}의 전체 문항·답변 기록을 종합 평가하라.

면접 대상: ${S.univ ? S.univ.name : '-'} ${S.dept ? S.dept.name : '-'}
평균 점수: ${avg.toFixed(1)} / 100

[문항·답변 기록]
${lines}

반드시 아래 JSON 형식으로만 응답하라:
{
  "overall": "전체 평가 한 줄 요약 (2~3문장)",
  "strengths": ["강점 3개"],
  "weaknesses": ["보완할 점 3개"],
  "advice": "구체적인 학습·연습 방향 조언 (4~6문장)",
  "questions": [
    {"intent": "답변에서 놓친 평가 의도", "betterAnswer": "더 나은 답변 방향"}
  ],
  "perQuestion": [
    {"qIndex": 1, "evaluation": "1번 문항 답변에 대한 구체적 평가 (2~3문장)", "improvement": "개선 방향 (1~2문장)"}
  ]
}
문항별 구체적인 근거를 들어 평가하고 추상적 표현은 피하라. perQuestion은 [문항·답변 기록]의 모든 문항을 빠짐없이 qIndex 1부터 순서대로 포함하라.`;
}

function normalizeComprehensive(raw) {
  let obj = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : null;
  if (!obj) {
    const text = String(raw || '');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('종합 피드백 형식 오류');
    obj = JSON.parse(m[0]);
  }
  return {
    overall: String(obj.overall || '').trim(),
    strengths: Array.isArray(obj.strengths) ? obj.strengths.map(String).filter(Boolean) : [],
    weaknesses: Array.isArray(obj.weaknesses) ? obj.weaknesses.map(String).filter(Boolean) : [],
    advice: String(obj.advice || '').trim(),
    questions: Array.isArray(obj.questions)
      ? obj.questions.map((q) => ({ intent: String(q.intent || ''), betterAnswer: String(q.betterAnswer || '') }))
      : [],
    perQuestion: Array.isArray(obj.perQuestion)
      ? obj.perQuestion.map((q) => ({
          qIndex: Number(q.qIndex) || 0,
          evaluation: String(q.evaluation || '').trim(),
          improvement: String(q.improvement || '').trim(),
        })).filter((q) => q.evaluation || q.improvement)
      : [],
  };
}

async function generateComprehensive() {
  if (!S.scores.length || S.compBusy) return;
  S.compBusy = true;
  if (S.view === 'score') {
    el.compSection.hidden = false;
    el.compBody.hidden = true;
    el.compLoading.hidden = false;
    renderTranscriptReview();
  }
  try {
    S.comprehensive = normalizeComprehensive(await callLLM(comprehensivePrompt(), 'interviewer'));
  } catch {
    S.comprehensive = null;
  } finally {
    S.compBusy = false;
    if (S.view === 'score') {
      renderComprehensive();
      renderTranscriptReview();
    }
  }
}

function renderComprehensive() {
  el.compLoading.hidden = true;
  el.compBody.hidden = false;
  if (S.compBusy) {
    el.compSection.hidden = false;
    el.compBody.hidden = true;
    el.compLoading.hidden = false;
    return;
  }
  if (!S.comprehensive) {
    el.compBody.innerHTML = '<div class="comp-fail">종합 피드백을 생성하지 못했습니다. <button class="link-btn" type="button" id="btn-comp-retry">다시 생성</button></div>';
    el.compBody.querySelector('#btn-comp-retry').addEventListener('click', generateComprehensive);
    return;
  }
  const c = S.comprehensive;
  const lis = (items) => items.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">–</li>';
  el.compBody.innerHTML = `
    <p class="comp-overall">${esc(c.overall)}</p>
    <div class="comp-cols">
      <div>
        <h4 class="comp-h">강점</h4>
        <ul class="comp-list good">${lis(c.strengths)}</ul>
      </div>
      <div>
        <h4 class="comp-h">보완할 점</h4>
        <ul class="comp-list bad">${lis(c.weaknesses)}</ul>
      </div>
    </div>
    ${c.advice ? `<h4 class="comp-h">앞으로의 연습 방향</h4><p class="comp-advice">${esc(c.advice)}</p>` : ''}
    ${c.questions.length ? `<h4 class="comp-h">다음 연습에서 보완할 질문 대응</h4>
      <div class="comp-questions">${c.questions.map((q) => `<div class="comp-q">
        <p class="comp-q-intent">${esc(q.intent)}</p>
        <p class="comp-q-answer">${esc(q.betterAnswer)}</p>
      </div>`).join('')}</div>` : ''}`;
}

function trvItemHtml(t, i, per) {
  const q = per.find((x) => x.qIndex === i + 1) || per[i] || {};
  const sub = t.followupQ
    ? `<p class="trv-sub"><strong>꼬리질문:</strong> ${esc(t.followupQ)}<br><strong>꼬리답변:</strong> ${esc(t.followupAnswer || '(답변 없음)')}</p>`
    : '';
  return `<div class="trv-item">
    <div class="trv-head"><span>문항 ${i + 1}</span>${t.score ? `<span class="trv-score">${t.score.total}점</span>` : ''}</div>
    <p class="trv-q"><strong>질문:</strong> ${esc(t.question)}</p>
    <p class="trv-ans"><strong>내 답변:</strong> ${esc(t.answer)}</p>
    ${sub}
    ${q.evaluation ? `<p class="trv-eval">${esc(q.evaluation)}</p>` : ''}
    ${q.improvement ? `<p class="trv-imp"><strong>개선 방향:</strong> ${esc(q.improvement)}</p>` : ''}
  </div>`;
}

function renderTranscriptReview() {
  el.trvLoading.hidden = true;
  el.trvBody.hidden = false;
  if (S.compBusy) {
    el.trvSection.hidden = false;
    el.trvBody.hidden = true;
    el.trvLoading.hidden = false;
    return;
  }
  const per = (S.comprehensive && Array.isArray(S.comprehensive.perQuestion)) ? S.comprehensive.perQuestion : [];
  if (!S.transcript.length || !per.length) {
    el.trvSection.hidden = !S.transcript.length;
    el.trvBody.innerHTML = '';
    return;
  }
  el.trvSection.hidden = false;
  el.trvBody.innerHTML = S.transcript.map((t, i) => trvItemHtml(t, i, per)).join('');
}

/* ================= 기록 CRUD · 백업/복원 ================= */

function recordTitle(rec) {
  return `${rec.univName || '면접 연습'} ${rec.deptName || ''}`.trim() || '면접 기록';
}

async function saveRecord() {
  if (!S.token) { toast('로그인 후 저장할 수 있습니다.', true); return; }
  const { n, finalTotal } = computeAggregates();
  if (!n) return;
  const totalWord = finalTotal >= 90 ? '매우 우수' : finalTotal >= 80 ? '우수' : finalTotal >= 70 ? '양호' : finalTotal >= 60 ? '보통' : '미흡';
  const grade = gradeFromRatio(finalTotal / 100, S.mode);
  const comp = S.comprehensive ? { ...S.comprehensive, meta: compMeta() } : null;
  el.btnSaveRecord.disabled = true;
  try {
    await api('/api/records', {
      method: 'POST',
      body: JSON.stringify({
        mode: S.mode,
        univName: S.univ ? S.univ.name : '',
        deptName: S.dept ? S.dept.name : '',
        total: finalTotal,
        gradeWord: totalWord,
        grade,
        items: S.scores,
        transcript: S.transcript,
        comprehensive: comp,
      }),
    });
    toast('기록이 저장되었습니다.');
  } catch (e) {
    toast('저장 실패: ' + e.message, true);
  } finally {
    el.btnSaveRecord.disabled = false;
  }
}

async function openRecords() {
  try {
    const r = await api('/api/records');
    S.viewRecordsData = Array.isArray(r.records) ? r.records : [];
  } catch (e) {
    toast('기록을 불러오지 못했습니다: ' + e.message, true);
    S.viewRecordsData = [];
  }
  renderRecords();
  switchView('records');
}

function renderRecords() {
  const list = S.viewRecordsData;
  el.recordsEmpty.hidden = !!list.length;
  el.recordsList.innerHTML = '';
  list.forEach((rec) => {
    const row = document.createElement('div');
    row.className = 'record-row';
    row.innerHTML = `<div class="record-info">
        <div class="record-title">${esc(recordTitle(rec))}</div>
        <div class="record-meta">${new Date(rec.createdAt).toLocaleString()} · ${Array.isArray(rec.items) ? rec.items.length : 0}문항 · ${rec.mode === 'document' ? '서류 면접' : '제시문 면접'}</div>
      </div>
      <span class="record-total">${rec.total}점</span>`;
    row.addEventListener('click', () => showRecordView(rec));
    el.recordsList.appendChild(row);
  });
}

function showRecordView(rec) {
  S.currentRecord = rec;
  el.recvTitle.textContent = recordTitle(rec);
  const meta = rec.comprehensive && rec.comprehensive.meta ? rec.comprehensive.meta : {};
  paintScore({
    gauge: el.recvGauge, final: el.recvFinal, grade: el.recvGrade, feedback: el.recvFeedback,
    qScores: el.recvQScores, catScores: el.recvCatScores,
    catTitle: el.recvCatTitle, disposition: el.recvDisposition, weightsNote: el.recvWeightsNote,
  }, Array.isArray(rec.items) ? rec.items : [], rec.mode, meta);
  renderRecordComp(rec);
  renderRecordTrv(rec);
  switchView('record');
}

function renderRecordComp(rec) {
  const c = rec.comprehensive;
  if (!c || (!c.overall && !Array.isArray(c.strengths))) { el.recvComp.hidden = true; return; }
  el.recvComp.hidden = false;
  const lis = (items) => (Array.isArray(items) ? items : []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">–</li>';
  el.recvCompBody.innerHTML = `
    <p class="comp-overall">${esc(c.overall || '')}</p>
    <div class="comp-cols">
      <div>
        <h4 class="comp-h">강점</h4>
        <ul class="comp-list good">${lis(c.strengths)}</ul>
      </div>
      <div>
        <h4 class="comp-h">보완할 점</h4>
        <ul class="comp-list bad">${lis(c.weaknesses)}</ul>
      </div>
    </div>
    ${c.advice ? `<h4 class="comp-h">앞으로의 연습 방향</h4><p class="comp-advice">${esc(c.advice)}</p>` : ''}
    ${Array.isArray(c.questions) && c.questions.length ? `<h4 class="comp-h">다음 연습에서 보완할 질문 대응</h4>
      <div class="comp-questions">${c.questions.map((q) => `<div class="comp-q">
        <p class="comp-q-intent">${esc(q.intent || '')}</p>
        <p class="comp-q-answer">${esc(q.betterAnswer || '')}</p>
      </div>`).join('')}</div>` : ''}`;
}

function renderRecordTrv(rec) {
  const t = Array.isArray(rec.transcript) ? rec.transcript : [];
  const per = (rec.comprehensive && Array.isArray(rec.comprehensive.perQuestion)) ? rec.comprehensive.perQuestion : [];
  el.recvTrv.hidden = !(t.length && per.length);
  if (el.recvTrv.hidden) return;
  el.recvTrvBody.innerHTML = t.map((item, i) => trvItemHtml(item, i, per)).join('');
}

async function deleteRecord() {
  if (!S.currentRecord) return;
  if (!confirm('이 기록을 삭제할까요? 다시 되돌릴 수 없습니다.')) return;
  try {
    await api('/api/records/' + encodeURIComponent(S.currentRecord.id), { method: 'DELETE' });
    toast('기록이 삭제되었습니다.');
    openRecords();
  } catch (e) {
    toast('삭제 실패: ' + e.message, true);
  }
}

function practiceAgainFromRecord() {
  if (S.currentRecord && (S.currentRecord.mode === 'passage' || S.currentRecord.mode === 'document')) {
    setMode(S.currentRecord.mode);
  }
  switchView('setup');
}

async function downloadBackup() {
  try {
    const r = await api('/api/backup', { method: 'POST', body: '{}' });
    const blob = new Blob([r.data], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ai-interview-backup-' + new Date().toISOString().slice(0, 10) + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    toast('백업 실패: ' + e.message, true);
  }
}

async function restoreFromFile(file) {
  if (!file) return;
  try {
    const text = (await file.text()).trim();
    const r = await api('/api/restore', { method: 'POST', body: JSON.stringify({ data: text }) });
    toast(`${r.username} 계정으로 기록이 복원되었습니다.`);
    openRecords();
  } catch (e) {
    toast('복원 실패: ' + e.message, true);
  } finally {
    el.restoreFile.value = '';
  }
}

/* ================= 리셋 ================= */

function resetInterview(full) {
  stopSpeak();
  stopListen();
  clearTimer();
  S.questions = []; S.qIndex = 0; S.scores = []; S.passage = ''; S.followupQ = null;
  S.followupActive = false; pendingMain = null;
  S.busy = false; S.timerExpired = false; S.phase = 'idle';
  S.transcript = [];
  S.comprehensive = null;
  S.compBusy = false;
  S.viewRecordsData = [];
  S.currentRecord = null;
  el.compSection.hidden = true;
  el.trvSection.hidden = true;
  el.btnSaveRecord.hidden = true;
  if (full) {
    S.univ = null; S.dept = null; S.mode = null;
    el.selUniv.value = '';
    el.selDept.innerHTML = '<option value="">대학을 먼저 선택하세요</option>';
    el.selDept.disabled = true;
    el.searchUniv.value = '';
    el.searchDept.value = '';
    el.searchDept.disabled = true;
    el.univCount.textContent = S.unis.length + '개 대학';
    el.deptCount.textContent = '';
    S.recordText.value = '';
    el.recordText.value = '';
    el.recordText.disabled = true;
    el.recordMeta.hidden = true;
    el.recordFname.textContent = '';
    el.recordFile.value = '';
    el.dropZone.classList.remove('busy', 'drag');
    el.recordCharcnt.textContent = '첨부한 파일에서 텍스트를 추출해 면접에 사용합니다. 이 컴퓨터 안에서만 처리됩니다.';
    el.recordField.hidden = true;
    document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('active'));
    el.qtimeField.hidden = true;
    S.qCount = MODE_CFG.passage.qDefault;
    S.totalMin = MODE_CFG.passage.tDefault;
    syncQTimeUI();
  }
  updateStart();
  switchView('setup');
}

/* ================= 대학·학과 검색 필터링 ================= */

function filterUnivs(query) {
  const q = query.trim().toLowerCase();
  el.selUniv.innerHTML = '<option value="">대학을 선택하세요</option>';
  let count = 0;
  for (const u of S.unis) {
    if (q && !u.name.toLowerCase().includes(q) && !u.id.toLowerCase().includes(q)) continue;
    const o = document.createElement('option');
    o.value = u.id;
    o.textContent = u.name + ' (' + u.departments.length + '개 학과)';
    el.selUniv.appendChild(o);
    count++;
  }
  el.univCount.textContent = q ? count + '개 대학 검색됨' : '';
  if (S.univ && !S.unis.find((u) => u.id === el.selUniv.value && (!q || u.name.toLowerCase().includes(q)))) {
    el.selUniv.value = '';
    S.univ = null;
    S.dept = null;
    el.selDept.innerHTML = '<option value="">대학을 먼저 선택하세요</option>';
    el.selDept.disabled = true;
    el.searchDept.disabled = true;
    el.searchDept.value = '';
    el.deptCount.textContent = '';
  }
  updateStart();
}

function filterDepts(query) {
  if (!S.univ) return;
  const q = query.trim().toLowerCase();
  el.selDept.innerHTML = '<option value="">학과를 선택하세요</option>';
  let count = 0;
  for (const d of S.univ.departments) {
    if (q && !d.name.toLowerCase().includes(q)) continue;
    const o = document.createElement('option');
    o.value = d.id;
    o.textContent = d.name;
    el.selDept.appendChild(o);
    count++;
  }
  el.deptCount.textContent = q ? count + '개 학과 검색됨' : S.univ.departments.length + '개 학과';
  if (S.dept && !S.univ.departments.find((d) => d.id === el.selDept.value && (!q || d.name.toLowerCase().includes(q)))) {
    el.selDept.value = '';
    S.dept = null;
  }
  updateStart();
}

/* ================= 이벤트 바인딩 ================= */

el.selUniv.addEventListener('change', onUnivChange);
el.selDept.addEventListener('change', onDeptChange);
el.searchUniv.addEventListener('input', () => filterUnivs(el.searchUniv.value));
el.searchDept.addEventListener('input', () => filterDepts(el.searchDept.value));
document.querySelectorAll('.mode-card').forEach((c) =>
  c.addEventListener('click', () => setMode(c.dataset.mode))
);
el.btnQMinus.addEventListener('click', () => adjustQTime('q', -1));
el.btnQPlus.addEventListener('click', () => adjustQTime('q', 1));
el.btnTMinus.addEventListener('click', () => adjustQTime('t', -1));
el.btnTPlus.addEventListener('click', () => adjustQTime('t', 1));
el.recordText.addEventListener('input', () => {
  el.recordCharcnt.textContent = `인식 텍스트 ${S.recordText.value.trim().length}자 · 수정 반영됨.`;
  updateStart();
});

/* 생기부 파일 첨부 (선택 · 드래그앤드롭) */
el.recordFile.addEventListener('change', (e) => handleRecordFile(e.target.files && e.target.files[0]));
el.dropZone.addEventListener('click', (e) => {
  if (e.target !== el.btnRecordClear) el.recordFile.click();
});
el.dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    el.recordFile.click();
  }
});
el.dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  el.dropZone.classList.add('drag');
});
el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('drag'));
el.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  el.dropZone.classList.remove('drag');
  handleRecordFile(e.dataTransfer.files && e.dataTransfer.files[0]);
});
el.btnRecordClear.addEventListener('click', () => {
  S.recordText.value = '';
  el.recordText.value = '';
  el.recordText.disabled = true;
  el.recordMeta.hidden = true;
  el.recordFname.textContent = '';
  el.recordCharcnt.textContent = '첨부한 파일에서 텍스트를 추출해 면접에 사용합니다. 이 컴퓨터 안에서만 처리됩니다.';
  updateStart();
});
el.btnStart.addEventListener('click', startInterview);
el.micBtn.addEventListener('click', () => (listening ? stopListen() : startListen()));
el.btnRetryMic.addEventListener('click', () => {
  el.answerText.value = '';
  finalTranscript = '';
  startListen();
});
el.btnSubmit.addEventListener('click', submitAnswer);
el.answerText.addEventListener('input', () => enableSubmit(!!el.answerText.value.trim()));
el.btnReplayPassage.addEventListener('click', () => speak(S.passage));
el.btnScore.addEventListener('click', showScore);
el.btnRetry.addEventListener('click', () => resetInterview(false));
el.btnHome.addEventListener('click', () => resetInterview(true));
el.ttsChk.addEventListener('change', () => {
  S.ttsOn = el.ttsChk.checked;
  saveTtsPref(S.ttsOn);
  if (!S.ttsOn) stopSpeak();
});

document.querySelectorAll('.auth-tab').forEach((t) => t.addEventListener('click', () => openAuth(t.dataset.tab)));
el.authForm.addEventListener('submit', submitAuth);
el.btnLogout.addEventListener('click', logout);

el.rcCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(el.rcCode.textContent)
    .then(() => toast('복구 코드가 복사되었습니다.'))
    .catch(() => toast('복사에 실패했습니다. 직접 기록해 주세요.', true));
});
el.rcDownload.addEventListener('click', downloadRecoveryCode);
el.rcConfirm.addEventListener('click', () => { el.rcModal.hidden = true; });

el.btnSaveRecord.addEventListener('click', saveRecord);
el.btnMyRecords.addEventListener('click', openRecords);
el.btnRecordsBack.addEventListener('click', () => switchView('setup'));
el.btnBackup.addEventListener('click', downloadBackup);
el.btnRestore.addEventListener('click', () => el.restoreFile.click());
el.restoreFile.addEventListener('change', (e) => restoreFromFile(e.target.files && e.target.files[0]));
el.btnRecordDelete.addEventListener('click', deleteRecord);
el.btnRecordsAgain.addEventListener('click', practiceAgainFromRecord);
el.btnRecordsBack2.addEventListener('click', openRecords);

/* 음성 목록 사전 로드 (일부 브라우저는 비동기 로드) */
if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

/* ================= 시작 ================= */
loadUniversities();
restoreSession();