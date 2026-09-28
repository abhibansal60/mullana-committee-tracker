import { NextResponse } from "next/server";
import { getCommitteeByAdminTokenHash, type Committee } from "@/lib/db/queries";
import { sha256Hex } from "@/lib/auth/tokens";
import { requireAdminForCommittee, UnauthorizedError } from "@/lib/auth/guard";
import { getCurrentPlayer, isLiveSchemaMissing, LiveError, type Player } from "./queries";

export const SCHEMA_MISSING_MESSAGE =
  "Live auctions need a one-time database update (npm run db:push). Everything else keeps working.";

/** Resolves the admin's committee for a route handler, or a ready-made error response. */
export async function adminCommittee(adminToken: string): Promise<Committee | NextResponse> {
  const committee = await getCommitteeByAdminTokenHash(sha256Hex(adminToken));
  if (!committee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await requireAdminForCommittee(committee.id);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
  return committee;
}

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
