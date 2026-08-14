import { NextResponse } from "next/server";

export async function GET() {
  const target = process.env.GO_MEMBER_URL;
  if (!target) {
    return NextResponse.json(
      { error: "GO_MEMBER_URL is not configured" },
      { status: 404 }
    );
  }
  return NextResponse.redirect(target);
}
