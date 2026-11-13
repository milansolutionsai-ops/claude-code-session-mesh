# Session mesh changes log
Append one line per system change: "#<next number> <YYYY-MM-DD> <what changed>". Never edit old lines.
The session-sync hook shows every open session the lines newer than its last turn.

#1 2026-11-10 Session mesh launched: sessions describe themselves in ~/.claude/sessions/registry/ and message each other directly. Protocol: `sessions` skill.
#2 2026-11-11 Global CLAUDE.md: commit messages now follow Conventional Commits (feat:, fix:, docs:). Use it from your next commit on.
#3 2026-11-12 New hook blocks `rm -rf` outside the project folder. If you hit it, ask the user instead of working around it.
#4 2026-11-12 Invoice Automation owns the "Quotes" spreadsheet now. Other sessions read it, but send write requests to that session.
