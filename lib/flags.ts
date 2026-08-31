/**
 * FlagDeck — deterministic feature-flag evaluation.
 *
 * Evaluation is a pure function of (flag config, user key).
 * Percentage rollout uses a stable hash of the user key modulo 100
 * so the same user always lands in the same bucket.
 */

export type FlagKind = "boolean" | "percentage";

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  kind: FlagKind;
  /** Master enable for the flag (ignored when killSwitch is true). */
  enabled: boolean;
  /** Rollout percentage 0–100. Only used when kind === "percentage". */
  percentage: number;
  /** Hard off — always evaluates false, regardless of enabled/percentage. */
  killSwitch: boolean;
  updatedAt: string;
}

export type AuditAction =
  | "created"
  | "toggled"
  | "percentage_changed"
  | "kill_switch"
  | "revived";

export interface FlagAuditEntry {
  id: string;
  flagId: string;
  flagKey: string;
  action: AuditAction;
  summary: string;
  before: Partial<FeatureFlag> | null;
  after: Partial<FeatureFlag> | null;
  actor: string;
  at: string;
}

export interface EvaluationResult {
  flagKey: string;
  userKey: string;
  enabled: boolean;
  reason: string;
  bucket: number | null;
}

/** Stable 32-bit FNV-1a hash of a string. */
export function hashUserKey(userKey: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userKey.length; i++) {
    hash ^= userKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Bucket in [0, 99] derived from the user key. */
export function userBucket(userKey: string): number {
  return hashUserKey(userKey) % 100;
}

/**
 * Evaluate a flag for a given user key.
 * Deterministic: identical inputs always produce the same result.
 */
export function evaluateFlag(
  flag: FeatureFlag,
  userKey: string,
): EvaluationResult {
  const base = { flagKey: flag.key, userKey };

  if (flag.killSwitch) {
    return {
      ...base,
      enabled: false,
      reason: "kill_switch",
      bucket: null,
    };
  }

  if (!flag.enabled) {
    return {
      ...base,
      enabled: false,
      reason: "disabled",
      bucket: null,
    };
  }

  if (flag.kind === "boolean") {
    return {
      ...base,
      enabled: true,
      reason: "boolean_on",
      bucket: null,
    };
  }

  const pct = clampPercentage(flag.percentage);
  const bucket = userBucket(userKey);

  if (pct <= 0) {
    return {
      ...base,
      enabled: false,
      reason: "percentage_zero",
      bucket,
    };
  }

  if (pct >= 100) {
    return {
      ...base,
      enabled: true,
      reason: "percentage_full",
      bucket,
    };
  }

  const enabled = bucket < pct;
  return {
    ...base,
    enabled,
    reason: enabled ? "in_rollout" : "outside_rollout",
    bucket,
  };
}

export function clampPercentage(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.floor(value)));
}

export function createFlag(
  input: Omit<FeatureFlag, "id" | "updatedAt" | "killSwitch"> & {
    killSwitch?: boolean;
  },
): FeatureFlag {
  return {
    id: cryptoRandomId(),
    key: input.key,
    name: input.name,
    description: input.description,
    kind: input.kind,
    enabled: input.enabled,
    percentage: clampPercentage(input.percentage),
    killSwitch: input.killSwitch ?? false,
    updatedAt: new Date().toISOString(),
  };
}

export function applyFlagPatch(
  flag: FeatureFlag,
  patch: Partial<
    Pick<FeatureFlag, "enabled" | "percentage" | "killSwitch" | "name" | "description">
  >,
  actor: string,
): { flag: FeatureFlag; audit: FlagAuditEntry } {
  const before: Partial<FeatureFlag> = {
    enabled: flag.enabled,
    percentage: flag.percentage,
    killSwitch: flag.killSwitch,
  };

  const next: FeatureFlag = {
    ...flag,
    ...patch,
    percentage:
      patch.percentage !== undefined
        ? clampPercentage(patch.percentage)
        : flag.percentage,
    updatedAt: new Date().toISOString(),
  };

  const action = deriveAction(flag, next);
  const audit: FlagAuditEntry = {
    id: cryptoRandomId(),
    flagId: flag.id,
    flagKey: flag.key,
    action,
    summary: describeChange(flag, next, action),
    before,
    after: {
      enabled: next.enabled,
      percentage: next.percentage,
      killSwitch: next.killSwitch,
    },
    actor,
    at: next.updatedAt,
  };

  return { flag: next, audit };
}

function deriveAction(prev: FeatureFlag, next: FeatureFlag): AuditAction {
  if (!prev.killSwitch && next.killSwitch) return "kill_switch";
  if (prev.killSwitch && !next.killSwitch) return "revived";
  if (prev.percentage !== next.percentage) return "percentage_changed";
  if (prev.enabled !== next.enabled) return "toggled";
  return "toggled";
}

function describeChange(
  prev: FeatureFlag,
  next: FeatureFlag,
  action: AuditAction,
): string {
  switch (action) {
    case "kill_switch":
      return `Kill switch engaged for ${prev.key}`;
    case "revived":
      return `Kill switch cleared for ${prev.key}`;
    case "percentage_changed":
      return `Rollout ${prev.key}: ${prev.percentage}% → ${next.percentage}%`;
    case "toggled":
      return `${prev.key} ${next.enabled ? "enabled" : "disabled"}`;
    default:
      return `${prev.key} updated`;
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Seed flags for the demo UI. */
export function seedFlags(): FeatureFlag[] {
  return [
    createFlag({
      key: "checkout_v2",
      name: "Checkout V2",
      description: "New checkout flow with address autocomplete",
      kind: "boolean",
      enabled: true,
      percentage: 0,
    }),
    createFlag({
      key: "search_ranker",
      name: "Search Ranker",
      description: "Percentage rollout of the new ranking model",
      kind: "percentage",
      enabled: true,
      percentage: 25,
    }),
    createFlag({
      key: "billing_portal",
      name: "Billing Portal",
      description: "Self-serve billing — currently killed after incident",
      kind: "boolean",
      enabled: true,
      percentage: 0,
      killSwitch: true,
    }),
    createFlag({
      key: "edge_cache",
      name: "Edge Cache Warm",
      description: "Warm edge cache for catalog pages",
      kind: "percentage",
      enabled: true,
      percentage: 50,
    }),
  ];
}
