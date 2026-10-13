import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// ── .env (bez dodatkowych zależności) ───────────────────────────────
try {
  const content = readFileSync(path.join(root, '.env'), 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

const port = Number(process.env.PORT || 4173);
const maxBody = 200_000;
const timeoutMs = Number(process.env.TIMEOUT_SECONDS || 300) * 1000;
const cfg = {
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.5',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
  // web_search_20250305 = zwykłe wyszukiwanie; nowsze wersje (np. web_search_20260318) dodają filtrowanie wyników.
  claudeSearchTool: process.env.CLAUDE_SEARCH_TOOL || 'web_search_20250305',
  maxSearches: Number(process.env.MAX_SEARCHES || 8)
};

// ── Prompty ──────────────────────────────────────────────────────────
const SYSTEM_ANSWER = `Odpowiadasz rzetelnie i po polsku (chyba że pytanie jest w innym języku).
- Gdy pytanie dotyczy faktów, badań, wytycznych lub rzeczy zmiennych w czasie, użyj wyszukiwania i podaj źródła.
- W tematach zdrowotnych i naukowych opieraj się na hierarchii dowodów: wytyczne kliniczne, przeglądy systematyczne i metaanalizy, RCT; zaznaczaj siłę i ograniczenia dowodów.
- Oddzielaj to, co wiadomo, od tego, co niepewne. Nie wymyślaj źródeł.`;

function reviewPrompt(text, source, question) {
  return `Jesteś niezależnym weryfikatorem merytorycznym. Sprawdź poniższą odpowiedź modelu ${source}.
${question ? `\nPYTANIE, NA KTÓRE ODPOWIADAŁ MODEL:\n<<<\n${question}\n>>>\n` : ''}
Zasady:
- Rozbij odpowiedź na sprawdzalne twierdzenia i oceń każde osobno: ✅ POTWIERDZONE, 🟡 CZĘŚCIOWO, ❔ NIEPOTWIERDZONE albo ❌ BŁĘDNE.
- Weryfikuj w aktualnych źródłach przez wyszukiwanie. Preferuj źródła pierwotne: wytyczne, przeglądy systematyczne, recenzowane badania, oficjalną dokumentację.
- Przy każdym ocenionym twierdzeniu podaj link do źródła. Nie wymyślaj cytowań; brak wyniku wyszukiwania to nie potwierdzenie.
- Wskaż ważne pominięcia (czego zabrakło w odpowiedzi), jeśli zmieniają wnioski.
- Oddziel to, co mówią źródła, od własnej interpretacji. Zaznacz, gdy dowody są słabe lub sprzeczne.
- Zacznij od jednej linii: "OCENA OGÓLNA: <rzetelna / z drobnymi błędami / wymaga korekty / niewiarygodna>".
- Zakończ sekcją "Werdykt": co jest wiarygodne, co poprawić, czego nie da się rozstrzygnąć.

ODPOWIEDŹ DO SPRAWDZENIA:
<<<
${text}
>>>`;
}

// ── Pomocnicze ───────────────────────────────────────────────────────
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function jsonBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxBody) throw new Error('Tekst jest zbyt długi (limit ok. 200 KB).');
  }
  return JSON.parse(raw || '{}');
}

const unique = items => [...new Map(items.map(x => [x.url, x])).values()];

async function postJSON(url, headers, body, label) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error(`${label}: przekroczono czas oczekiwania.`);
    throw new Error(`${label}: brak połączenia (${e.message}).`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label}: ${data.error?.message || `HTTP ${response.status}`}`);
  return data;
}

// ── OpenAI (Responses API + web_search) ─────────────────────────────
async function callOpenAI(input, instructions) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Brak OPENAI_API_KEY w pliku .env.');
  const data = await postJSON('https://api.openai.com/v1/responses',
    { authorization: `Bearer ${key}` },
    { model: cfg.openaiModel, tools: [{ type: 'web_search' }], instructions, input },
    'OpenAI API');
  const parts = (data.output || []).flatMap(x => x.content || []).filter(x => x.type === 'output_text');
  const text = data.output_text || parts.map(x => x.text).join('\n');
  const citations = [];
  for (const p of parts) for (const a of p.annotations || []) {
    if (a.type === 'url_citation' && a.url) citations.push({ title: a.title || a.url, url: a.url });
  }
  return { text: text || 'Model nie zwrócił tekstu.', citations: unique(citations), model: data.model || cfg.openaiModel };
}

// ── Claude (Messages API + web_search, z obsługą pause_turn) ────────
async function callClaude(userText, system) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Brak ANTHROPIC_API_KEY w pliku .env.');
  const messages = [{ role: 'user', content: userText }];
  const content = [];
  let data;
  for (let i = 0; i < 4; i++) {
    data = await postJSON('https://api.anthropic.com/v1/messages',
      { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      {
        model: cfg.claudeModel, max_tokens: 8000, system,
        tools: [{ type: cfg.claudeSearchTool, name: 'web_search', max_uses: cfg.maxSearches }],
        messages
      }, 'Anthropic API');
    content.push(...(data.content || []));
    if (data.stop_reason !== 'pause_turn') break;
    // Długie wyszukiwanie zostało wstrzymane — odsyłamy wiadomość bez zmian, żeby kontynuować.
    if (messages.at(-1).role === 'assistant') messages.pop();
    messages.push({ role: 'assistant', content });
  }
  // Pomijamy krótkie zapowiedzi typu „Sprawdzę to…” sprzed wyszukiwania.
  const lastToolIdx = content.findLastIndex(b => b.type !== 'text');
  const textBlocks = content.slice(lastToolIdx + 1).filter(b => b.type === 'text');
  const text = (textBlocks.length ? textBlocks : content.filter(b => b.type === 'text')).map(b => b.text).join('');
  const citations = [];
  for (const b of content) for (const c of b.citations || []) if (c.url) citations.push({ title: c.title || c.url, url: c.url });
  const note = data.stop_reason === 'max_tokens' ? '\n\n[Odpowiedź ucięta — osiągnięto limit długości.]' : '';
  return { text: (text || 'Model nie zwrócił tekstu.') + note, citations: unique(citations), model: data.model || cfg.claudeModel };
}

const ask = (provider, q) => provider === 'openai' ? callOpenAI(q, SYSTEM_ANSWER) : callClaude(q, SYSTEM_ANSWER);
const review = (reviewer, text, source, question) => {
  const p = reviewPrompt(text, source, question);
  return reviewer === 'openai' ? callOpenAI(p) : callClaude(p);
};

// ── Router ───────────────────────────────────────────────────────────
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/status') {
    return send(res, 200, {
      openai: Boolean(process.env.OPENAI_API_KEY), claude: Boolean(process.env.ANTHROPIC_API_KEY),
      openaiModel: cfg.openaiModel, claudeModel: cfg.claudeModel
    });
  }

  if (req.method === 'POST' && (url.pathname === '/api/ask' || url.pathname === '/api/review')) {
    try {
      const body = await jsonBody(req);
      if (url.pathname === '/api/ask') {
        const { provider, question } = body;
        if (typeof question !== 'string' || !question.trim()) return send(res, 400, { error: 'Wpisz pytanie.' });
        if (!['openai', 'claude'].includes(provider)) return send(res, 400, { error: 'Nieznany dostawca.' });
        return send(res, 200, await ask(provider, question.trim()));
      }
      const { text, source, reviewer, question } = body;
      if (typeof text !== 'string' || !text.trim()) return send(res, 400, { error: 'Brak tekstu do sprawdzenia.' });
      if (!['Claude', 'ChatGPT'].includes(source) || !['openai', 'claude'].includes(reviewer)) return send(res, 400, { error: 'Nieprawidłowy kierunek weryfikacji.' });
      return send(res, 200, await review(reviewer, text.trim(), source, typeof question === 'string' ? question.trim() : ''));
    } catch (error) {
      return send(res, 500, { error: error.message || 'Wystąpił błąd.' });
    }
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    try { return send(res, 200, await readFile(path.join(root, 'public', 'index.html'), 'utf8'), 'text/html; charset=utf-8'); }
    catch { return send(res, 500, 'Nie znaleziono pliku public/index.html.', 'text/plain; charset=utf-8'); }
  }
  return send(res, 404, { error: 'Nie znaleziono strony.' });
}

http.createServer((req, res) => { handle(req, res).catch(() => send(res, 500, { error: 'Błąd serwera.' })); })
  .listen(port, '127.0.0.1', () => {
    console.log(`\n  FactCheck Duo działa: http://localhost:${port}`);
    console.log(`  OpenAI: ${process.env.OPENAI_API_KEY ? 'OK' : 'brak klucza'} (${cfg.openaiModel}) · Claude: ${process.env.ANTHROPIC_API_KEY ? 'OK' : 'brak klucza'} (${cfg.claudeModel})`);
    console.log('  Zatrzymanie: Ctrl+C\n');
  });
