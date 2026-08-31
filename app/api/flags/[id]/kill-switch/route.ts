import { NextResponse } from "next/server";

import { applyFlagPatch } from "@/lib/flags";
import { readFlagDeck, writeFlagDeck } from "@/lib/store";

const ACTOR = "deck-officer";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const data = readFlagDeck();
  const flag = data.flags.find((f) => f.id === id);

  if (!flag) {
    return NextResponse.json({ error: "flag not found" }, { status: 404 });
  }

  const { flag: next, audit } = applyFlagPatch(
    flag,
    { killSwitch: !flag.killSwitch },
    ACTOR,
  );

  writeFlagDeck({
    flags: data.flags.map((f) => (f.id === id ? next : f)),
    audit: [audit, ...data.audit],
  });

  return NextResponse.json({ flag: next, audit });
}
