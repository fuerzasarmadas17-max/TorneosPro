import { NextResponse } from "next/server";

// Generated at build time — changes with every deployment
const BUILD_ID = process.env.NEXT_BUILD_ID || Date.now().toString();

export function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
