import { NextResponse } from "next/server";
import { regenerateMemberToken } from "@/lib/db/queries";
import { generateToken, sha256Hex } from "@/lib/auth/tokens";
import { adminCommittee } from "@/lib/auth/guard";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ adminToken: string }> }
) {
  const { adminToken } = await params;
  const committee = await adminCommittee(adminToken);
  if (committee instanceof NextResponse) return committee;

  const newToken = generateToken();
  await regenerateMemberToken(committee.id, sha256Hex(newToken));
  return NextResponse.json({ memberToken: newToken });
}
