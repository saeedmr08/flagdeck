import { NextResponse } from "next/server";

import type { FeatureFlag, FlagAuditEntry } from "@/lib/flags";
import { readFlagDeck, writeFlagDeck } from "@/lib/store";

export async function GET() {
  return NextResponse.json(readFlagDeck());
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    flags?: FeatureFlag[];
    audit?: FlagAuditEntry[];
  };

  if (!Array.isArray(body.flags) || !Array.isArray(body.audit)) {
    return NextResponse.json(
      { error: "flags and audit arrays required" },
      { status: 400 },
    );
  }

  const data = { flags: body.flags, audit: body.audit };
  writeFlagDeck(data);
  return NextResponse.json(data);
}
