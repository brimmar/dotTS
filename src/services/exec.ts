import { Context, Effect, FiberRef, Layer } from "effect";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import pc from "picocolors";
import { getActiveDisplay } from "../core/display";

export const currentResourceTag = FiberRef.unsafeMake<string>("");
export const currentResourceId = FiberRef.unsafeMake<string>("");

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  become?: boolean | string;
  stdin?: string;
  intent?: "read" | "write";
  verbose?: boolean;
  probe?: boolean;
}

export type RunOptions = ExecOptions;

export interface SystemCommand {
  readonly run: (
    command: string,
    options?: ExecOptions,
  ) => Effect.Effect<string, Error>;
  readonly execFile: (
    file: string,
    args: string[],
    options?: ExecOptions,
  ) => Effect.Effect<string, Error>;
}

export const SystemCommand = Context.GenericTag<SystemCommand>("SystemCommand");

export interface SystemCommandConfig {
  verbose?: boolean;
}

/**
 * Prefix argv with sudo when `become` is set.
 * `true` / `'root'` → sudo -- file args.
 * other username → sudo -u user -- file args.
 */
export function buildSudoArgs(
  file: string,
  args: string[],
  become?: boolean | string,
): { file: string; args: string[] } {
  if (!become) {
    return { file, args };
  }
  if (become === true || become === "root") {
    return { file: "sudo", args: ["--", file, ...args] };
  }
  return { file: "sudo", args: ["-u", become, "--", file, ...args] };
}

class LineStreamer {
  private buffer = "";
  constructor(private onLine: (line: string) => void) {}

  write(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const clean = line.split("\r").pop()?.trimEnd() ?? line;
      if (clean.length > 0) {
        this.onLine(clean);
      }
    }
  }

  flush() {
    if (this.buffer.length > 0) {
      const clean = this.buffer.split("\r").pop()?.trimEnd() ?? this.buffer;
      if (clean.length > 0) {
        this.onLine(clean);
      }
      this.buffer = "";
    }
  }
}

function formatCommandForLog(spawned: {
  file: string;
  args: string[];
}): string {
  if (spawned.file === "sudo") {
    const dashDashIndex = spawned.args.indexOf("--");
    if (dashDashIndex !== -1) {
      const sudoFlags = spawned.args.slice(0, dashDashIndex);
      const afterDash = spawned.args.slice(dashDashIndex + 1);
      const sudoPrefix =
        sudoFlags.length > 0 ? `sudo ${sudoFlags.join(" ")} ` : "sudo ";
      if (afterDash[0] === "sh" && afterDash[1] === "-c") {
        return `${sudoPrefix}${afterDash.slice(2).join(" ")}`;
      }
      return `${sudoPrefix}${afterDash.join(" ")}`;
    }
  }
  if (spawned.file === "sh" && spawned.args[0] === "-c") {
    return spawned.args.slice(1).join(" ") || "sh -c";
  }
  return `${spawned.file} ${spawned.args.join(" ")}`;
}

function spawnExecFile(
  file: string,
  args: string[],
  options?: ExecOptions,
  globalVerbose?: boolean,
  tag?: string,
  resourceId?: string,
): Promise<string> {
  const spawned = buildSudoArgs(file, args, options?.become);
  const env = options?.env ? { ...process.env, ...options.env } : undefined;
  const cwd = options?.cwd
    ? options.cwd === "~"
      ? homedir()
      : options.cwd.startsWith("~/") || options.cwd.startsWith("~\\")
        ? join(homedir(), options.cwd.slice(2))
        : options.cwd
    : undefined;

  const display = getActiveDisplay();
  const verbose = options?.verbose ?? globalVerbose ?? false;
  const isProbeOrRead = options?.intent === "read" || Boolean(options?.probe);
  const shouldStreamToDisplay = Boolean(
    display && resourceId && !isProbeOrRead,
  );
  const shouldLogToConsole = Boolean(
    (!display || !resourceId) && verbose && !isProbeOrRead,
  );
  const shouldCapture = shouldStreamToDisplay || shouldLogToConsole;

  return new Promise((resolve, reject) => {
    const tagPrefix = tag ? pc.cyan(tag) + " " : "  ";
    if (shouldCapture) {
      const displayCmd = formatCommandForLog(spawned);
      if (shouldStreamToDisplay) {
        display?.onResourceCommand(resourceId!, displayCmd, cwd);
      } else {
        console.log(tagPrefix + pc.dim("$ ") + pc.cyan(displayCmd));
      }
    }

    const stdoutStreamer = shouldCapture
      ? new LineStreamer((line) => {
          if (shouldStreamToDisplay) {
            display?.onResourceOutput(resourceId!, line);
          } else {
            console.log(tagPrefix + pc.dim("│ ") + line);
          }
        })
      : undefined;

    const stderrStreamer = shouldCapture
      ? new LineStreamer((line) => {
          if (shouldStreamToDisplay) {
            display?.onResourceOutput(resourceId!, line);
          } else {
            console.log(tagPrefix + pc.dim("│ ") + pc.dim(line));
          }
        })
      : undefined;

    const child = spawn(spawned.file, spawned.args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      stdoutStreamer?.write(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      stderrStreamer?.write(chunk);
    });
    child.on("error", fail);
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (shouldCapture) {
        stdoutStreamer?.flush();
        stderrStreamer?.flush();
        if (code !== 0) {
          if (shouldStreamToDisplay) {
            display?.onResourceOutput(
              resourceId!,
              pc.red(`└─ exit ${code ?? 1}`),
            );
          } else {
            console.log(
              tagPrefix + pc.dim("└─ exit ") + pc.red(String(code ?? 1)),
            );
          }
        }
      }
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      const detail = stderr.trim() || stdout.trim();
      reject(
        new Error(
          `Command failed: ${spawned.file} ${spawned.args.join(" ")}${detail ? `\n${detail}` : ""}`,
        ),
      );
    });

    if (options?.stdin !== undefined) {
      child.stdin.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code !== "EPIPE") fail(err);
      });
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}

export function createSystemCommand(
  config?: SystemCommandConfig,
): SystemCommand {
  const isGlobalVerbose = config?.verbose ?? false;
  return SystemCommand.of({
    execFile: (file, args, options) =>
      Effect.gen(function* () {
        const tag = yield* FiberRef.get(currentResourceTag);
        const resourceId = yield* FiberRef.get(currentResourceId);
        return yield* Effect.tryPromise({
          try: () =>
            spawnExecFile(
              file,
              args,
              options,
              isGlobalVerbose,
              tag,
              resourceId,
            ),
          catch: (error) =>
            new Error(
              `Command failed: ${file} ${args.join(" ")}\n${String(error)}`,
            ),
        });
      }),
    run: (command, options) =>
      Effect.gen(function* () {
        const tag = yield* FiberRef.get(currentResourceTag);
        const resourceId = yield* FiberRef.get(currentResourceId);
        return yield* Effect.tryPromise({
          try: () =>
            spawnExecFile(
              "sh",
              ["-c", command],
              options,
              isGlobalVerbose,
              tag,
              resourceId,
            ),
          catch: (error) =>
            new Error(`Command failed: ${command}\n${String(error)}`),
        });
      }),
  });
}

export function createSystemCommandLive(config?: SystemCommandConfig) {
  return Layer.succeed(SystemCommand, createSystemCommand(config));
}

export const SystemCommandLive = createSystemCommandLive();
