import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { Context, Effect, Layer } from "effect";
import pc from "picocolors";
import { type Component, flatten, Resource } from "../core/component";
import { DottsError } from "../core/errors";
import { SecretToken } from "../core/secret";
import { FileSystem } from "./fs";
import { SecretManager } from "./secrets-manager";

export interface ValidationService {
  readonly validate: (
    component: Component,
  ) => Effect.Effect<void, Error, never>;
}

export const ValidationService =
  Context.GenericTag<ValidationService>("ValidationService");

export function extractCommandExecutable(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
      continue;
    }
    if (
      token === "sudo" ||
      token === "env" ||
      token === "command" ||
      token === "builtin"
    ) {
      continue;
    }
    if (["if", "while", "for", "until", "case", "{", "("].includes(token)) {
      return null;
    }
    return token;
  }
  return null;
}

export function isExplicitPath(cmd: string): boolean {
  return (
    cmd.startsWith("/") ||
    cmd.startsWith("~/") ||
    cmd.startsWith("./") ||
    cmd.startsWith("../")
  );
}

export function resolveExecutablePath(cmd: string): string {
  if (cmd.startsWith("~/")) {
    return join(homedir(), cmd.slice(2));
  }
  if (cmd === "~") {
    return homedir();
  }
  return resolve(cmd);
}

const SHELL_BUILTINS = new Set([
  "echo",
  "printf",
  "test",
  "[",
  "[[",
  "true",
  "false",
  "cd",
  "exit",
  "export",
  "set",
  "unset",
  "read",
  "alias",
  "unalias",
  "eval",
  "exec",
  "trap",
  "shift",
  "source",
  ".",
  "type",
  "hash",
  "pwd",
  "kill",
  "wait",
  "return",
  "command",
  "builtin",
  "shopt",
  "cat",
]);

export function isCommandInPath(cmd: string, envPath?: string): boolean {
  const pathEnv = envPath || process.env.PATH || "";
  const dirs = pathEnv
    .split(":")
    .concat(["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]);
  for (const dir of dirs) {
    if (dir) {
      const full = join(dir, cmd);
      if (existsSync(full)) return true;
    }
  }
  return false;
}

export const ValidationServiceLive = Layer.effect(
  ValidationService,
  Effect.gen(function* () {
    const sm = yield* SecretManager;
    const fs = yield* FileSystem;

    return ValidationService.of({
      validate: (component: Component) =>
        Effect.gen(function* () {
          const resources = flatten(component);

          for (const res of resources) {
            const props = (res as any).props || {};

            // 1. SecretToken references
            for (const key of Object.keys(props)) {
              const value = props[key];
              if (value instanceof SecretToken) {
                const secrets = yield* sm.list();
                if (!secrets.includes(value.name)) {
                  yield* Effect.fail(
                    new DottsError(
                      `Secret not found: ${value.name} (referenced by ${res.id})`,
                      `Configure the secret with 'dotts secrets set ${value.name} <value>' or verify .dotts/vault.`,
                    ),
                  );
                }
              }
            }

            // 2. Script binary and dependency check
            if (res instanceof Resource && res.kind === "script") {
              const runCommand = props.run;
              if (typeof runCommand === "string") {
                const exec = extractCommandExecutable(runCommand);
                const hasDeps =
                  (res.dependencies && res.dependencies.length > 0) ||
                  (Array.isArray(props.dependsOn) &&
                    props.dependsOn.length > 0);

                if (exec && !hasDeps && !props.onlyIf) {
                  if (isExplicitPath(exec)) {
                    const targetPath = resolveExecutablePath(exec);
                    const exists = yield* fs.exists(targetPath);
                    if (!exists) {
                      yield* Effect.fail(
                        new DottsError(
                          `Script '${runCommand}' executes '${exec}' which does not exist on the filesystem and has no declared dependencies`,
                          `Add 'dependsOn: [upstreamResource]' to the script resource so the command runs after its required binary is created.`,
                        ),
                      );
                    }
                  } else if (
                    !SHELL_BUILTINS.has(exec) &&
                    !isCommandInPath(exec, props.environment?.PATH)
                  ) {
                    p.log.warn(
                      pc.yellow(
                        `Script '${res.id}' executes '${exec}' which was not found in PATH and has no declared dependencies.`,
                      ),
                    );
                  }
                }
              }
            }
          }
        }),
    });
  }),
);
