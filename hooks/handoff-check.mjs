// SessionStart hook: if the working folder has a HANDOFF.md younger than 7 days,
// tell Claude to read it first and resume from it (session-handoff skill, RESUME mode).
// Silent when there is none. Never blocks.
import { statSync } from "node:fs";
import { join } from "node:path";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (buf += d));
process.stdin.on("end", () => {
  try {
    let input = {};
    try {
      input = JSON.parse(buf || "{}");
    } catch {}
    const file = join(input.cwd || process.cwd(), "HANDOFF.md");
    if (Date.now() - statSync(file).mtimeMs < MAX_AGE_MS) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext:
              "session-handoff: A recent HANDOFF.md exists in this working directory. Read it FIRST and resume from its Resume-here section. Verify its volatile status claims before building on them (session-handoff skill, RESUME mode).",
          },
        })
      );
    }
  } catch {}
  process.exit(0);
});
