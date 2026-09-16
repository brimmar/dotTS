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
  return `${left}  ${right}`;
}

export function safeTruncateAnsi(str: string, maxCols: number): string {
  const sanitized = str.replace(/[\r\n]+/g, " ");
  if (visibleLength(sanitized) <= maxCols) return sanitized;
  if (maxCols <= 3) return sanitized.slice(0, maxCols);

  const targetVisible = maxCols - 3;
  let visibleLen = 0;
  let inEscape = false;
  let result = "";

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];
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
      return `${result}...\x1b[0m`;
    }
    result += char;
    visibleLen++;
  }

  return `${result}...\x1b[0m`;
}

export class LiveDisplay {
  private active = new Map<string, ActiveResource>();
  private prevLineCount = 0;
  private isTTY = Boolean(process.stdout.isTTY);
  private renderTimer: NodeJS.Timeout | null = null;
  private ticker: NodeJS.Timeout | null = null;
  readonly verbose: boolean;
  readonly silent: boolean;

  constructor(options: DisplayOptions = {}) {
    this.verbose = Boolean(options.verbose);
    this.silent = Boolean(options.silent);
  }

  getActiveResource(id: string): ActiveResource | undefined {
    return this.active.get(id);
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
    this.ensureTicker();
    this.requestRender();
  }

  onResourceCommand(id: string, cmd: string, cwd?: string) {
    if (this.silent) return;
    const res = this.active.get(id);
    if (!res) return;
    const cleanCmd = cmd.replace(/[\r\n]+/g, " ").trim();
    res.commands.push({ cmd: cleanCmd, cwd, lines: [] });
    res.currentCommandIndex = res.commands.length - 1;
    this.requestRender();
  }

  onResourceOutput(id: string, line: string) {
    if (this.silent) return;
    const res = this.active.get(id);
    if (!res) return;
    const clean = line.replace(/[\r\n]+/g, " ").trim();
    if (!clean) return;
    const currentCmd =
      res.currentCommandIndex >= 0
        ? res.commands[res.currentCommandIndex]
        : undefined;
    if (currentCmd) {
      currentCmd.lines.push(clean);
      if (currentCmd.lines.length > 50) {
        currentCmd.lines.shift();
      }
    } else {
      res.commands.push({ cmd: "", lines: [clean] });
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

    this.clearDynamic();

    if (this.active.size === 0) {
      this.stopTicker();
      if (this.renderTimer) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }
    }

    const timeStr = pc.dim(formatDuration(completion.durationMs));

    if (this.verbose && res) {
      const stepTag = `#${res.stepIndex} [${id}]`;
      console.log(`${pc.bold(pc.blue("=>"))} ${pc.cyan(stepTag)}`);
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
    } else {
      console.log(alignRight(completion.labelPrefix, timeStr));
    }

    if (this.active.size > 0) {
      this.requestRender();
    }
  }

  onResourceFail(id: string, error: Error, stepIndex?: number) {
    if (this.silent) {
      this.active.delete(id);
      return;
    }
    const res = this.active.get(id);
    this.active.delete(id);

    this.clearDynamic();

    if (this.active.size === 0) {
      this.stopTicker();
      if (this.renderTimer) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }
    }

    const stepTag = `#${res?.stepIndex ?? stepIndex ?? "?"} [${id}]`;
    console.log(`${pc.bold(pc.red("=>"))} ${pc.red(stepTag)}`);
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

    if (this.active.size > 0) {
      this.requestRender();
    }
  }

  stop() {
    this.stopTicker();
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.clearDynamic();
    this.active.clear();
  }

  private ensureTicker() {
    if (!this.isTTY || this.silent) return;
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      this.render();
    }, 80);
    this.ticker.unref?.();
  }

  private stopTicker() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private clearDynamic() {
    if (this.isTTY && this.prevLineCount > 0) {
      let clearSeq = "\r\x1b[2K";
      for (let i = 0; i < this.prevLineCount; i++) {
        clearSeq += "\x1b[1A\x1b[2K";
      }
      process.stdout.write(`${clearSeq}\r`);
      this.prevLineCount = 0;
    }
  }

  private requestRender() {
    if (!this.isTTY || this.silent) return;
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.render();
    }, 40);
  }

  private render() {
    if (!this.isTTY || this.silent) return;
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.clearDynamic();

    if (this.active.size === 0) {
      this.stopTicker();
      return;
    }

    const cols = process.stdout.columns || 80;
    const maxCols = Math.max(10, cols - 1);
    const terminalRows = process.stdout.rows || 24;
    const maxDynamicRows = Math.min(
      8,
      Math.max(3, Math.floor(terminalRows / 3)),
    );
    const lines: string[] = [];

    const activeList = Array.from(this.active.values());
    for (let i = 0; i < activeList.length; i++) {
      const res = activeList[i];
      if (!res) continue;

      if (lines.length + 2 > maxDynamicRows && i < activeList.length) {
        const remaining = activeList.length - i;
        lines.push(
          safeTruncateAnsi(
            pc.dim(`   ... and ${remaining} more active tasks`),
            maxCols,
          ),
        );
        break;
      }

      const elapsed = `${((performance.now() - res.startTime) / 1000).toFixed(1)}s`;
      const header = safeTruncateAnsi(
        pc.bold(pc.blue("=>")) +
          " " +
          pc.cyan(`#${res.stepIndex} [${res.id}]`) +
          " " +
          pc.dim(`(${elapsed})`),
        maxCols,
      );
      lines.push(header);

      const currentCmd =
        res.currentCommandIndex >= 0
          ? res.commands[res.currentCommandIndex]
          : undefined;
      if (currentCmd?.cmd) {
        lines.push(
          safeTruncateAnsi(pc.dim("   $ ") + pc.cyan(currentCmd.cmd), maxCols),
        );
        const recent = currentCmd.lines.slice(-1);
        for (const l of recent) {
          if (lines.length + 1 <= maxDynamicRows) {
            lines.push(safeTruncateAnsi(pc.dim("   │ ") + pc.dim(l), maxCols));
          }
        }
      }
    }

    if (lines.length > 0) {
      process.stdout.write(`${lines.join("\n")}\n`);
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
