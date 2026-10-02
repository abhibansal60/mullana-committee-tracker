import { NextResponse } from "next/server";
import { getCurrentPlayer, isLiveSchemaMissing, LiveError, type Player } from "./queries";

export const SCHEMA_MISSING_MESSAGE =
  "Live auctions need a one-time database update (npm run db:push). Everything else keeps working.";

export async function currentPlayerOr401(): Promise<Player | NextResponse> {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "Please log in again" }, { status: 401 });
  return player;
}

/** Maps LiveError / missing-schema errors to JSON responses; rethrows anything else. */
export function liveErrorResponse(err: unknown): NextResponse {
  if (err instanceof LiveError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (isLiveSchemaMissing(err)) {
    return NextResponse.json({ error: SCHEMA_MISSING_MESSAGE }, { status: 503 });
  }
  throw err;
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
