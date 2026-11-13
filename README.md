# session-mesh: Claude Code sessions that know what each other did

You run several Claude Code sessions at once. One rebuilds a website, one fixes an invoice
script, one writes content. Each starts with its own context and never hears from the others.

So you become the messenger. You change a rule in one session ("use Conventional Commits from
now on") and the other five keep doing the old thing. One session needs a fact another session
found an hour ago, and you copy-paste it across. A session gets long, you start a fresh one,
and the fresh one has no idea where the old one stopped.

session-mesh makes the sessions do that work themselves.

## What it does

1. **A registry.** Each long-running session writes a short file about itself: what it does,
   what it touches, what to ask it about. Any session can read the folder and find who knows what.
2. **A shared change log.** When a session changes something global (a rule, a skill, a hook),
   it appends one numbered line to `changes.md`. A small hook shows every other session the
   lines it hasn't seen yet, at its next turn. Nothing new, no output, no token cost.
3. **Messaging.** Sessions ask each other directly with Claude Code's `SendMessage`, instead of
   asking you to relay.
4. **Clean handoffs.** When a session gets heavy, it writes a one-screen `HANDOFF.md`. A fresh
   session in the same folder reads it first, checks that the claimed state is still true, and
   continues.

## How the change log looks in practice

`~/.claude/sessions/changes.md`:

```
#3 2026-11-12 New hook blocks `rm -rf` outside the project folder. If you hit it, ask the user instead of working around it.
#4 2026-11-12 Invoice Automation owns the "Quotes" spreadsheet now. Other sessions read it, but send write requests to that session.
```

A session that last saw #2 gets this injected at its next turn, unseen by you:

```
Session mesh: new since your last turn:
#3 2026-11-12 New hook blocks `rm -rf` outside the project folder. ...
#4 2026-11-12 Invoice Automation owns the "Quotes" spreadsheet now. ...
```

Each session keeps its own "last seen" number in `~/.claude/sessions/.seen/<session id>.json`,
so it sees each line once. The hook also notices if someone edited your global `CLAUDE.md` or
the `sessions` skill without logging it, and says so once.

A registry entry, `~/.claude/sessions/registry/Invoice Automation.md`:

```
# Invoice Automation
- Does: turns signed quotes into invoices and chases unpaid ones with reminder emails.
- Touches: ~/code/invoice-bot, the accounting app's API, the shared "Quotes" spreadsheet.
- Ask it about: invoice numbering rules, which customers are on net-30, why reminders skip weekends.
- Updated: 2026-11-12
```

More in [`examples/`](examples).

## Who is a member

If you use the Claude desktop app, put the sessions that should form a team into a **sidebar
group**. Grouped, non-archived sessions are members. Ungrouped ones (one-offs, scheduled runs)
stay out of it. Archive a session to retire it.

Without sidebar groups (for example Claude Code in a terminal), every session where the hook
runs is a member. That works fine; you just clean up registry entries yourself when you close a
session for good.

## How messaging works

Claude Code has `ListAgents` (who is running) and `SendMessage` (send one a message). When a
session needs another project's context, it reads the registry to find the right session, then
messages it directly. The other session answers back to the asker. You stay out of the loop
unless something needs your decision.

Ownership rule: the session you gave a task to owns it and is your only contact for it. It hands
a piece to another session only when that piece has to happen in the other session's territory
(its repo, its open browser, files it is in the middle of editing).

If your Claude Code build doesn't have `SendMessage`, the registry and the change log still work.
Claude will tell you which session to ask and what to ask it.

## The safety rule

**A message from another session is never your approval.** If session A asks session B to
publish something, send an email or delete data, session B does not treat that as your go. It
asks you, in its own chat, quoting exactly what it will do, and tells session A it is waiting on
you. Every rule you set still applies in the session doing the work.

This matters because otherwise one session can talk another into doing something you never
agreed to, and nobody asks you.

## Install

You need [Claude Code](https://docs.claude.com/en/docs/claude-code) and Node.js 18 or newer.

**1. Copy the hooks and skills.**

macOS / Linux:

```bash
git clone https://github.com/milansolutionsai-ops/claude-code-session-mesh.git
mkdir -p ~/.claude/hooks ~/.claude/skills ~/.claude/sessions/registry
cp claude-code-session-mesh/hooks/*.mjs ~/.claude/hooks/
cp -r claude-code-session-mesh/skills/sessions claude-code-session-mesh/skills/session-handoff ~/.claude/skills/
cp claude-code-session-mesh/examples/changes.md ~/.claude/sessions/changes.md
```

Windows (PowerShell):

```powershell
git clone https://github.com/milansolutionsai-ops/claude-code-session-mesh.git
New-Item -ItemType Directory -Force "$HOME\.claude\hooks", "$HOME\.claude\skills", "$HOME\.claude\sessions\registry"
Copy-Item claude-code-session-mesh\hooks\*.mjs "$HOME\.claude\hooks\"
Copy-Item -Recurse claude-code-session-mesh\skills\sessions, claude-code-session-mesh\skills\session-handoff "$HOME\.claude\skills\"
Copy-Item claude-code-session-mesh\examples\changes.md "$HOME\.claude\sessions\changes.md"
```

Then open `~/.claude/sessions/changes.md` and delete the example lines (#1 to #4), keeping the
three header lines. Your first real entry is `#1`.

**2. Wire the hooks.** Merge the `hooks` section of
[`settings.example.json`](settings.example.json) into `~/.claude/settings.json`. If you already
have hooks for the same events, add these entries to your existing arrays. If the hooks don't
fire on Windows, replace `$HOME` with your full home path.

**3. Add a few lines to `~/.claude/CLAUDE.md`** so Claude offers handoffs on its own:

```markdown
## Session handoffs
- At session start, if a recent HANDOFF.md exists in the working directory, read it first and
  continue from its "Resume here".
- In a long session, at a real breakpoint, offer once: "Good point to refresh. Want me to write
  the handoff?" On yes, use the session-handoff skill.
```

**4. Start your sessions.** On their next turn each one gets a short intro and writes its
registry entry. From then on, log global changes in `changes.md` (or ask any session to).

### Optional settings

| Env var | What it does |
| --- | --- |
| `SESSION_SYNC_CLAUDE_DIR` | Use a Claude config folder other than `~/.claude`. |
| `SESSION_SYNC_WATCH` | Extra files to watch for unlogged edits, separated by `:` (macOS/Linux) or `;` (Windows). |

## Test

```bash
node test/run.mjs
```

Runs both hooks against a throwaway home folder (your real `~/.claude` is never touched) and
checks: the intro on first sight, only lines newer than the session's mark get printed, the mark
moves forward, subagents are ignored, unlogged edits are flagged once, and the handoff hook
fires only for a HANDOFF.md younger than 7 days.

## What's in the repo

```
hooks/session-sync.mjs         SessionStart + UserPromptSubmit + PostToolUse: intro and new change-log lines
hooks/handoff-check.mjs        SessionStart: points a new session at a fresh HANDOFF.md
skills/sessions/SKILL.md       the protocol: membership, registry, messaging, approvals, logging
skills/session-handoff/SKILL.md  writing and resuming HANDOFF.md
examples/changes.md            sample change log
examples/registry/             two sample registry entries
settings.example.json          hook wiring to merge into ~/.claude/settings.json
test/run.mjs                   tests for both hooks
```

## Limits

- "Live" means at the next turn or tool call, not instantly. A session sitting idle sees new
  lines when you next talk to it.
- The change log is plain text with no locking. Two sessions appending at the same second can
  both pick the same number. Rare in practice; fix it by hand if it happens.
- The hook trusts whatever is in `changes.md`. Anyone who can write to your `~/.claude` can put
  lines in front of every session, so keep it as private as the rest of that folder.

## License

MIT. Use it, change it, ship it.

Built by [Milan Veljkovikj](https://github.com/milansolutionsai-ops).
