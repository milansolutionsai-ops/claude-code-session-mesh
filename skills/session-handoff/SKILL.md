---
name: session-handoff
description: Use to checkpoint a long or context-heavy session into a HANDOFF.md so work continues cleanly in a fresh session, and to RESUME from one. Triggers - user approves a "good point to refresh" offer; user says handoff, checkpoint, "wrap up for a fresh session", "hand this over", "spin a new session"; or a session starts where a recent HANDOFF.md exists in the working directory.
---

# Session Handoff

Spins up a fresh session without losing context, for any project. Two modes: **WRITE** (checkpoint now)
and **RESUME** (pick up).

> Field-tested failure this skill guards against: a handoff's Resume section claimed work was built that
> a live check later disproved, and the next session nearly built on false state. Rule: **status is
> volatile, facts are stable; never trust volatile lines without a verify step.**

## When to offer (WRITE)
In a long session, watch for a real breakpoint: a phase or batch finishing, a big new chunk of work about
to start, repeated large tool dumps, or context feeling heavy. At such a point (not mid-task), offer once:
> "Good point to refresh. Want me to write the handoff?"

On approval, run WRITE mode. Offer only at real breakpoints; never nag.

## WRITE mode
1. Write or overwrite `HANDOFF.md` in the **current working directory** (project root). It's a living
   checkpoint: one per project, overwritten each time.
2. Keep it SHORT: a pointer plus a resume instruction, not a brain-dump. **Link to the project's canonical
   docs; never duplicate their content.** Hard budget: about 40 lines, one screen. If "Key facts" outgrows
   that, move them to a project doc and link it. The handoff holds pointers, not archives.
3. **Separate volatile from stable.** Status claims ("X is done", "batch N is active") are VOLATILE: they
   rot. Wherever a status claim matters, attach the 10-second check that proves it (a command, a query, a
   file to look at). IDs, decisions and gotchas are STABLE: safe to trust.
4. Use this exact structure:

```
# HANDOFF: <project>, <YYYY-MM-DD HH:MM>

## ▶ Resume here (do this first)
<the single concrete next action, startable in 30 seconds>
<VERIFY: the one command/check that proves this is still the right next action>

## What we're doing
<1-2 lines: current goal / batch / phase. If a live plan or status doc exists, POINT to it as the source of truth instead of restating it.>

## State right now (volatile, re-verify before building on it)
- <what just got done, with its proof-check if cheap>
- <what's in progress / half-finished>
- <anything broken or awaiting a decision>

## Do NOT redo / re-break
- <fixes or decisions the next session must not undo, with the WHY> (omit section if none)

## Read these first (canonical, don't re-derive)
- <file path + one-line why each>

## Key facts / IDs (stable, trust these)
- <IDs, decisions made, gotchas the next session needs>

## Waiting on / open questions
- <blockers, things needing the user or a third party>
```

5. Optional: if the folder has a `MAP.md` (from the
   [map skill](https://github.com/milansolutionsai-ops/claude-code-map-skill)), refresh its Where-we-are
   block and add any decision made this session, one dated line each. Status in HANDOFF.md, picture in MAP.md.
6. Then tell the user: *"Handoff written to HANDOFF.md. Safe to `/clear` or start a new session; it'll
   resume automatically. Or type `resume` in the new session."*
7. If the project is a git repo, remind them to add `HANDOFF.md` to `.gitignore` if it shouldn't be committed.

## RESUME mode
Trigger: a session starts with a recent `HANDOFF.md` present, or the user says "resume" / "resume from handoff".
1. Read `HANDOFF.md`. **Check its date first**: older than 7 days means treat everything as suspect, say
   so, and verify before acting. Recent: still do step 3.
2. Read ONLY the files it lists under "Read these first". Follow its pointers; don't re-read everything.
3. **Verify before building (30 seconds, non-negotiable):** run the VERIFY check attached to "▶ Resume
   here" (or, if none: `git log --oneline -5` plus a glance at the live source-of-truth doc). If reality
   contradicts the handoff, STOP: tell the user what diverged, fix the top of the handoff (add a dated
   correction note), then proceed from verified state. Never silently build on a stale claim.
4. State the "▶ Resume here" action, then continue from there.

## Notes
- One `HANDOFF.md` per working directory, so it works across all projects automatically.
- Complements durable memory: HANDOFF.md is transient in-flight session state; memory files are lasting facts.
- The always-on behaviour (watch-and-offer, read-at-start) comes from a few lines in `~/.claude/CLAUDE.md`
  plus the `handoff-check.mjs` SessionStart hook, which surfaces a fresh HANDOFF.md automatically.
