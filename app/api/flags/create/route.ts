import { NextResponse } from "next/server";

import {
  createFlag,
  type FeatureFlag,
  type FlagAuditEntry,
  type FlagKind,
} from "@/lib/flags";
import { readFlagDeck, writeFlagDeck } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    key?: string;
    name?: string;
    kind?: FlagKind;
    percentage?: number;
    description?: string;
    enabled?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = body.key?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  if (!key || !name) {
    return NextResponse.json(
      { error: "key and name are required" },
      { status: 400 },
    );
  }

  const kind: FlagKind =
    body.kind === "percentage" ? "percentage" : "boolean";
  const percentage =
    kind === "percentage"
      ? Math.max(0, Math.min(100, Math.floor(Number(body.percentage) || 0)))
      : 0;

  const data = readFlagDeck();
  if (data.flags.some((f) => f.key === key)) {
    return NextResponse.json(
      { error: `Flag key "${key}" already exists` },
      { status: 409 },
    );
  }

  const flag = createFlag({
    key,
    name,
    description: body.description?.trim() || `Custom flag ${key}`,
    kind,
    enabled: body.enabled ?? false,
    percentage,
  });

  const audit: FlagAuditEntry = {
    id: crypto.randomUUID(),
    flagId: flag.id,
    flagKey: flag.key,
    action: "created",
    summary: `Created ${flag.key} (${flag.kind})`,
    before: null,
    after: {
      enabled: flag.enabled,
      percentage: flag.percentage,
      killSwitch: flag.killSwitch,
    },
    actor: "deck-officer",
    at: flag.updatedAt,
  };

  const next = {
    flags: [flag, ...data.flags] as FeatureFlag[],
    audit: [audit, ...data.audit],
  };
  writeFlagDeck(next);
  return NextResponse.json({ flag, ...next }, { status: 201 });
}
