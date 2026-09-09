#!/usr/bin/env node
/**
 * AI 면접 연습실 — 로컬 웹 서버
 *
 * 정적 파일(index.html / styles.css / app.js)을 서빙하고,
 * 무료 opencode zen 모델을 `opencode run --format json`으로 호출하는 LLM 프록시 역할을 한다.
 *
 * 실행 방법:
 *   npm start          # 또는 node server.js
 *   → http://localhost:3333
 *
 * 필요한 것:
 *   - opencode CLI 설치 (curl -fsSL https://opencode.ai/install | bash)
 *   - opencode zen 로그인 (/connect) — 무료 모델만 사용
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.PORT || 3333);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, '.agents', 'data', 'universities.json');
const DATA_DIR = path.join(ROOT, '.agents', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

/** 무료 zen 모델 레지스트리 (.agents/models.md와 동일 기준) */
const MODELS = {
  interviewer: 'opencode/nemotron-3-ultra-free', // 기본 면접관·채점 (검증됨, cost 0)
  fallback: 'opencode/mimo-v2.5-free',            // 폴백 (검증됨, cost 0)
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const STATIC_ROUTES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/styles.css', 'styles.css'],
  ['/app.js', 'app.js'],
]);

// 대학 데이터는 서버 시작 시 1회 로드 (수정 시 서버 재시작)
let universitiesData = null;
try {
  universitiesData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch (e) {
  console.error(`[경고] universities.json을 읽지 못했습니다: ${e.message}`);
}

/* ===================== 응답 헬퍼 ===================== */

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  });
  res.end(typeof body === 'string' ? body : Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, { ok: false, error: '파일을 찾을 수 없습니다.' });
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

/* ===================== 사용자·세션·기록 저장소 (JSON 파일, 무의존성) ===================== */

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function loadUsers() { return readJsonFile(USERS_FILE, { users: [] }); }
function saveUsers(d) { writeJsonFile(USERS_FILE, d); }
function loadSessions() { return readJsonFile(SESSIONS_FILE, { sessions: [] }); }
function saveSessions(d) { writeJsonFile(SESSIONS_FILE, d); }
function loadRecords() { return readJsonFile(RECORDS_FILE, { records: [] }); }
function saveRecords(d) { writeJsonFile(RECORDS_FILE, d); }

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, expected) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const exp = Buffer.from(expected, 'hex');
  return actual.length === exp.length && crypto.timingSafeEqual(actual, exp);
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genRecoveryCode() {
  let code = '';
  for (const b of crypto.randomBytes(12)) code += RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length];
  return code;
}

function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update('rc::' + code).digest('hex');
}

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function bearerToken(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

function userByToken(token) {
  if (!token) return null;
  const sessions = loadSessions();
  const s = sessions.sessions.find((x) => x.token === token);
  if (!s) return null;
  const users = loadUsers();
  return users.users.find((u) => u.id === s.userId) || null;
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = loadSessions();
  sessions.sessions = sessions.sessions.filter((s) => s.userId !== userId); // 사용자당 1세션
  sessions.sessions.push({ token, userId, createdAt: Date.now() });
  saveSessions(sessions);
  return token;
}

function destroySession(token) {
  if (!token) return;
  const sessions = loadSessions();
  sessions.sessions = sessions.sessions.filter((s) => s.token !== token);
  saveSessions(sessions);
}

/* ===================== LLM 호출 ===================== */

/**
 * `opencode run --model <id> --format json <prompt>` 실행
 * stdout의 JSONL 이벤트 스트림에서 type:"text" 이벤트의 part.text만 추출한다.
 */
function callOpenCode(model, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'opencode',
      ['run', '--model', model, '--format', 'json', prompt],
      // stdin은 닫는다(ignore). 열린 파이프로 두면 opencode run이 stdin 대기로 멈춘다.
      { cwd: ROOT, env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let out = '';
    let errOut = '';
    let settled = false;

    const kill = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('LLM 응답 시간 초과 (240초)'));
    }, timeoutMs);

    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (errOut += d));
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(kill);
      reject(new Error(`opencode 실행 실패: ${e.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(kill);
      if (code !== 0 && !extractCompletion(out)) {
        reject(
          new Error(`opencode 종료 코드 ${code}${errOut ? ` — ${errOut.slice(0, 300)}` : ''}`)
        );
        return;
      }
      resolve({ stdout: out, stderr: errOut });
    });
  });
}

/** JSONL 스트림에서 최종 텍스트 응답 재조립 */
function extractCompletion(stdout) {
  let text = '';
  for (const line of stdout.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    try {
      const ev = JSON.parse(l);
      if (ev.type === 'text' && ev.part && typeof ev.part.text === 'string') {
        text += ev.part.text;
      }
    } catch {
      /* 비-JSON 라인 무시 */
    }
  }
  return text;
}

/** 텍스트에서 유효한 JSON 객체 추출 (전체 → 펜스 → 균형 괄호 스캔) */
function extractJson(text) {
  if (!text) return null;
  const t = text.trim();

  // 1) 전체가 JSON
  try {
    const p = JSON.parse(t);
    if (p && typeof p === 'object') return p;
  } catch {
    /* 다음 시도 */
  }

  // 2) ```json ... ``` 펜스
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      const p = JSON.parse(fence[1].trim());
      if (p && typeof p === 'object') return p;
    } catch {
      /* 다음 시도 */
    }
  }

  // 3) 첫 { 부터 균형 잡힌 } 까지 (문자열 내부 괄호 무시)
  const start = t.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(t.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

/** LLM 1회 호출 → {json, text} (파싱 실패 시 throw) */
async function llm(prompt, { model = 'interviewer', strict = false, timeoutMs = 240000 } = {}) {
  const modelId = MODELS[model] || model;
  const finalPrompt = strict
    ? prompt +
      '\n\n(중요: 오직 유효한 JSON 객체 하나만 출력하라. 마크다운, 코드 펜스, 설명 텍스트는 절대 포함하지 말 것.)'
    : prompt;
  const { stdout } = await callOpenCode(modelId, finalPrompt, timeoutMs);
  const text = extractCompletion(stdout).trim();
  const json = extractJson(text);
  if (!json) throw new Error('LLM 응답에서 JSON을 찾지 못했습니다.');
  return { json, text };
}

/** 재시도 체인: 기본 → 스트릭트 → 폴백 모델 */
async function llmWithRetry(prompt, opts = {}) {
  try {
    return await llm(prompt, opts);
  } catch (e1) {
    try {
      return await llm(prompt, { ...opts, strict: true });
    } catch (e2) {
      try {
        return await llm(prompt, { ...opts, model: 'fallback' });
      } catch (e3) {
        throw new Error(`LLM 호출 실패: ${e1.message} / ${e3.message}`);
      }
    }
  }
}

/* ===================== 파일 → 텍스트 추출 ===================== */

const MAX_RECORD_FILE = 10 * 1024 * 1024; // 10MB

/** HTML에서 본문 텍스트 추출 (script/style 제거 → 태그 제거 → 엔티티 디코드) */
function extractHtmlText(buf) {
  let s = buf.toString('utf8');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
       .replace(/<style[\s\S]*?<\/style>/gi, ' ')
       .replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
       .replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ')
       .replace(/&amp;/gi, '&')
       .replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"')
       .replace(/&#39;/gi, "'");
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** PDF 스트림에서 텍스트 연산자(Tj/TJ) 추출 — 무의존성 최소 구현 */
function extractPdfText(buf) {
  const s = buf.toString('latin1');
  let text = '';
  let idx = 0;
  while (true) {
    const streamAt = s.indexOf('stream', idx);
    if (streamAt === -1) break;
    const start = s.indexOf('\n', streamAt) + 1;
    const end = s.indexOf('endstream', start);
    if (end === -1) break;
    let data = s.slice(start, end);
    try {
      data = zlib.inflateSync(Buffer.from(data, 'latin1')).toString('latin1');
    } catch { /* 이미 압축되지 않은 스트림 */ }
    const re = /\(((?:[^()\\\n\r]|\\.)*)\)\s*Tj|\[((?:[^\]\\\n\r]|\\.)*)\]\s*TJ/g;
    let m;
    while ((m = re.exec(data))) {
      const part = m[1] !== undefined ? m[1] : m[2];
      text += decodePdfString(part);
      if (m[1] !== undefined) text += ' ';
    }
    idx = end;
  }
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function decodePdfString(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const n = s[++i];
      if (n === 'n') out += '\n';
      else if (n === 'r') out += '\r';
      else if (n === 't') out += '\t';
      else if (n === 'b') out += '\b';
      else if (n === 'f') out += '\f';
      else if (n === '(' || n === ')' || n === '\\') out += n;
      else if (n >= '0' && n <= '7') {
        let oct = n;
        for (let k = 0; k < 2 && i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '7'; k++) {
          oct += s[++i];
        }
        out += String.fromCharCode(parseInt(oct, 8));
      } else out += n;
    } else out += c;
  }
  return out;
}

/** DOCX(ZIP)에서 word/document.xml 추출 — 무의존성 최소 구현 */
function extractDocxText(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd === -1) return '';
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let pos = cdOffset;
  let xml = null;
  while (pos + 46 <= eocd) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lho = buf.readUInt32LE(pos + 42);
    const name = buf.toString('latin1', pos + 46, pos + 46 + nameLen);
    if (name === 'word/document.xml') {
      if (buf.readUInt32LE(lho) !== 0x04034b50) return '';
      const lNameLen = buf.readUInt16LE(lho + 26);
      const lExtraLen = buf.readUInt16LE(lho + 28);
      const dataStart = lho + 30 + lNameLen + lExtraLen;
      const comp = buf.subarray(dataStart, dataStart + compSize);
      xml = method === 0
        ? comp.toString('utf8')
        : zlib.inflateRawSync(comp).toString('utf8');
      break;
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (!xml) return '';
  return xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/(w:p|w:tr|w:tc)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTextFromFile(filename, buf) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.html' || ext === '.htm') return { text: extractHtmlText(buf), source: 'html' };
  if (ext === '.txt') return { text: buf.toString('utf8').replace(/\r\n/g, '\n').trim(), source: 'txt' };
  if (ext === '.pdf') return { text: extractPdfText(buf), source: 'pdf' };
  if (ext === '.docx') return { text: extractDocxText(buf), source: 'docx' };
  throw new Error('지원하지 않는 형식입니다. HTML/PDF/DOCX/TXT 파일을 첨부하세요.');
}

/* ===================== HTTP 서버 ===================== */

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return send(res, 400, { ok: false, error: '잘못된 URL' });
  }
  const p = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  if (req.method === 'GET') {
    if (p === '/api/universities') {
      if (!universitiesData) return send(res, 500, { ok: false, error: '대학 데이터가 없습니다.' });
      return send(res, 200, universitiesData);
    }
    if (p === '/api/models') {
      return send(res, 200, { ok: true, models: MODELS });
    }
    if (p === '/api/me') {
      const user = userByToken(bearerToken(req));
      return send(res, 200, user ? { ok: true, username: user.username } : { ok: false });
    }
    if (p === '/api/records') {
      const user = userByToken(bearerToken(req));
      if (!user) return send(res, 401, { ok: false, error: '로그인이 필요합니다.' });
      const records = loadRecords();
      const mine = records.records
        .filter((r) => r.userId === user.id)
        .sort((a, b) => b.createdAt - a.createdAt);
      return send(res, 200, { ok: true, records: mine });
    }
    const rel = STATIC_ROUTES.get(p);
    if (rel) return sendFile(res, path.join(ROOT, rel));
    return send(res, 404, { ok: false, error: 'Not Found' });
  }

  if (req.method === 'DELETE') {
    const m = p.match(/^\/api\/records\/([A-Za-z0-9]+)$/);
    if (m) {
      const user = userByToken(bearerToken(req));
      if (!user) return send(res, 401, { ok: false, error: '로그인이 필요합니다.' });
      const records = loadRecords();
      records.records = records.records.filter((r) => !(r.id === m[1] && r.userId === user.id));
      saveRecords(records);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { ok: false, error: 'Not Found' });
  }

  if (req.method === 'POST' && (p === '/api/llm' || p === '/api/extract-text' || p === '/api/register' || p === '/api/login' || p === '/api/reset-password' || p === '/api/logout' || p === '/api/records' || p === '/api/backup' || p === '/api/restore')) {
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        const cap = p === '/api/extract-text' ? MAX_RECORD_FILE * 2 : 4 * 1024 * 1024;
        if (body.length > cap) {
          return send(res, 413, { ok: false, error: '요청이 너무 큽니다.' });
        }
      }
    } catch {
      return send(res, 400, { ok: false, error: '요청 본문을 읽지 못했습니다.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return send(res, 400, { ok: false, error: '잘못된 JSON 본문입니다.' });
    }

    if (p === '/api/register') {
      const username = String(parsed.username || '').trim();
      const password = String(parsed.password || '');
      if (!/^[A-Za-z0-9가-힣_]{2,20}$/.test(username)) {
        return send(res, 400, { ok: false, error: '아이디는 2~20자의 영문/숫자/한글/_만 사용할 수 있습니다.' });
      }
      if (password.length < 4 || password.length > 64) {
        return send(res, 400, { ok: false, error: '비밀번호는 4~64자여야 합니다.' });
      }
      const users = loadUsers();
      if (users.users.some((u) => u.username === username)) {
        return send(res, 409, { ok: false, error: '이미 사용 중인 아이디입니다.' });
      }
      const recoveryCode = genRecoveryCode();
      const salt = crypto.randomBytes(16).toString('hex');
      const user = {
        id: newId(),
        username,
        salt,
        passHash: hashPassword(password, salt),
        recoveryCodeHash: hashRecoveryCode(recoveryCode),
        createdAt: Date.now(),
      };
      users.users.push(user);
      saveUsers(users);
      const token = createSession(user.id);
      return send(res, 200, { ok: true, token, username, recoveryCode });
    }

    if (p === '/api/login') {
      const username = String(parsed.username || '').trim();
      const password = String(parsed.password || '');
      const users = loadUsers();
      const user = users.users.find((u) => u.username === username);
      if (!user || !verifyPassword(password, user.salt, user.passHash)) {
        return send(res, 401, { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      }
      const token = createSession(user.id);
      return send(res, 200, { ok: true, token, username });
    }

    if (p === '/api/reset-password') {
      const username = String(parsed.username || '').trim();
      const recoveryCode = String(parsed.recoveryCode || '').trim().toUpperCase();
      const newPassword = String(parsed.newPassword || '');
      if (newPassword.length < 4 || newPassword.length > 64) {
        return send(res, 400, { ok: false, error: '새 비밀번호는 4~64자여야 합니다.' });
      }
      const users = loadUsers();
      const user = users.users.find((u) => u.username === username);
      if (!user || user.recoveryCodeHash !== hashRecoveryCode(recoveryCode)) {
        return send(res, 401, { ok: false, error: '아이디 또는 복구 코드가 올바르지 않습니다.' });
      }
      user.salt = crypto.randomBytes(16).toString('hex');
      user.passHash = hashPassword(newPassword, user.salt);
      saveUsers(users);
      const sessions = loadSessions();
      sessions.sessions = sessions.sessions.filter((s) => s.userId !== user.id);
      saveSessions(sessions);
      const token = createSession(user.id);
      return send(res, 200, { ok: true, token, username });
    }

    if (p === '/api/backup') {
      const user = userByToken(bearerToken(req));
      if (!user) return send(res, 401, { ok: false, error: '로그인이 필요합니다.' });
      const records = loadRecords().records.filter((r) => r.userId === user.id);
      const users = loadUsers();
      const me = users.users.find((u) => u.id === user.id);
      const payload = {
        app: 'ai-interview-lab',
        version: 1,
        exportedAt: Date.now(),
        username: me.username,
        salt: me.salt,
        passHash: me.passHash,
        recoveryCodeHash: me.recoveryCodeHash,
        createdAt: me.createdAt,
        records,
      };
      return send(res, 200, { ok: true, data: Buffer.from(JSON.stringify(payload)).toString('base64') });
    }

    if (p === '/api/restore') {
      const data = String(parsed.data || '');
      let payload;
      try {
        payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
      } catch {
        return send(res, 400, { ok: false, error: '백업 파일을 읽을 수 없습니다.' });
      }
      if (payload.app !== 'ai-interview-lab' || !payload.username || !payload.passHash || !Array.isArray(payload.records)) {
        return send(res, 400, { ok: false, error: '올바르지 않은 백업 파일입니다.' });
      }
      const users = loadUsers();
      let user = users.users.find((u) => u.username === payload.username);
      if (user) {
        if (user.passHash !== payload.passHash || user.salt !== payload.salt) {
          return send(res, 409, { ok: false, error: '같은 아이디의 다른 비밀번호가 이미 존재합니다. 다른 아이디로 복원하거나 기존 계정을 삭제해 주세요.' });
        }
      } else {
        user = {
          id: newId(),
          username: payload.username,
          salt: payload.salt,
          passHash: payload.passHash,
          recoveryCodeHash: payload.recoveryCodeHash || hashRecoveryCode(''),
          createdAt: payload.createdAt || Date.now(),
        };
        users.users.push(user);
        saveUsers(users);
      }
      const records = loadRecords();
      const others = records.records.filter((r) => r.userId !== user.id);
      records.records = others.concat(payload.records.map((r) => ({ ...r, userId: user.id })));
      saveRecords(records);
      return send(res, 200, { ok: true, username: user.username });
    }

    if (p === '/api/logout') {
      destroySession(bearerToken(req));
      return send(res, 200, { ok: true });
    }

    if (p === '/api/records') {
      const user = userByToken(bearerToken(req));
      if (!user) return send(res, 401, { ok: false, error: '로그인이 필요합니다.' });
      const rec = {
        id: newId(),
        userId: user.id,
        createdAt: Date.now(),
        mode: parsed.mode === 'document' ? 'document' : 'passage',
        univName: String(parsed.univName || ''),
        deptName: String(parsed.deptName || ''),
        total: Number(parsed.total) || 0,
        gradeWord: String(parsed.gradeWord || ''),
        grade: String(parsed.grade || ''),
        items: Array.isArray(parsed.items) ? parsed.items : [],
        transcript: Array.isArray(parsed.transcript) ? parsed.transcript : [],
        overtimeSec: Number(parsed.overtimeSec) || 0,
        comprehensive: parsed.comprehensive && typeof parsed.comprehensive === 'object' ? parsed.comprehensive : null,
      };
      const records = loadRecords();
      records.records.push(rec);
      saveRecords(records);
      return send(res, 200, { ok: true, id: rec.id });
    }

    if (p === '/api/extract-text') {
      const filename = typeof parsed.filename === 'string' ? parsed.filename : 'file';
      const data = typeof parsed.data === 'string' ? parsed.data : '';
      if (!data) return send(res, 400, { ok: false, error: '파일 데이터가 필요합니다.' });
      let buf;
      try {
        buf = Buffer.from(data, 'base64');
      } catch {
        return send(res, 400, { ok: false, error: '파일 데이터를 디코딩할 수 없습니다.' });
      }
      try {
        const { text, source } = extractTextFromFile(filename, buf);
        if (!text) {
          return send(res, 422, { ok: false, error: '이 파일에서 텍스트를 추출하지 못했습니다. (스캔 이미지 PDF인 경우 HTML 등으로 변환해 주세요.)' });
        }
        return send(res, 200, { ok: true, text, source, chars: text.length });
      } catch (e) {
        return send(res, 400, { ok: false, error: e.message });
      }
    }

    const prompt = typeof parsed.prompt === 'string' && parsed.prompt.trim() ? parsed.prompt.trim() : null;
    if (!prompt) return send(res, 400, { ok: false, error: 'prompt 필드가 필요합니다.' });

    try {
      const { json, text } = await llmWithRetry(prompt, { model: parsed.model || 'interviewer' });
      return send(res, 200, { ok: true, result: json, raw: text, model: parsed.model || 'interviewer' });
    } catch (e) {
      return send(res, 500, { ok: false, error: e.message });
    }
  }

  return send(res, 404, { ok: false, error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  AI 면접 연습실: http://localhost:' + PORT);
  console.log('  LLM: opencode zen 무료 모델 (' + MODELS.interviewer + ' / 폴백 ' + MODELS.fallback + ')');
  console.log('  종료: Ctrl+C');
  console.log('');
});