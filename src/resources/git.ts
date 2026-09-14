import { Effect } from "effect";
import { Resource, Component } from "../core/component";
import { SystemCommand } from "../services/exec";
import { FileSystem, resolvePath } from "../services/fs";
import { hashConfig } from "../core/hash";

export interface GitResourceProps {
  url: string;
  dest: string;
  branch?: string;
  sparse?: string[];
  depth?: number;
  recursive?: boolean;
  force?: boolean;
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class GitResource extends Resource {
  override readonly kind = "git" as const;
  constructor(
    scope: Component,
    id: string,
    override readonly props: GitResourceProps,
  ) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    const { url, dest, branch, sparse, depth, recursive } = this.props;
    const targetDest = resolvePath(dest);
    const cleanSparse = sparse
      ? sparse
          .map((p) => p.replace(/^\/+/, "").replace(/\/+$/, ""))
          .filter(Boolean)
      : undefined;

    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const fs = yield* FileSystem;

      const exists = yield* fs.exists(targetDest);
      const isGit = exists && (yield* fs.exists(`${targetDest}/.git`));

      const become = this.props.become;
      const inRepo = { cwd: targetDest, become };

      if (!isGit) {
        if (exists) {
          yield* exec.execFile("git", ["init"], inRepo);
          yield* exec.execFile("git", ["remote", "add", "origin", url], inRepo);
          const fetchArgs = ["fetch"];
          if (depth) fetchArgs.push("--depth", String(depth));
          fetchArgs.push("origin");
          if (branch) fetchArgs.push(branch);
          yield* exec.execFile("git", fetchArgs, inRepo);

          if (cleanSparse && cleanSparse.length > 0) {
            yield* exec.execFile(
              "git",
              ["sparse-checkout", "init", "--cone"],
              inRepo,
            );
            yield* exec.execFile(
              "git",
              ["sparse-checkout", "set", ...cleanSparse],
              inRepo,
            );
          }
          yield* exec.execFile(
            "git",
            ["checkout", "-f", branch ? `origin/${branch}` : "FETCH_HEAD"],
            inRepo,
          );
          if (branch) {
            yield* exec.execFile("git", ["checkout", "-B", branch], inRepo);
          }
          if (recursive) {
            yield* exec.execFile(
              "git",
              ["submodule", "update", "--init", "--recursive"],
              inRepo,
            );
          }
        } else {
          const cloneArgs = ["clone"];
          if (depth) cloneArgs.push("--depth", String(depth));
          if (branch) cloneArgs.push("--branch", branch);
          if (recursive) cloneArgs.push("--recursive");
          if (cleanSparse && cleanSparse.length > 0)
            cloneArgs.push("--no-checkout");
          cloneArgs.push(url, targetDest);
          yield* exec.execFile("git", cloneArgs, { become });

          if (cleanSparse && cleanSparse.length > 0) {
            yield* exec.execFile(
              "git",
              ["sparse-checkout", "init", "--cone"],
              inRepo,
            );
            yield* exec.execFile(
              "git",
              ["sparse-checkout", "set", ...cleanSparse],
              inRepo,
            );
            yield* exec.execFile("git", ["checkout", branch || "HEAD"], inRepo);
          }
        }
      } else {
        const rawUrl = yield* exec.execFile(
          "git",
          ["remote", "get-url", "origin"],
          { ...inRepo, intent: "read" },
        );
        const currentUrl = rawUrl.trim();
        const normalize = (u: string) =>
          u
            .replace(/^git@github\.com:/, "https://github.com/")
            .replace(/\.git$/, "");
        if (normalize(currentUrl) !== normalize(url)) {
          throw new Error(
            `Git destination ${dest} exists but points to ${currentUrl} instead of ${url}`,
          );
        }

        if (this.props.force) {
          const fetchArgs = ["fetch", "origin"];
          if (depth) fetchArgs.push("--depth", String(depth));
          if (branch) fetchArgs.push(branch);
          yield* exec.execFile("git", fetchArgs, inRepo);

          if (cleanSparse && cleanSparse.length > 0) {
            yield* exec.execFile(
              "git",
              ["sparse-checkout", "set", ...cleanSparse],
              inRepo,
            );
          }

          if (branch) {
            yield* exec.execFile(
              "git",
              ["checkout", "-f", "-B", branch, `origin/${branch}`],
              inRepo,
            );
          } else {
            yield* exec.execFile(
              "git",
              ["reset", "--hard", "FETCH_HEAD"],
              inRepo,
            );
          }
        } else {
          if (branch) {
            yield* exec.execFile("git", ["checkout", branch], inRepo);
          }

          if (cleanSparse && cleanSparse.length > 0) {
            yield* exec.execFile(
              "git",
              ["sparse-checkout", "set", ...cleanSparse],
              inRepo,
            );
            yield* exec.execFile("git", ["checkout", branch || "HEAD"], inRepo);
          }

          yield* exec.execFile("git", ["pull"], inRepo);
        }

        if (recursive) {
          yield* exec.execFile(
            "git",
            ["submodule", "update", "--init", "--recursive"],
            inRepo,
          );
        }
      }
    });
  }

  destroy() {
    // Leave dest on disk. A clone may contain unmanaged files.
    return Effect.void;
  }
}
