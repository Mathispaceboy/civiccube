export interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // 1. Health check
      if (url.pathname === "/" || url.pathname === "/api/health") {
        return new Response(
          JSON.stringify({ status: "online", platform: "CivicCube Edge API" }),
          { headers: CORS_HEADERS }
        );
      }

      // 2. GET /api/issues - List active topics
      if (url.pathname === "/api/issues" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, slug, title, jurisdiction_level, jurisdiction_code, status FROM issues ORDER BY created_at DESC"
        ).all();
        return new Response(JSON.stringify(results), { headers: CORS_HEADERS });
      }

      // 3. GET /api/issues/:slug - Fetch issue brief & statements
      if (url.pathname.startsWith("/api/issues/") && request.method === "GET") {
        const slug = url.pathname.split("/")[3];
        const issue = await env.DB.prepare(
          "SELECT * FROM issues WHERE slug = ?"
        ).bind(slug).first();

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

      // 4. POST /api/statements - Submit a new micro-proposal (max 280 chars)
      if (url.pathname === "/api/statements" && request.method === "POST") {
        const body = (await request.json()) as {
          issue_id: string;
          author_id: string;
          content_text: string;
        };

        if (!body.content_text || body.content_text.length > 280) {
          return new Response(
            JSON.stringify({ error: "Statement must be between 1 and 280 characters." }),
            { status: 400, headers: CORS_HEADERS }
          );
        }

        const stmtId = `stmt-${Date.now()}`;
        await env.DB.prepare(`
          INSERT INTO statements (id, issue_id, author_id, content_text, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(stmtId, body.issue_id, body.author_id, body.content_text, Date.now()).run();

        return new Response(JSON.stringify({ success: true, id: stmtId }), {
          status: 201,
          headers: CORS_HEADERS,
        });
      }

      // 5. POST /api/vote - Record an Agree (1), Disagree (-1), or Pass (0) vote
      if (url.pathname === "/api/vote" && request.method === "POST") {
        const body = (await request.json()) as {
          statement_id: string;
          user_id: string;
          vote_value: number; // 1, -1, 0
          user_cluster_id?: number;
        };

        const cluster = body.user_cluster_id ?? 0;

        await env.DB.prepare(`
          INSERT INTO votes (statement_id, user_id, vote_value, user_cluster_id, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(statement_id, user_id) DO UPDATE SET
            vote_value = excluded.vote_value,
            user_cluster_id = excluded.user_cluster_id
        `).bind(body.statement_id, body.user_id, body.vote_value, cluster, Date.now()).run();

        // Increment counts on statement
        if (body.vote_value === 1) {
          await env.DB.prepare("UPDATE statements SET agree_count = agree_count + 1 WHERE id = ?").bind(body.statement_id).run();
        } else if (body.vote_value === -1) {
          await env.DB.prepare("UPDATE statements SET disagree_count = disagree_count + 1 WHERE id = ?").bind(body.statement_id).run();
        } else {
          await env.DB.prepare("UPDATE statements SET pass_count = pass_count + 1 WHERE id = ?").bind(body.statement_id).run();
        }

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
