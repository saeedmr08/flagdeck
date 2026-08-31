import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  seedFlags,
  type FeatureFlag,
  type FlagAuditEntry,
} from "./flags";

export type FlagDeckData = {
  flags: FeatureFlag[];
  audit: FlagAuditEntry[];
};

const DATA_FILE = path.join(process.cwd(), "data", "flags.json");

function seed(): FlagDeckData {
  return { flags: seedFlags(), audit: [] };
}

export function readFlagDeck(): FlagDeckData {
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as FlagDeckData;
    if (!Array.isArray(raw.flags) || !Array.isArray(raw.audit)) {
      throw new Error("invalid shape");
    }
    return raw;
  } catch {
    const data = seed();
    writeFlagDeck(data);
    return data;
  }
}

export function writeFlagDeck(data: FlagDeckData): void {
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}
