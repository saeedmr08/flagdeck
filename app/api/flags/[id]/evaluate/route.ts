import { NextResponse } from "next/server";

import { evaluateFlag } from "@/lib/flags";
import { readFlagDeck } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { userKey?: string };
  const userKey = body.userKey?.trim();

  if (!userKey) {
    return NextResponse.json({ error: "userKey required" }, { status: 400 });
  }

  const { flags } = readFlagDeck();
  const flag = flags.find((f) => f.id === id);
  if (!flag) {
    return NextResponse.json({ error: "flag not found" }, { status: 404 });
  }

  return NextResponse.json(evaluateFlag(flag, userKey));
}
