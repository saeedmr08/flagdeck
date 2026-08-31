import { describe, expect, it } from "vitest";
import {
  applyFlagPatch,
  createFlag,
  evaluateFlag,
  hashUserKey,
  userBucket,
  type FeatureFlag,
} from "../lib/flags";

function pctFlag(percentage: number, overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    ...createFlag({
      key: "rollout_demo",
      name: "Rollout Demo",
      description: "test",
      kind: "percentage",
      enabled: true,
      percentage,
    }),
    ...overrides,
  };
}

describe("hashUserKey", () => {
  it("is stable for the same input", () => {
    expect(hashUserKey("user-42")).toBe(hashUserKey("user-42"));
  });

  it("differs across distinct keys", () => {
    expect(hashUserKey("alice")).not.toBe(hashUserKey("bob"));
  });
});

describe("evaluateFlag — percentage rollout", () => {
  it("0% rollout never enables any user", () => {
    const flag = pctFlag(0);
    const keys = ["a", "b", "c", "user-1", "user-99", "x".repeat(40)];
    for (const key of keys) {
      const result = evaluateFlag(flag, key);
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe("percentage_zero");
    }
  });

  it("100% rollout enables every user", () => {
    const flag = pctFlag(100);
    const keys = ["a", "b", "c", "user-1", "user-99", "edge-case"];
    for (const key of keys) {
      const result = evaluateFlag(flag, key);
      expect(result.enabled).toBe(true);
      expect(result.reason).toBe("percentage_full");
    }
  });

  it("50% split is stable for the same user key", () => {
    const flag = pctFlag(50);
    const key = "stable-user-alpha";
    const first = evaluateFlag(flag, key);
    for (let i = 0; i < 50; i++) {
      const again = evaluateFlag(flag, key);
      expect(again.enabled).toBe(first.enabled);
      expect(again.bucket).toBe(first.bucket);
      expect(again.reason).toBe(first.reason);
    }
  });

  it("50% split places users into consistent buckets under 50", () => {
    const flag = pctFlag(50);
    const samples = Array.from({ length: 200 }, (_, i) => `u-${i}`);
    for (const key of samples) {
      const result = evaluateFlag(flag, key);
      const bucket = userBucket(key);
      expect(result.bucket).toBe(bucket);
      expect(result.enabled).toBe(bucket < 50);
    }
  });
});

describe("evaluateFlag — kill switch", () => {
  it("forces false even when boolean flag is enabled", () => {
    const flag = createFlag({
      key: "danger",
      name: "Danger",
      description: "killed",
      kind: "boolean",
      enabled: true,
      percentage: 0,
      killSwitch: true,
    });
    expect(evaluateFlag(flag, "anyone").enabled).toBe(false);
    expect(evaluateFlag(flag, "anyone").reason).toBe("kill_switch");
  });

  it("forces false even at 100% percentage rollout", () => {
    const flag = pctFlag(100, { killSwitch: true });
    expect(evaluateFlag(flag, "user-a").enabled).toBe(false);
    expect(evaluateFlag(flag, "user-b").reason).toBe("kill_switch");
  });
});

describe("evaluateFlag — boolean", () => {
  it("returns true when enabled and not killed", () => {
    const flag = createFlag({
      key: "on",
      name: "On",
      description: "",
      kind: "boolean",
      enabled: true,
      percentage: 0,
    });
    expect(evaluateFlag(flag, "u").enabled).toBe(true);
    expect(evaluateFlag(flag, "u").reason).toBe("boolean_on");
  });

  it("returns false when disabled", () => {
    const flag = createFlag({
      key: "off",
      name: "Off",
      description: "",
      kind: "boolean",
      enabled: false,
      percentage: 0,
    });
    expect(evaluateFlag(flag, "u").enabled).toBe(false);
    expect(evaluateFlag(flag, "u").reason).toBe("disabled");
  });
});

describe("applyFlagPatch", () => {
  it("records a kill_switch audit entry", () => {
    const flag = createFlag({
      key: "x",
      name: "X",
      description: "",
      kind: "boolean",
      enabled: true,
      percentage: 0,
    });
    const { flag: next, audit } = applyFlagPatch(flag, { killSwitch: true }, "ops");
    expect(next.killSwitch).toBe(true);
    expect(audit.action).toBe("kill_switch");
    expect(audit.actor).toBe("ops");
  });

  it("records percentage_changed audit entry", () => {
    const flag = pctFlag(10);
    const { flag: next, audit } = applyFlagPatch(flag, { percentage: 40 }, "ops");
    expect(next.percentage).toBe(40);
    expect(audit.action).toBe("percentage_changed");
  });
});
