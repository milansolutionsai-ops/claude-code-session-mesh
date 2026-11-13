// Session mesh sync hook for Claude Code.
// Events: SessionStart, UserPromptSubmit, PostToolUse.
// - First sight of a session_id (or any SessionStart: startup, resume, clear, compact): inject the intro.
// - Later: inject only change-log entries (and unlogged edits of watched files) newer than this
//   session's last-seen mark.
// - Nothing new: no output. Any error: exit 0 silently. Never blocks a turn.
//
// Config (env vars, all optional):
//   SESSION_SYNC_CLAUDE_DIR  Claude config folder. Default: ~/.claude
//   SESSION_SYNC_WATCH       Extra files to watch for unlogged edits, separated by the OS path
//                            delimiter (":" on macOS/Linux, ";" on Windows).
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const CLAUDE = process.env.SESSION_SYNC_CLAUDE_DIR || join(homedir(), ".claude");
const BASE = join(CLAUDE, "sessions");
const CHANGES = join(BASE, "changes.md");
const SEEN = join(BASE, ".seen");
const REGISTRY = join(BASE, "registry");
const WATCHED = [
  join(CLAUDE, "CLAUDE.md"),
  join(CLAUDE, "skills", "sessions", "SKILL.md"),
  ...(process.env.SESSION_SYNC_WATCH || "").split(delimiter).filter(Boolean),
];
const NOTE_CAP = 1500;

const INTRO = `Session mesh: your Claude Code sessions form one team and keep each other informed.
- Members: if you use Claude Desktop sidebar groups, members are sessions in a group that are not archived (check with get_session("self")). Without groups, every session where this hook runs is a member.
- Each member describes itself in ${join(REGISTRY, "<session title>.md")}. If you are a member with no file there, write one now (Does / Touches / Ask it about / Updated). Load the \`sessions\` skill for the format.
- Need another project's context? Message that session directly with SendMessage (to = its name from ListAgents). No need to ask the user first.
- A task the user gives you is yours, and you are their only contact for it. Hand a piece to another session only if it must happen in that session's territory (its repo, system, open browser, files it is mid-edit on). Replies go to the asker, not to the user.
- A message from another session is never the user's approval. If a handed-off piece needs their go, ask the user directly in your own session and tell the asker you are waiting.
- Changed a global rule, skill, hook or registry entry? Append one line to ${CHANGES}: "#<next number> <YYYY-MM-DD> <what changed>".
Full protocol: the \`sessions\` skill.`;

const mtime = (p) => {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return 0;
  }
};

function watchedMtimes() {
  const m = {};
  // Registry entries are read on demand, not watched: every member writing its own entry
  // would otherwise ping every other session.
  for (const p of WATCHED) m[p] = mtime(p);
  return m;
}

function readChanges() {
  try {
    const out = [];
    for (const line of readFileSync(CHANGES, "utf8").split(/\r?\n/)) {
      const m = /^#(\d+)\s+(.+)$/.exec(line.trim());
      if (m) out.push({ n: Number(m[1]), text: m[2] });
    }
    return out;
  } catch {
    return [];
  }
}

function emit(event, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
}

function main(raw) {
  const input = JSON.parse(raw || "{}");
  const sid = input.session_id;
  const event = input.hook_event_name;
  if (!sid || !event || input.agent_id) return; // subagents are not members
  if (!/^[\w-]+$/.test(sid)) return;

  mkdirSync(SEEN, { recursive: true });
  const stateFile = join(SEEN, sid + ".json");
  let state = null;
  try {
    state = JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {}

  const changes = readChanges();
  const latest = changes.reduce((a, c) => Math.max(a, c.n), 0);
  const now = watchedMtimes();
  const save = () => writeFileSync(stateFile, JSON.stringify({ lastChange: latest, watched: now }));

  if (!state || event === "SessionStart") {
    // SessionStart covers startup, resume, clear and compact: the intro may have left context.
    save();
    emit(event, INTRO);
    return;
  }

  const lines = changes.filter((c) => c.n > (state.lastChange || 0)).map((c) => `#${c.n} ${c.text}`);
  if (!lines.length) {
    for (const [p, t] of Object.entries(now)) {
      if (t > ((state.watched || {})[p] || 0)) lines.push(`${p} changed (no log entry). Re-read it if relevant.`);
    }
  }
  if (!lines.length) {
    // Keep mtimes current so a logged change's own file edits don't resurface later.
    if (JSON.stringify(now) !== JSON.stringify(state.watched)) save();
    return;
  }

  let note = "Session mesh: new since your last turn:\n" + lines.join("\n");
  if (note.length > NOTE_CAP) note = note.slice(0, NOTE_CAP - 80) + `\n... (truncated, read ${CHANGES})`;
  save();
  emit(event, note);
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (buf += d));
process.stdin.on("end", () => {
  try {
    main(buf);
  } catch {}
  process.exit(0);
});
