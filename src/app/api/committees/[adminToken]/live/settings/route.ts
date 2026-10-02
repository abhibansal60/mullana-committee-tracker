import { NextResponse } from "next/server";
import { z } from "zod";
import { saveLiveSettings } from "@/lib/live/queries";
import { adminCommittee } from "@/lib/auth/guard";
import { liveErrorResponse } from "@/lib/live/http";

const settingsSchema = z.object({
  openingBid: z.number().int(),
  bidIncrement: z.number().int(),
  roundSeconds: z.number().int(),
  allowPhoneLogin: z.boolean(),
});

export async function PUT(request: Request, ctx: RouteContext<"/api/committees/[adminToken]/live/settings">) {
  const { adminToken } = await ctx.params;
  const committee = await adminCommittee(adminToken);
  if (committee instanceof NextResponse) return committee;

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  try {
    await saveLiveSettings(committee, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return liveErrorResponse(err);
  }
}
