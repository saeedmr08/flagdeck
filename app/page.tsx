"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  applyFlagPatch,
  evaluateFlag,
  userBucket,
  type FeatureFlag,
  type FlagAuditEntry,
  type FlagKind,
} from "@/lib/flags";
import styles from "./page.module.css";

const ACTOR = "deck-officer";

export default function HomePage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [audit, setAudit] = useState<FlagAuditEntry[]>([]);
  const [userKey, setUserKey] = useState("crew-alpha-17");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<FlagKind>("boolean");
  const [newPct, setNewPct] = useState(25);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/flags");
      if (!res.ok) {
        setError("Failed to load flags");
        return;
      }
      const data = (await res.json()) as {
        flags: FeatureFlag[];
        audit: FlagAuditEntry[];
      };
      setFlags(data.flags);
      setAudit(data.audit);
      setSelectedId((prev) => prev ?? data.flags[0]?.id ?? null);
    } catch {
      setError("Network error loading flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = flags.find((f) => f.id === selectedId) ?? flags[0];
  const evaluation = useMemo(
    () => (selected ? evaluateFlag(selected, userKey) : null),
    [selected, userKey],
  );
  const bucket = userBucket(userKey);

  async function persist(nextFlags: FeatureFlag[], nextAudit: FlagAuditEntry[]) {
    setFlags(nextFlags);
    setAudit(nextAudit);
    const res = await fetch("/api/flags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flags: nextFlags, audit: nextAudit }),
    });
    if (!res.ok) {
      setError("Failed to save flags");
      await load();
    }
  }

  async function mutate(
    flag: FeatureFlag,
    patch: Parameters<typeof applyFlagPatch>[1],
  ) {
    const { flag: next, audit: entry } = applyFlagPatch(flag, patch, ACTOR);
    const nextFlags = flags.map((f) => (f.id === flag.id ? next : f));
    const nextAudit = [entry, ...audit];
    await persist(nextFlags, nextAudit);
  }

  async function toggleKillSwitch(flag: FeatureFlag) {
    const res = await fetch(`/api/flags/${flag.id}/kill-switch`, {
      method: "POST",
    });
    if (!res.ok) {
      setError("Kill switch toggle failed");
      return;
    }
    await load();
  }

  async function createNewFlag(e: FormEvent) {
    e.preventDefault();
    if (!newKey.trim() || !newName.trim()) {
      setError("Key and name are required to create a flag");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/flags/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey.trim(),
          name: newName.trim(),
          kind: newKind,
          percentage: newKind === "percentage" ? newPct : 0,
          enabled: false,
        }),
      });
      const data = (await res.json()) as {
        flags?: FeatureFlag[];
        audit?: FlagAuditEntry[];
        flag?: FeatureFlag;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }
      if (data.flags) setFlags(data.flags);
      if (data.audit) setAudit(data.audit);
      if (data.flag) setSelectedId(data.flag.id);
      setNewKey("");
      setNewName("");
      setNewKind("boolean");
      setNewPct(25);
    } catch {
      setError("Network error creating flag");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.deck}>
        <p className={styles.empty}>Loading signal yard…</p>
      </main>
    );
  }

  return (
    <main className={styles.deck}>
      <header className={styles.masthead}>
        <div className={styles.pennants} aria-hidden>
          <span className={`${styles.pennant} ${styles.pRed}`} />
          <span className={`${styles.pennant} ${styles.pYellow}`} />
          <span className={`${styles.pennant} ${styles.pGreen}`} />
        </div>
        <div>
          <p className={styles.eyebrow}>Signal operations · Saeed Rumaneh</p>
          <h1 className={styles.brand}>FlagDeck</h1>
          <p className={styles.tagline}>
            Deterministic feature flags — boolean, percentage rollout, and kill
            switch with a full change audit.
          </p>
        </div>
      </header>

      {error && (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      )}

      <section className={styles.evaluator}>
        <h2 className={styles.panelTitle}>Raise a new signal</h2>
        <form className={styles.createForm} onSubmit={(e) => void createNewFlag(e)}>
          <label className={styles.label} htmlFor="newKey">
            Key
            <input
              id="newKey"
              className={styles.input}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="dark_mode_v2"
              spellCheck={false}
              required
            />
          </label>
          <label className={styles.label} htmlFor="newName">
            Name
            <input
              id="newName"
              className={styles.input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Dark Mode V2"
              required
            />
          </label>
          <label className={styles.label} htmlFor="newKind">
            Kind
            <select
              id="newKind"
              className={styles.input}
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as FlagKind)}
            >
              <option value="boolean">boolean</option>
              <option value="percentage">percentage</option>
            </select>
          </label>
          {newKind === "percentage" && (
            <label className={styles.label} htmlFor="newPct">
              Percentage ({newPct}%)
              <input
                id="newPct"
                type="range"
                min={0}
                max={100}
                value={newPct}
                onChange={(e) => setNewPct(Number(e.target.value))}
              />
            </label>
          )}
          <button type="submit" className={styles.btn} disabled={busy}>
            {busy ? "Creating…" : "Create flag"}
          </button>
        </form>
      </section>

      <section className={styles.evaluator}>
        <label className={styles.label} htmlFor="userKey">
          User key
        </label>
        <div className={styles.evalRow}>
          <input
            id="userKey"
            className={styles.input}
            value={userKey}
            onChange={(e) => setUserKey(e.target.value)}
            spellCheck={false}
          />
          <div className={styles.bucket}>
            <span className={styles.bucketLabel}>bucket</span>
            <strong>{bucket}</strong>
          </div>
          {evaluation && (
            <div
              className={`${styles.verdict} ${
                evaluation.enabled ? styles.on : styles.off
              }`}
            >
              {evaluation.enabled ? "ENABLED" : "DISABLED"}
              <span>{evaluation.reason}</span>
            </div>
          )}
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Signal yard</h2>
          {flags.length === 0 ? (
            <p className={styles.empty}>
              No flags yet — create one above or wait for seed data to load.
            </p>
          ) : (
            <ul className={styles.flagList}>
              {flags.map((flag) => {
                const result = evaluateFlag(flag, userKey);
                const active = selected?.id === flag.id;
                return (
                  <li key={flag.id}>
                    <button
                      type="button"
                      className={`${styles.flagCard} ${active ? styles.active : ""}`}
                      onClick={() => setSelectedId(flag.id)}
                    >
                      <div className={styles.flagHead}>
                        <span
                          className={`${styles.lamp} ${
                            flag.killSwitch
                              ? styles.lampKill
                              : result.enabled
                                ? styles.lampOn
                                : styles.lampOff
                          }`}
                        />
                        <div>
                          <strong>{flag.name}</strong>
                          <code>{flag.key}</code>
                        </div>
                        <span className={styles.kind}>{flag.kind}</span>
                      </div>
                      <p>{flag.description}</p>
                      <div className={styles.meta}>
                        {flag.killSwitch ? (
                          <span className={styles.badgeKill}>KILL</span>
                        ) : flag.enabled ? (
                          <span className={styles.badgeOn}>LIVE</span>
                        ) : (
                          <span className={styles.badgeOff}>OFF</span>
                        )}
                        {flag.kind === "percentage" && (
                          <span className={styles.pct}>{flag.percentage}%</span>
                        )}
                        <span className={styles.forUser}>
                          for key → {result.enabled ? "on" : "off"}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Helm controls</h2>
          {!selected ? (
            <p className={styles.empty}>Select a flag to adjust enablement, rollout, or kill switch.</p>
          ) : (
            <div className={styles.controls}>
              <div className={styles.controlBlock}>
                <span className={styles.label}>Master enable</span>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={selected.killSwitch}
                  onClick={() =>
                    void mutate(selected, { enabled: !selected.enabled })
                  }
                >
                  {selected.enabled ? "Disable flag" : "Enable flag"}
                </button>
              </div>

              {selected.kind === "percentage" && (
                <div className={styles.controlBlock}>
                  <label className={styles.label} htmlFor="pct">
                    Rollout {selected.percentage}%
                  </label>
                  <input
                    id="pct"
                    type="range"
                    min={0}
                    max={100}
                    value={selected.percentage}
                    disabled={selected.killSwitch}
                    onChange={(e) =>
                      void mutate(selected, {
                        percentage: Number(e.target.value),
                      })
                    }
                  />
                  <div className={styles.quickPct}>
                    {[0, 25, 50, 75, 100].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={styles.chip}
                        disabled={selected.killSwitch}
                        onClick={() => void mutate(selected, { percentage: n })}
                      >
                        {n}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.controlBlock}>
                <span className={styles.label}>Kill switch</span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => void toggleKillSwitch(selected)}
                >
                  {selected.killSwitch ? "Clear kill switch" : "Engage kill switch"}
                </button>
                <p className={styles.hint}>
                  When engaged, evaluation is always <code>false</code> —
                  including 100% rollouts. Changes persist to{" "}
                  <code>data/flags.json</code>.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className={`${styles.panel} ${styles.auditPanel}`}>
          <h2 className={styles.panelTitle}>Signal log</h2>
          {audit.length === 0 ? (
            <p className={styles.empty}>No changes yet — create or adjust a flag to log an entry.</p>
          ) : (
            <ol className={styles.auditList}>
              {audit.map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.at}>
                    {new Date(entry.at).toLocaleTimeString()}
                  </time>
                  <strong>{entry.action}</strong>
                  <span>{entry.summary}</span>
                  <em>{entry.actor}</em>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        FlagDeck · MIT 2026 · Saeed Rumaneh · flags persist on disk
      </footer>
    </main>
  );
}
