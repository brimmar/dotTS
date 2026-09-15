import pc from "picocolors";

export interface DisplayOptions {
  verbose?: boolean;
  silent?: boolean;
}

export interface ResourceCommandRecord {
  cmd: string;
  cwd?: string;
  lines: string[];
}

export interface ActiveResource {
  id: string;
  stepIndex: number;
  totalSteps: number;
  startTime: number;
  commands: ResourceCommandRecord[];
  currentCommandIndex: number;
}

export interface ResourceCompletion {
  status: "created" | "updated" | "converged" | "deleted";
  labelPrefix: string;
  durationMs: number;
}

export function visibleLength(str: string): number {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI escape codes
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").length;
}

export function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = (seconds % 60).toFixed(1);
  return `${mins}m ${remSecs}s`;
}

export function alignRight(
  left: string,
  right: string,
  maxWidth = process.stdout.columns || 80,
): string {
  const leftLen = visibleLength(left);
  const rightLen = visibleLength(right);
  const padding = maxWidth - leftLen - rightLen;
  if (padding > 1) {
    return left + " ".repeat(padding) + right;
  }
  return left + "  " + right;
}

export function safeTruncateAnsi(str: string, maxCols: number): string {
  if (visibleLength(str) <= maxCols) return str;
  if (maxCols <= 3) return str.slice(0, maxCols);

  const targetVisible = maxCols - 3;
  let visibleLen = 0;
  let inEscape = false;
  let result = "";

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (!char) continue;
    if (char === "\x1b") {
      inEscape = true;
      result += char;
      continue;
    }
    if (inEscape) {
      result += char;
      if ((char >= "a" && char <= "z") || (char >= "A" && char <= "Z")) {
        inEscape = false;
      }
      continue;
    }

    if (visibleLen >= targetVisible) {
      return result + "..." + "\x1b[0m";
    }
    result += char;
    visibleLen++;
  }

  return result + "..." + "\x1b[0m";
}

export class LiveDisplay {
  private active = new Map<string, ActiveResource>();
  private prevLineCount = 0;
  private isTTY = Boolean(process.stdout.isTTY);
  private renderTimer: NodeJS.Timeout | null = null;
  readonly verbose: boolean;
  readonly silent: boolean;

  constructor(options: DisplayOptions = {}) {
    this.verbose = Boolean(options.verbose);
    this.silent = Boolean(options.silent);
  }

  onResourceStart(id: string, stepIndex: number, totalSteps: number) {
    if (this.silent) return;
    this.active.set(id, {
      id,
      stepIndex,
      totalSteps,
      startTime: performance.now(),
      commands: [],
      currentCommandIndex: -1,
    });
    if (this.verbose) {
      this.requestRender();
    }
  }

  onResourceCommand(id: string, cmd: string, cwd?: string) {
    if (this.silent || !this.verbose) return;
    const res = this.active.get(id);
    if (!res) return;
    res.commands.push({ cmd, cwd, lines: [] });
    res.currentCommandIndex = res.commands.length - 1;
    this.requestRender();
  }

  onResourceOutput(id: string, line: string) {
    if (this.silent || !this.verbose) return;
    const res = this.active.get(id);
    if (!res) return;
    const currentCmd =
      res.currentCommandIndex >= 0
        ? res.commands[res.currentCommandIndex]
        : undefined;
    if (currentCmd) {
      currentCmd.lines.push(line);
    } else {
      res.commands.push({ cmd: "", lines: [line] });
      res.currentCommandIndex = res.commands.length - 1;
    }
    this.requestRender();
  }

  onResourceComplete(id: string, completion: ResourceCompletion) {
    if (this.silent) {
      this.active.delete(id);
      return;
    }
    const res = this.active.get(id);
    this.active.delete(id);

    if (this.verbose) {
      this.clearDynamic();
    }

    const timeStr = pc.dim(formatDuration(completion.durationMs));

    if (this.verbose && res) {
      const stepTag = `#${res.stepIndex} [${id}]`;
      console.log(pc.bold(pc.blue("=>")) + " " + pc.cyan(stepTag));
      if (res.commands.length > 0) {
        for (const cmdRec of res.commands) {
          if (cmdRec.cmd) {
            console.log(pc.dim("   $ ") + pc.cyan(cmdRec.cmd));
            if (cmdRec.cwd) {
              console.log(pc.dim(`     cwd: ${cmdRec.cwd}`));
            }
          }
          for (const line of cmdRec.lines) {
            console.log(pc.dim("   │ ") + line);
          }
        }
      }
      console.log(
        alignRight(`${pc.cyan(stepTag)} ${completion.labelPrefix}`, timeStr),
      );
      this.render();
    } else {
      console.log(alignRight(completion.labelPrefix, timeStr));
    }
  }

  onResourceFail(id: string, error: Error, stepIndex?: number) {
    if (this.silent) {
      this.active.delete(id);
      return;
    }
    const res = this.active.get(id);
    this.active.delete(id);

    if (this.verbose) {
      this.clearDynamic();
    }

    const stepTag = `#${res?.stepIndex ?? stepIndex ?? "?"} [${id}]`;
    console.log(pc.bold(pc.red("=>")) + " " + pc.red(stepTag));
    if (res && res.commands.length > 0) {
      for (const cmdRec of res.commands) {
        if (cmdRec.cmd) {
          console.log(pc.dim("   $ ") + pc.cyan(cmdRec.cmd));
        }
        for (const line of cmdRec.lines) {
          console.log(pc.dim("   │ ") + line);
        }
      }
    }
    if (error.message) {
      console.log(pc.red(`   Error: ${error.message}`));
    }
    console.log(pc.red(`■ Failed: ${id}`));

    if (this.verbose) {
      this.render();
    }
  }

  stop() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.verbose) {
      this.clearDynamic();
    }
    this.active.clear();
  }

  private clearDynamic() {
    if (this.isTTY && this.prevLineCount > 0) {
      process.stdout.write(`\x1b[${this.prevLineCount}A\r\x1b[0J`);
      this.prevLineCount = 0;
    }
  }

  private requestRender() {
    if (!this.isTTY || this.silent || !this.verbose) return;
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.render();
    }, 40);
  }

  private render() {
    if (!this.isTTY || this.silent || !this.verbose) return;
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.clearDynamic();

    if (this.active.size === 0) return;

    const cols = process.stdout.columns || 80;
    const maxTerminalRows = process.stdout.rows
      ? Math.max(6, process.stdout.rows - 2)
      : 20;
    const lines: string[] = [];

    const activeList = Array.from(this.active.values());
    for (let i = 0; i < activeList.length; i++) {
      const res = activeList[i];
      if (!res) continue;

      if (lines.length + 3 > maxTerminalRows && i < activeList.length) {
        const remaining = activeList.length - i;
        lines.push(
          safeTruncateAnsi(
            pc.dim(`   ... and ${remaining} more active tasks`),
            cols,
          ),
        );
        break;
      }

      const elapsed =
        ((performance.now() - res.startTime) / 1000).toFixed(1) + "s";
      const header = safeTruncateAnsi(
        pc.bold(pc.blue("=>")) +
          " " +
          pc.cyan(`#${res.stepIndex} [${res.id}]`) +
          " " +
          pc.dim(`(${elapsed})`),
        cols,
      );
      lines.push(header);

      const currentCmd =
        res.currentCommandIndex >= 0
          ? res.commands[res.currentCommandIndex]
          : undefined;
      if (currentCmd?.cmd) {
        lines.push(
          safeTruncateAnsi(pc.dim("   $ ") + pc.cyan(currentCmd.cmd), cols),
        );
        const recent = currentCmd.lines.slice(-1);
        for (const l of recent) {
          lines.push(safeTruncateAnsi(pc.dim("   │ ") + pc.dim(l), cols));
        }
      }
    }

    if (lines.length > 0) {
      process.stdout.write(lines.join("\n") + "\n");
      this.prevLineCount = lines.length;
    }
  }
}

let globalDisplay: LiveDisplay | null = null;

export function setActiveDisplay(display: LiveDisplay | null) {
  globalDisplay = display;
}

export function getActiveDisplay(): LiveDisplay | null {
  return globalDisplay;
}
