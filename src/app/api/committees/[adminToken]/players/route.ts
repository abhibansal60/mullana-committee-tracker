import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/live/rules";
import { issueLoginToken, revokeMemberAccess, setMemberPhone } from "@/lib/live/queries";
import { adminCommittee, liveErrorResponse } from "@/lib/live/http";

const playerSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("phone"), memberId: z.string().uuid(), phone: z.string().max(30) }),
  z.object({ action: z.literal("invite"), memberId: z.string().uuid() }),
  z.object({ action: z.literal("revoke"), memberId: z.string().uuid() }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/committees/[adminToken]/players">) {
  const { adminToken } = await ctx.params;
  const committee = await adminCommittee(adminToken);
  if (committee instanceof NextResponse) return committee;

  const parsed = playerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const input = parsed.data;

  try {
    if (input.action === "phone") {
      const trimmed = input.phone.trim();
      const phone = trimmed === "" ? null : normalizePhone(trimmed);
      if (trimmed !== "" && !phone) {
        return NextResponse.json({ error: "Enter a 10-digit mobile number" }, { status: 400 });
      }
      await setMemberPhone(committee.id, input.memberId, phone);
      return NextResponse.json({ ok: true, phone });
    }
    if (input.action === "invite") {
      const token = await issueLoginToken(committee.id, input.memberId);
      return NextResponse.json({ ok: true, path: `/in/${token}` });
    }
    await revokeMemberAccess(committee.id, input.memberId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return liveErrorResponse(err);
  }
}
