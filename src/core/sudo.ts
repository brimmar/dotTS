import { spawnSync, execFileSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { Resource } from "./component";
import { resolvePath } from "../services/fs";

/**
 * Checks whether a path is in a protected system location that typically
 * requires root/sudo privileges to modify.
 */
export function isProtectedSystemPath(path: string): boolean {
  const resolved = resolvePath(path);
  if (resolved.startsWith("/var/tmp") || resolved.startsWith("/tmp")) {
    return false;
  }
  return (
    /^\/(etc|usr|opt|boot|root)(\/|$)/.test(resolved) ||
    /^\/var(\/|$)/.test(resolved)
  );
}

/**
 * Validates whether a given resource requires root/sudo elevation.
 */
export function resourceRequiresRoot(res: Resource): boolean {
  const props = (res as any).props ?? {};
  if (
    props.become === true ||
    (typeof props.become === "string" && props.become.length > 0)
  ) {
    return true;
  }
  if (props.become === false) {
    return false;
  }

  // Inherently privileged resources default to requiring root
  if (res.kind === "group" || res.kind === "user" || res.kind === "apt-repo") {
    return true;
  }
  if (res.kind === "service") {
    return !props.user;
  }
  if (res.kind === "pkg") {
    const mgr = props.manager;
    if (mgr === "apt" || mgr === "pacman") return true;
    if (!mgr && process.platform === "linux") return true;
  }

  return false;
}

/**
 * Checks whether a target path is allowed for modification given become settings.
 */
export function checkPathPermission(
  path: string,
  options?: { become?: boolean | string },
): void {
  if (options?.become) return;
  if (process.platform === "win32" || process.getuid?.() === 0) return;

  if (isProtectedSystemPath(path)) {
    throw new Error(
      `Permission denied: "${resolvePath(path)}" is in a protected system directory, but 'become' is not enabled on this resource.`,
    );
  }
}

export interface SudoSession {
  cleanup: () => void;
}

/**
 * Validates that elevated permissions are available when needed.
 * Prompts once interactively for the sudo password if credentials are not cached,
 * and maintains a background keepalive timer until cleanup() is called.
 */
export function setupSudoSession(
  resources: Resource[],
  options: { dryRun?: boolean; isInteractive?: boolean } = {},
): SudoSession {
  const noop: SudoSession = { cleanup: () => {} };

  if (process.platform === "win32" || process.getuid?.() === 0) {
    return noop;
  }

  const needsRoot = resources.some(resourceRequiresRoot);
  if (!needsRoot) {
    return noop;
  }

  if (options.dryRun) {
    p.log.info(
      pc.gray('[DRY RUN] Plan contains resources requiring elevated privileges (sudo)'),
    );
    return noop;
  }

  // Check if sudo credentials are already valid (non-interactive check)
  let alreadyAuthenticated = false;
  try {
    execFileSync('sudo', ['-n', 'true'], { stdio: 'ignore' });
    alreadyAuthenticated = true;
  } catch {}

  const isInteractive = options.isInteractive ?? (process.stdin.isTTY === true);

  if (!alreadyAuthenticated) {
    if (isInteractive) {
      p.log.info(
        pc.cyan("Elevated permissions required for system tasks (sudo)"),
      );
      const auth = spawnSync("sudo", ["-v"], { stdio: "inherit" });
      if (auth.status !== 0) {
        throw new Error(
          "Sudo authentication failed. System resources requiring root privileges cannot be applied.",
        );
      }
    } else {
      if (options.dryRun) {
        p.log.warn(
          pc.yellow(
            "[DRY RUN] Warning: Configuration contains resources requiring root privileges, but sudo credentials are not cached.",
          ),
        );
        return noop;
      }
      throw new Error(
        "Configuration contains resources requiring root privileges, but sudo credentials are not cached and no interactive terminal is available.",
      );
    }
  }

  if (process.platform === "linux") {
    try {
      execFileSync("sudo", ["-n", "chronyc", "makestep"], { stdio: "ignore" });
    } catch {}
  }

  // Start background keepalive every 50 seconds
  const interval = setInterval(() => {
    try {
      execFileSync("sudo", ["-n", "-v"], { stdio: "ignore" });
    } catch {}
  }, 50_000);

  interval.unref();

  return {
    cleanup: () => {
      clearInterval(interval);
    },
  };
}
