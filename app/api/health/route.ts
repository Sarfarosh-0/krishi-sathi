/**
 * GET /api/health — warms the serverless function on page load so the first
 * real question does not pay the cold-start cost (DESIGN §5, PRD §9).
 *
 * No auth, no side effects, no Gemini call.
 *
 * No `runtime` export: `cacheComponents` is enabled in `next.config.ts`, and
 * Next 16 rejects that segment config when it is on. Node is the default.
 */
import { connection } from "next/server";

export async function GET(): Promise<Response> {
  // Require a real request so the route is not prerendered to static output and
  // actually invokes the serverless function — otherwise "warm-up" is a no-op.
  await connection();
  return Response.json({ ok: true });
}
