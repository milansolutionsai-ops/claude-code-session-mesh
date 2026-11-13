// Runs both hooks against a throwaway home folder. Never touches your real ~/.claude.
// Usage: node test/run.mjs
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SYNC = join(ROOT, "hooks", "session-sync.mjs");
const HANDOFF = join(ROOT, "hooks", "handoff-check.mjs");

const home = mkdtempSync(join(tmpdir(), "session-mesh-test-"));
const sessions = join(home, ".claude", "sessions");
mkdirSync(sessions, { recursive: true });
const changes = join(sessions, "changes.md");
writeFileSync(changes, readFileSync(join(ROOT, "examples", "changes.md"), "utf8")); // #1..#4

// Temp HOME only: os.homedir() reads HOME on macOS/Linux, USERPROFILE on Windows.
const env = { ...process.env, HOME: home, USERPROFILE: home };
delete env.SESSION_SYNC_CLAUDE_DIR;
delete env.SESSION_SYNC_WATCH;

function run(script, input) {
  const r = spawnSync(process.execPath, [script], { input: JSON.stringify(input), env, encoding: "utf8" });
  if (!r.stdout) return null;
  return JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
}
const sync = (sid, event, extra = {}) => run(SYNC, { session_id: sid, hook_event_name: event, ...extra });
const marker = (sid) => JSON.parse(readFileSync(join(sessions, ".seen", sid + ".json"), "utf8")).lastChange;

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "\n      " + detail}`);
}

try {
  // 1. First sight: intro, marker set to the latest number in the log.
  let out = sync("sess-a", "SessionStart");
  check("SessionStart prints the intro", out?.startsWith("Session mesh: your Claude Code sessions"), out);
  check("marker written in the temp home, set to #4", marker("sess-a") === 4, String(marker("sess-a")));

  // 2. Nothing new: silence.
  out = sync("sess-a", "UserPromptSubmit");
  check("no new lines: no output", out === null, out);

  // 3. Two new lines: only those print, marker moves to #6.
  appendFileSync(changes, "#5 2026-11-13 Five.\n#6 2026-11-13 Six.\n");
  out = sync("sess-a", "UserPromptSubmit");
  check("prints #5 and #6", out?.includes("#5 2026-11-13 Five.") && out.includes("#6 2026-11-13 Six."), out);
  check("does not reprint #1 to #4", out && !/#[1-4] /.test(out), out);
  check("marker updated to #6", marker("sess-a") === 6, String(marker("sess-a")));

  // 4. Same turn again: already seen, silence.
  out = sync("sess-a", "PostToolUse");
  check("already seen: no output", out === null, out);

  // 5. A second session gets the intro on first sight, even mid-session.
  out = sync("sess-b", "UserPromptSubmit");
  check("new session on UserPromptSubmit gets the intro", out?.startsWith("Session mesh: your"), out);
  check("second session marker at #6", marker("sess-b") === 6, String(marker("sess-b")));

  // 6. Subagents are ignored.
  out = sync("sess-c", "UserPromptSubmit", { agent_id: "sub-1" });
  check("subagent call: no output, no marker", out === null && !existsSync(join(sessions, ".seen", "sess-c.json")), out);

  // 7. Unlogged edit of a watched file gets flagged once.
  const md = join(home, ".claude", "CLAUDE.md");
  writeFileSync(md, "rules\n");
  const future = new Date(Date.now() + 60_000);
  utimesSync(md, future, future);
  out = sync("sess-a", "UserPromptSubmit");
  check("unlogged CLAUDE.md edit is flagged", out?.includes("CLAUDE.md changed (no log entry)"), out);
  out = sync("sess-a", "UserPromptSubmit");
  check("flag shows only once", out === null, out);

  // 8. Path-traversal session ids are refused.
  out = sync("../evil", "SessionStart");
  check("bad session id: no output", out === null, out);

  // 9. Handoff hook: fresh file announces, old file stays silent.
  const proj = join(home, "project");
  mkdirSync(proj);
  out = run(HANDOFF, { cwd: proj, hook_event_name: "SessionStart" });
  check("no HANDOFF.md: silent", out === null, out);
  writeFileSync(join(proj, "HANDOFF.md"), "# HANDOFF\n");
  out = run(HANDOFF, { cwd: proj, hook_event_name: "SessionStart" });
  check("fresh HANDOFF.md: announces", out?.includes("recent HANDOFF.md exists"), out);
  const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  utimesSync(join(proj, "HANDOFF.md"), old, old);
  out = run(HANDOFF, { cwd: proj, hook_event_name: "SessionStart" });
  check("8-day-old HANDOFF.md: silent", out === null, out);
} finally {
  rmSync(home, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
