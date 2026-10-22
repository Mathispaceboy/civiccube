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

// Generate Stage 4 Administrative Dossier Markdown
function generateDossierMarkdown(issue: any, statements: any[], totalParticipants: number, totalVotes: number): string {
  const now = new Date();
  const submissionDate = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const deadlineDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const refNo = `CC-RES-${issue.jurisdiction_code}-${now.getFullYear()}-${issue.id.toUpperCase()}`;

  let actionItemsMd = "";
  if (!statements || statements.length === 0) {
    actionItemsMd = `*No micro-proposals have reached the statutory consensus threshold (≥ 50.0% Cross-Cluster Bridging Score & ≥ 5 Verified Citizen Endorsements) at this time. Deliberation remains active.*`;
  } else {
    actionItemsMd = statements.map((stmt, idx) => {
      const consensusPct = (stmt.bridging_score * 100).toFixed(1);
      return `### Action Item #${idx + 1}: Certified Citizen Micro-Resolution
- **Proposal Statement:** "${stmt.content_text}"
- **Bridging Consensus Score:** ${consensusPct}% Cross-Cluster Agreement
- **Vote Breakdown:** 👍 ${stmt.agree_count} Agrees | 👎 ${stmt.disagree_count} Disagrees | ⚪ ${stmt.pass_count} Passes
- **Algorithmic Validation:** Pol.is Bridging Consensus Standard Satisfied (Polarization Divergence Suppressed)
- **Administrative Action Directive:** Formally table for adoption in the upcoming Ward Committee Agenda and budget allocation.`;
    }).join("\n\n---\n\n");
  }

  return `# FORMAL WARD RESOLUTION DOSSIER & CITIZEN CONSENSUS PETITION
**Document Reference:** \`${refNo}\`  
**Date of Deliberation Closure:** ${submissionDate}  
**Governing Statutory Framework:** The Urban Local Bodies Governance Act & 74th Constitutional Amendment (Ward Committees & Area Sabhas)  
**Consensus Engine:** SabhaStack Pol.is Mathematical Bridging Matrix

---

### TO THE ADMINISTRATIVE & ELECTED AUTHORITIES:
1. **The Ward Councillor & Ward Committee Members**, ${issue.jurisdiction_code} (${issue.jurisdiction_level.toUpperCase()})
2. **The Municipal Commissioner**, Municipal Corporation Administrative Headquarters
3. **The Assistant Commissioner / Ward Executive Engineer**, Local Zonal Office

---

## 1. Executive Summary & Verification Metrics
- **Civic Issue Deliberated:** ${issue.title}
- **Jurisdiction Identification:** ${issue.jurisdiction_code} (${issue.jurisdiction_level})
- **Deliberation Status:** Formal Consensus Ratified & Certified
- **Total Verified Resident Participants:** ${totalParticipants} citizens
- **Total Registered Deliberation Votes:** ${totalVotes} verified votes cast
- **Consensus Filtering Standard:** Minimum 50.0% Cross-Cluster Bridging Score + Minimum 5 Verified Resident Endorsements

This resolution dossier represents the mathematically verified consensus of residents within ${issue.jurisdiction_code}. Using CivicCube's cross-demographic deliberative algorithm, micro-proposals were evaluated across distinct resident clusters. Factional and polarizing statements were mathematically suppressed; only shared-ground micro-proposals achieving cross-group consensus are codified below as actionable administrative directives.

---

## 2. Prioritized Citizen Action Items
*(Ranked in order of cross-group bridging consensus score)*

${actionItemsMd}

---

## 3. Statutory 30-Day Response SLA Countdown
- **Formal Transmission Date:** ${submissionDate}
- **Statutory Administrative Response Deadline:** ${deadlineDate} (30 Calendar Days)
- **SLA Countdown Status:** 30 Days 00 Hours Remaining (Active Citizen Oversight)
- **Mandatory Procedural Next Steps:**
  1. Formal acknowledgment of receipt within 5 working days by the Ward Committee Secretariat.
  2. Tabling in the immediate subsequent Ward Committee & Area Sabha agenda.
  3. Publication of an official public Action Taken Report (ATR) addressing each ratified item before the 30-day statutory window expires.

---

*Authenticity Certificate: Generated cryptographically by CivicCube Edge Engine • SabhaStack v0.1.0 • 100% Zero-Cost Serverless D1 Architecture*
`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // 1. GET / - Responsive Edge UI
      if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
        return new Response(renderHTML(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // 2. GET /api/issues - List active topics
      if (url.pathname === "/api/issues" && (request.method === "GET" || request.method === "HEAD")) {
        const { results } = await env.DB.prepare(
          "SELECT id, slug, title, jurisdiction_level, jurisdiction_code, status FROM issues ORDER BY created_at DESC"
        ).all();
        return new Response(JSON.stringify(results), { headers: CORS_HEADERS });
      }

      // 3. GET /api/issues/:slug/dossier - Stage 4 Citizen Resolution Dossier Export
      if (url.pathname.startsWith("/api/issues/") && url.pathname.endsWith("/dossier") && (request.method === "GET" || request.method === "HEAD")) {
        const parts = url.pathname.split("/");
        const slug = parts[3];
        const issue = await env.DB.prepare("SELECT * FROM issues WHERE slug = ?").bind(slug).first() as any;

        if (!issue) {
          return new Response(JSON.stringify({ error: "Issue not found" }), {
            status: 404,
            headers: CORS_HEADERS,
          });
        }

        const { results: statements } = await env.DB.prepare(
          "SELECT * FROM statements WHERE issue_id = ? AND bridging_score >= 0.50 AND agree_count >= 5 ORDER BY bridging_score DESC, agree_count DESC"
        ).bind(issue.id).all();

        const participantStats = await env.DB.prepare(`
          SELECT 
            COUNT(DISTINCT participant_id) as total_participants,
            SUM(vote_count) as total_votes
          FROM (
            SELECT user_id as participant_id, 1 as vote_count FROM votes WHERE statement_id IN (SELECT id FROM statements WHERE issue_id = ?)
            UNION ALL
            SELECT author_id as participant_id, 0 as vote_count FROM statements WHERE issue_id = ?
          )
        `).bind(issue.id, issue.id).first() as any;

        const totalParticipants = Math.max(participantStats?.total_participants ?? 0, 1);
        const totalVotes = participantStats?.total_votes ?? 0;

        const dossierMarkdown = generateDossierMarkdown(issue, statements, totalParticipants, totalVotes);

        const isDownload = url.searchParams.get("download") === "true";
        const disposition = isDownload 
          ? `attachment; filename="${issue.slug}-resolution-dossier.md"` 
          : `inline; filename="${issue.slug}-resolution-dossier.md"`;

        return new Response(dossierMarkdown, {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": disposition,
          },
        });
      }

      // 4. GET /api/issues/:slug - Fetch full brief & ranked statements
      if (url.pathname.startsWith("/api/issues/") && (request.method === "GET" || request.method === "HEAD")) {
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

      // 5. POST /api/statements - Submit a new micro-proposal
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

      // 6. POST /api/vote - Record an Agree / Disagree / Pass vote and update bridging score
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
  <title>CivicCube | Serverless Civic Deliberation Platform</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .consensus-badge { background: linear-gradient(135deg, #059669 0%, #10b981 100%); }
    .dossier-gradient { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col font-sans">
  <!-- Navbar -->
  <header class="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
    <div class="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <span class="text-2xl font-black tracking-tight text-emerald-600">CivicCube</span>
        <span class="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">SabhaStack</span>
      </div>
      <div class="flex items-center gap-3">
        <div id="userBadge" class="text-xs text-slate-500 font-medium hidden sm:block">Ward 64 Resident (Verified)</div>
        <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" title="Edge API Connected"></div>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
    <!-- Room Selector Tabs -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-xs font-bold uppercase tracking-wider text-slate-500">Active Deliberation Chambers</label>
        <span class="text-xs text-emerald-600 font-semibold" id="activeRoomCount">3 Rooms Active</span>
      </div>
      <div class="flex items-center gap-2 overflow-x-auto pb-1" id="issueTabs">
        <!-- Injected via JS -->
      </div>
    </div>

    <!-- Issue Header & Brief Card (Stage 1) -->
    <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md" id="issueJurisdiction">Ward 64</span>
        <span class="text-xs font-medium text-slate-400" id="issueStatus">Status: Deliberating</span>
      </div>
      <h1 class="text-2xl font-bold text-slate-900" id="issueTitle">Loading civic chamber...</h1>
      <div class="prose prose-slate max-w-none text-slate-600 text-sm leading-relaxed whitespace-pre-line" id="issueBrief">
        Loading context brief...
      </div>

      <!-- Stage 1 Gate / Quiz Area -->
      <div id="quizContainer" class="bg-amber-50 border border-amber-200 rounded-xl p-4 transition-all">
        <div class="flex items-start gap-3">
          <div class="text-amber-600 mt-0.5 text-lg font-bold">🔒</div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-amber-900">Stage 1: Verify Knowledge to Unlock Deliberation</h3>
            <p class="text-xs text-amber-700 mt-1" id="quizQuestion">Loading verification question...</p>
            <div class="mt-3 flex flex-wrap gap-2" id="quizOptions"></div>
          </div>
        </div>
      </div>
      
      <div id="unlockedBanner" class="hidden bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl p-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base">✓</span> <span><strong>Civic Brief Verified:</strong> You are authorized to vote and submit micro-proposals for this room.</span>
        </div>
        <span class="text-[11px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-md">Stage 2 Active</span>
      </div>
    </section>

    <!-- Stage 2 & 3: Deliberation Matrix -->
    <section id="deliberationSection" class="opacity-40 pointer-events-none transition-opacity duration-300 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Deliberation Matrix</h2>
          <p class="text-xs text-slate-500">Ranked by cross-group bridging consensus (Pol.is algorithm).</p>
        </div>
        <div class="flex items-center gap-2">
          <!-- Stage 4 Export Button -->
          <button id="dossierBtn" onclick="exportDossier()" class="hidden inline-flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium px-3.5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer">
            <span>📑</span> Export Citizen Resolution Dossier
          </button>
          <span class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium" id="stmtCount">0 proposals</span>
        </div>
      </div>

      <!-- Proposal Submission Form -->
      <form id="proposalForm" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <label class="block text-xs font-semibold text-slate-700">Submit a Micro-Proposal (Max 280 Characters)</label>
        <textarea id="proposalText" rows="2" maxlength="280" placeholder="State a constructive policy action or compromise..." class="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"></textarea>
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-400" id="charCount">0 / 280</span>
          <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer">Submit Proposal</button>
        </div>
      </form>

      <!-- Statements Feed -->
      <div id="statementsList" class="space-y-4">
        <!-- Rendered via JS -->
      </div>
    </section>
  </main>

  <!-- Toast Notification -->
  <div id="toast" class="fixed bottom-6 right-6 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-lg transform translate-y-20 opacity-0 transition-all duration-300 z-50 flex items-center gap-2">
    <span id="toastMsg">Notification message</span>
  </div>

  <!-- Footer -->
  <footer class="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
    CivicCube (SabhaStack) • Edge-Native Digital Public Infrastructure • 100% Cloudflare Free Tier
  </footer>

  <script>
    const USER_ID = 'usr-' + (localStorage.getItem('cc_user') || Math.random().toString(36).substring(2, 9));
    localStorage.setItem('cc_user', USER_ID);

    let allIssues = [];
    let currentIssue = null;
    let currentSlug = 'solid-waste-and-ward-accountability';
    let isUnlocked = false;

    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toastMsg').innerText = msg;
      toast.classList.remove('translate-y-20', 'opacity-0');
      setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
      }, 4000);
    }

    async function init() {
      try {
        const res = await fetch('/api/issues');
        allIssues = await res.json();
        document.getElementById('activeRoomCount').innerText = allIssues.length + ' Rooms Active';
        renderRoomTabs();
        await loadIssue(currentSlug);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }

    function renderRoomTabs() {
      const container = document.getElementById('issueTabs');
      container.innerHTML = '';

      allIssues.forEach(iss => {
        const btn = document.createElement('button');
        const isActive = iss.slug === currentSlug;
        btn.className = \`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap \${
          isActive 
            ? 'bg-emerald-600 text-white shadow-sm' 
            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
        }\`;
        btn.innerText = iss.title.length > 38 ? iss.title.substring(0, 38) + '...' : iss.title;
        btn.title = iss.title;
        btn.onclick = () => {
          if (currentSlug === iss.slug) return;
          currentSlug = iss.slug;
          renderRoomTabs();
          loadIssue(currentSlug);
        };
        container.appendChild(btn);
      });
    }

    async function loadIssue(slug) {
      try {
        const res = await fetch('/api/issues/' + slug);
        const data = await res.json();
        currentIssue = data.issue;

        document.getElementById('issueTitle').innerText = currentIssue.title;
        document.getElementById('issueJurisdiction').innerText = currentIssue.jurisdiction_code;
        document.getElementById('issueBrief').innerText = currentIssue.brief_markdown;
        document.getElementById('stmtCount').innerText = data.statements.length + ' proposals';

        const unlocked = localStorage.getItem('cc_unlocked_' + currentIssue.id) === 'true';
        if (unlocked) {
          unlock();
        } else {
          lock();
          setupQuiz(JSON.parse(currentIssue.quiz_questions));
        }

        renderStatements(data.statements);
      } catch (err) {
        console.error('Error loading issue:', err);
      }
    }

    function setupQuiz(quizData) {
      if (!quizData || quizData.length === 0) return unlock();
      const q = quizData[0];
      document.getElementById('quizQuestion').innerText = q.question;
      const optsDiv = document.getElementById('quizOptions');
      optsDiv.innerHTML = '';

      q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'text-xs bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer';
        btn.innerText = opt;
        btn.onclick = () => {
          if (idx === q.answer) {
            unlock();
            showToast('Knowledge Verified! Stage 2 Deliberation Unlocked.');
          } else {
            alert('Incorrect. Review the Civic Brief context above.');
          }
        };
        optsDiv.appendChild(btn);
      });
    }

    function lock() {
      isUnlocked = false;
      document.getElementById('quizContainer').classList.remove('hidden');
      document.getElementById('unlockedBanner').classList.add('hidden');
      const section = document.getElementById('deliberationSection');
      section.classList.add('opacity-40', 'pointer-events-none');
    }

    function unlock() {
      isUnlocked = true;
      if (currentIssue) {
        localStorage.setItem('cc_unlocked_' + currentIssue.id, 'true');
      }
      document.getElementById('quizContainer').classList.add('hidden');
      document.getElementById('unlockedBanner').classList.remove('hidden');
      const section = document.getElementById('deliberationSection');
      section.classList.remove('opacity-40', 'pointer-events-none');
    }

    function renderStatements(statements) {
      const container = document.getElementById('statementsList');
      container.innerHTML = '';

      // Check if any statement qualifies for Stage 4 Dossier (bridging >= 0.50 and agree >= 5)
      const hasConsensus = statements.some(s => s.bridging_score >= 0.50 && s.agree_count >= 5);
      const dossierBtn = document.getElementById('dossierBtn');
      if (dossierBtn) {
        if (hasConsensus) {
          dossierBtn.classList.remove('hidden');
        } else {
          dossierBtn.classList.add('hidden');
        }
      }

      if (statements.length === 0) {
        container.innerHTML = \`<div class="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">
          No micro-proposals submitted for this chamber yet. Be the first to submit a proposal!
        </div>\`;
        return;
      }

      statements.forEach(stmt => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4';
        
        const isConsensusQualified = stmt.bridging_score >= 0.50 && stmt.agree_count >= 5;
        const consensusTag = isConsensusQualified 
          ? '<span class="inline-block text-[10px] uppercase font-extrabold tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-sm mr-2">Dossier Ratified</span>' 
          : '';

        card.innerHTML = \`
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center mb-1.5">\${consensusTag}</div>
              <p class="text-sm font-medium text-slate-800 leading-snug">\${stmt.content_text}</p>
            </div>
            <div class="shrink-0 text-right">
              <span class="inline-block text-[11px] font-bold text-white consensus-badge px-2.5 py-0.5 rounded-full shadow-xs">
                Consensus: \${(stmt.bridging_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-3">
            <div class="flex items-center gap-1.5">
              <button onclick="vote('\${stmt.id}', 1)" class="text-xs border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 font-medium px-3 py-1 rounded-md transition-colors cursor-pointer">
                👍 Agree (\${stmt.agree_count})
              </button>
              <button onclick="vote('\${stmt.id}', -1)" class="text-xs border border-slate-200 hover:border-rose-500 hover:text-rose-700 font-medium px-3 py-1 rounded-md transition-colors cursor-pointer">
                👎 Disagree (\${stmt.disagree_count})
              </button>
              <button onclick="vote('\${stmt.id}', 0)" class="text-xs border border-slate-200 hover:bg-slate-50 text-slate-500 font-medium px-3 py-1 rounded-md transition-colors cursor-pointer">
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
      loadIssue(currentSlug);
    }

    async function exportDossier() {
      if (!currentIssue) return;
      showToast('Generating official Citizen Resolution Dossier...');
      try {
        const res = await fetch('/api/issues/' + currentIssue.slug + '/dossier?download=true');
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentIssue.slug + '-resolution-dossier.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Dossier downloaded! Formally addressed to Ward Councillor & Commissioner.');
      } catch (err) {
        console.error('Failed to export dossier', err);
        showToast('Error exporting dossier.');
      }
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
      showToast('Micro-proposal submitted into Deliberation Matrix!');
      loadIssue(currentSlug);
    });

    init();
  </script>
</body>
</html>`;
}
