import { NextResponse } from "next/server";
import { getCommitteeByAdminTokenHash, regenerateMemberToken } from "@/lib/db/queries";
import { generateToken, sha256Hex } from "@/lib/auth/tokens";
import { requireAdminForCommittee, UnauthorizedError } from "@/lib/auth/guard";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ adminToken: string }> }
) {
  const { adminToken } = await params;
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

  const newToken = generateToken();
  await regenerateMemberToken(committee.id, sha256Hex(newToken));
  return NextResponse.json({ memberToken: newToken });
}
