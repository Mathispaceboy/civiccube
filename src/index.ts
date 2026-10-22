export interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Mathematical Bridging Consensus Calculation
// Formula: P(Agree|A) * P(Agree|B) * (1 - |P(Agree|A) - P(Agree|B)|)
async function recalculateBridgingScore(db: D1Database, statementId: string) {
  const { results: votes } = await db.prepare(
    "SELECT vote_value, user_cluster_id FROM votes WHERE statement_id = ?"
  ).bind(statementId).all();

  if (!votes || votes.length === 0) return;

  const clusterA = votes.filter((v: any) => v.user_cluster_id === 0);
  const clusterB = votes.filter((v: any) => v.user_cluster_id === 1);

  // If all votes are in one cluster, use a baseline ratio
  const pA = clusterA.length > 0
    ? clusterA.filter((v: any) => v.vote_value === 1).length / clusterA.length
    : 0.5;
  const pB = clusterB.length > 0
    ? clusterB.filter((v: any) => v.vote_value === 1).length / clusterB.length
    : pA;

  const spread = Math.abs(pA - pB);
  const bridgingScore = Number((pA * pB * (1 - spread)).toFixed(4));

  await db.prepare(
    "UPDATE statements SET bridging_score = ? WHERE id = ?"
  ).bind(bridgingScore, statementId).run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // 1. GET / - Responsive Edge UI
      if (url.pathname === "/" && request.method === "GET") {
        return new Response(renderHTML(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // 2. GET /api/issues - List active topics
      if (url.pathname === "/api/issues" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, slug, title, jurisdiction_level, jurisdiction_code, status FROM issues ORDER BY created_at DESC"
        ).all();
        return new Response(JSON.stringify(results), { headers: CORS_HEADERS });
      }

      // 3. GET /api/issues/:slug - Fetch full brief & ranked statements
      if (url.pathname.startsWith("/api/issues/") && request.method === "GET") {
        const slug = url.pathname.split("/")[3];
        const issue = await env.DB.prepare("SELECT * FROM issues WHERE slug = ?").bind(slug).first();

        if (!issue) {
          return new Response(JSON.stringify({ error: "Issue not found" }), {
            status: 404,
            headers: CORS_HEADERS,
          });
        }

        const { results: statements } = await env.DB.prepare(
          "SELECT * FROM statements WHERE issue_id = ? ORDER BY bridging_score DESC, agree_count DESC"
        ).bind(issue.id).all();

        return new Response(JSON.stringify({ issue, statements }), { headers: CORS_HEADERS });
      }

      // 4. POST /api/statements - Submit a new micro-proposal
      if (url.pathname === "/api/statements" && request.method === "POST") {
        const body = (await request.json()) as {
          issue_id: string;
          author_id: string;
          content_text: string;
        };

        if (!body.content_text || body.content_text.trim().length === 0 || body.content_text.length > 280) {
          return new Response(
            JSON.stringify({ error: "Statement must be between 1 and 280 characters." }),
            { status: 400, headers: CORS_HEADERS }
          );
        }

        // Ensure user exists to satisfy foreign key constraint
        await env.DB.prepare(`
          INSERT OR IGNORE INTO users (id, auth_provider_id, ward_or_zone, is_verified_resident, voice_credits_remaining, created_at)
          VALUES (?, ?, 'WARD_64_CBE', 1, 5, ?)
        `).bind(body.author_id, `anon|${body.author_id}`, Date.now()).run();

        const stmtId = `stmt-${Date.now()}`;
        await env.DB.prepare(`
          INSERT INTO statements (id, issue_id, author_id, content_text, bridging_score, created_at)
          VALUES (?, ?, ?, ?, 0.0, ?)
        `).bind(stmtId, body.issue_id, body.author_id, body.content_text.trim(), Date.now()).run();

        return new Response(JSON.stringify({ success: true, id: stmtId }), {
          status: 201,
          headers: CORS_HEADERS,
        });
      }

      // 5. POST /api/vote - Record an Agree / Disagree / Pass vote and update bridging score
      if (url.pathname === "/api/vote" && request.method === "POST") {
        const body = (await request.json()) as {
          statement_id: string;
          user_id: string;
          vote_value: number; // 1 = Agree, -1 = Disagree, 0 = Pass
          user_cluster_id?: number;
        };

        const cluster = body.user_cluster_id ?? 0;

        // Ensure user exists to satisfy foreign key constraint
        await env.DB.prepare(`
          INSERT OR IGNORE INTO users (id, auth_provider_id, ward_or_zone, is_verified_resident, voice_credits_remaining, created_at)
          VALUES (?, ?, 'WARD_64_CBE', 1, 5, ?)
        `).bind(body.user_id, `anon|${body.user_id}`, Date.now()).run();

        await env.DB.prepare(`
          INSERT INTO votes (statement_id, user_id, vote_value, user_cluster_id, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(statement_id, user_id) DO UPDATE SET
            vote_value = excluded.vote_value,
            user_cluster_id = excluded.user_cluster_id
        `).bind(body.statement_id, body.user_id, body.vote_value, cluster, Date.now()).run();

        // Update vote counts
        if (body.vote_value === 1) {
          await env.DB.prepare("UPDATE statements SET agree_count = agree_count + 1 WHERE id = ?").bind(body.statement_id).run();
        } else if (body.vote_value === -1) {
          await env.DB.prepare("UPDATE statements SET disagree_count = disagree_count + 1 WHERE id = ?").bind(body.statement_id).run();
        } else {
          await env.DB.prepare("UPDATE statements SET pass_count = pass_count + 1 WHERE id = ?").bind(body.statement_id).run();
        }

        // Trigger mathematical bridging recalculation
        await recalculateBridgingScore(env.DB, body.statement_id);

        return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS });
      }

      return new Response(JSON.stringify({ error: "Endpoint not found" }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};

function renderHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CivicCube | Serverless Deliberation</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .consensus-badge { background: linear-gradient(135deg, #059669 0%, #10b981 100%); }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col font-sans">
  <!-- Navbar -->
  <header class="border-b border-slate-200 bg-white sticky top-0 z-30">
    <div class="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <span class="text-2xl font-black tracking-tight text-emerald-600">CivicCube</span>
        <span class="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">SabhaStack</span>
      </div>
      <div id="userBadge" class="text-xs text-slate-500 font-medium">Ward 64 Resident (Anonymous)</div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
    <!-- Issue Header & Brief Card -->
    <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md" id="issueJurisdiction">Ward 64</span>
        <span class="text-xs font-medium text-slate-400" id="issueStatus">Status: Deliberating</span>
      </div>
      <h1 class="text-2xl font-bold text-slate-900 mb-4" id="issueTitle">Loading civic issue...</h1>
      <div class="prose prose-slate max-w-none text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-line" id="issueBrief">
        Loading context brief...
      </div>

      <!-- Stage 1 Gate / Quiz Area -->
      <div id="quizContainer" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <div class="text-amber-600 mt-0.5 text-lg font-bold">🔒</div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-amber-900">Stage 1: Verify Knowledge to Unlock Deliberation</h3>
            <p class="text-xs text-amber-700 mt-1" id="quizQuestion">Loading verification question...</p>
            <div class="mt-3 flex flex-wrap gap-2" id="quizOptions"></div>
          </div>
        </div>
      </div>
      
      <div id="unlockedBanner" class="hidden bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl p-3 flex items-center gap-2">
        <span>✓</span> <strong>Civic Brief Verified:</strong> You have unlocked voting and micro-proposal submission.
      </div>
    </section>

    <!-- Stage 2: Deliberation Matrix -->
    <section id="deliberationSection" class="opacity-40 pointer-events-none transition-opacity duration-300 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Deliberation Matrix</h2>
          <p class="text-xs text-slate-500">Ranked by cross-group bridging consensus (Pol.is algorithm).</p>
        </div>
        <span class="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium" id="stmtCount">0 proposals</span>
      </div>

      <!-- Proposal Submission Form -->
      <form id="proposalForm" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <label class="block text-xs font-semibold text-slate-700">Submit a Micro-Proposal (Max 280 Characters)</label>
        <textarea id="proposalText" rows="2" maxlength="280" placeholder="State a constructive policy action or compromise..." class="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"></textarea>
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-400" id="charCount">0 / 280</span>
          <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">Submit Proposal</button>
        </div>
      </form>

      <!-- Statements Feed -->
      <div id="statementsList" class="space-y-4">
        <!-- Rendered via JS -->
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
    CivicCube • Edge-Native Digital Public Infrastructure • 100% Cloudflare Free Tier
  </footer>

  <script>
    const USER_ID = 'usr-' + (localStorage.getItem('cc_user') || Math.random().toString(36).substring(2, 9));
    localStorage.setItem('cc_user', USER_ID);
    let currentIssue = null;
    let isUnlocked = false;

    async function init() {
      const res = await fetch('/api/issues/solid-waste-and-ward-accountability');
      const data = await res.json();
      currentIssue = data.issue;

      document.getElementById('issueTitle').innerText = currentIssue.title;
      document.getElementById('issueJurisdiction').innerText = currentIssue.jurisdiction_code;
      document.getElementById('issueBrief').innerText = currentIssue.brief_markdown;
      document.getElementById('stmtCount').innerText = data.statements.length + ' proposals';

      setupQuiz(JSON.parse(currentIssue.quiz_questions));
      renderStatements(data.statements);
    }

    function setupQuiz(quizData) {
      if (!quizData || quizData.length === 0) return unlock();
      const q = quizData[0];
      document.getElementById('quizQuestion').innerText = q.question;
      const optsDiv = document.getElementById('quizOptions');
      optsDiv.innerHTML = '';

      q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'text-xs bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg transition-colors';
        btn.innerText = opt;
        btn.onclick = () => {
          if (idx === q.answer) {
            unlock();
          } else {
            alert('Incorrect. Review the Civic Brief context above.');
          }
        };
        optsDiv.appendChild(btn);
      });
    }

    function unlock() {
      isUnlocked = true;
      document.getElementById('quizContainer').classList.add('hidden');
      document.getElementById('unlockedBanner').classList.remove('hidden');
      const section = document.getElementById('deliberationSection');
      section.classList.remove('opacity-40', 'pointer-events-none');
    }

    function renderStatements(statements) {
      const container = document.getElementById('statementsList');
      container.innerHTML = '';

      statements.forEach(stmt => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4';
        card.innerHTML = \`
          <div class="flex items-start justify-between gap-4">
            <p class="text-sm font-medium text-slate-800 leading-snug">\${stmt.content_text}</p>
            <div class="shrink-0 text-right">
              <span class="inline-block text-[11px] font-bold text-white consensus-badge px-2.5 py-0.5 rounded-full">
                Consensus: \${(stmt.bridging_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-3">
            <div class="flex items-center gap-1.5">
              <button onclick="vote('\${stmt.id}', 1)" class="text-xs border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 font-medium px-3 py-1 rounded-md transition-colors">
                👍 Agree (\${stmt.agree_count})
              </button>
              <button onclick="vote('\${stmt.id}', -1)" class="text-xs border border-slate-200 hover:border-rose-500 hover:text-rose-700 font-medium px-3 py-1 rounded-md transition-colors">
                👎 Disagree (\${stmt.disagree_count})
              </button>
              <button onclick="vote('\${stmt.id}', 0)" class="text-xs border border-slate-200 hover:bg-slate-50 text-slate-500 font-medium px-3 py-1 rounded-md transition-colors">
                Pass (\${stmt.pass_count})
              </button>
            </div>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    async function vote(stmtId, val) {
      if (!isUnlocked) return;
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement_id: stmtId, user_id: USER_ID, vote_value: val })
      });
      init();
    }

    document.getElementById('proposalText').addEventListener('input', (e) => {
      document.getElementById('charCount').innerText = e.target.value.length + ' / 280';
    });

    document.getElementById('proposalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('proposalText').value.trim();
      if (!text || !currentIssue) return;

      await fetch('/api/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: currentIssue.id, author_id: USER_ID, content_text: text })
      });

      document.getElementById('proposalText').value = '';
      document.getElementById('charCount').innerText = '0 / 280';
      init();
    });

    init();
  </script>
</body>
</html>`;
}
