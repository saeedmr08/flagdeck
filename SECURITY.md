# Security Policy

## Supported versions

This is a portfolio demonstration project. Only the latest commit on the default branch receives fixes.

## Scope

FlagDeck evaluates feature flags entirely in the browser with synthetic configuration. It does not talk to a remote flag service, store production secrets, or collect real user identifiers.

## Reporting a vulnerability

If you discover a security issue in this repository (for example incorrect kill-switch semantics or non-deterministic evaluation that could mislead operators), email the maintainer at the address listed on Saeed Rumaneh's public profile with:

1. A short description of the issue
2. Steps to reproduce
3. The expected vs observed behavior

Please allow a reasonable window before public disclosure.

## Non-goals

- Do not use FlagDeck as a production feature-flag service.
- Demo user keys are fictional; never paste production PII into the evaluator.
- Kill-switch and audit history live in memory for the session only.
