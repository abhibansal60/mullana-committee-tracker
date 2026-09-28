import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PLAYER_COOKIE } from "@/lib/auth/player";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(PLAYER_COOKIE);
  return NextResponse.json({ ok: true });
}
