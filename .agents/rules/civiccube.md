---
trigger: alwaysOn
description: CivicCube architecture guidelines and democratic principles
---
# CivicCube Architecture & Development Rules

## Core System Boundaries
- Zero Cost: Maintain operations within Cloudflare's Free Tier (Workers 100k req/day, D1 5M reads/day, KV 100k reads/day).
- Frontend: Sub-50ms TTFB edge-rendered or static delivery.
- Backend: Edge Worker handlers communicating with Cloudflare D1 via prepared statements (`env.DB.prepare(...).bind(...)`).

## 5 Principles of Democracy Enforcement
1. Electoral: Deliberation outputs format into formal administrative resolution dossiers for ward/municipal bodies.
2. Liberal: Majority cannot suppress minority rights; protect constitutional safeguards.
3. Egalitarian: Equal voice credit allotment; separate metrics for hyper-local ward residents vs. general observers.
4. Participatory: Direct citizen micro-proposals (max 280 chars) and Agree/Disagree/Pass consensus voting.
5. Deliberative: Rank statements using the Bridging Consensus Algorithm:
   Bridging Score = P(Agree|GroupA) * P(Agree|GroupB) * (1 - |P(Agree|GroupA) - P(Agree|GroupB)|).
   Polarizing statements are algorithmically suppressed; shared common ground is elevated.
