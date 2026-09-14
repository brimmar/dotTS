import { describe, it, expect } from "bun:test";
import {
  isProtectedSystemPath,
  resourceRequiresRoot,
  checkPathPermission,
} from "./sudo";
import { App, Stack } from "./app";
import { Resource } from "./component";
import { GroupResource } from "../resources/group";
import { UserResource } from "../resources/user";
import { ServiceResource } from "../resources/service";
import { AptRepositoryResource } from "../resources/apt-repository";
import { PackageResource } from "../resources/package";
import { FileResource } from "../resources/file";

describe("sudo & permission checking", () => {
  it("detects protected system paths", () => {
    expect(isProtectedSystemPath("/etc/hosts")).toBe(true);
    expect(isProtectedSystemPath("/usr/local/bin/foo")).toBe(true);
    expect(isProtectedSystemPath("/opt/myapp")).toBe(true);
    expect(isProtectedSystemPath("/var/log/syslog")).toBe(true);
    expect(isProtectedSystemPath("/root/.bashrc")).toBe(true);
    expect(isProtectedSystemPath("/boot/grub")).toBe(true);

    // Non-protected or user paths
    expect(isProtectedSystemPath("/tmp/test.txt")).toBe(false);
    expect(isProtectedSystemPath("/var/tmp/scratch")).toBe(false);
    expect(isProtectedSystemPath("~/dotfiles")).toBe(false);
    expect(isProtectedSystemPath("/home/user/.config/nvim")).toBe(false);
  });

  it("detects inherently privileged resources", () => {
    const app = new App();
    const stack = new Stack(app, "test");

    const grp = new GroupResource(stack, "docker-grp", { name: "docker" });
    expect(resourceRequiresRoot(grp)).toBe(true);

    const usr = new UserResource(stack, "test-usr", { name: "testuser" });
    expect(resourceRequiresRoot(usr)).toBe(true);

    const srv = new ServiceResource(stack, "docker-srv", { name: "docker" });
    expect(resourceRequiresRoot(srv)).toBe(true);

    const repo = new AptRepositoryResource(stack, "docker-repo", {
      name: "docker",
      uri: "https://download.docker.com",
      distribution: "focal",
      components: ["stable"],
    });
    expect(resourceRequiresRoot(repo)).toBe(true);

    const aptPkg = new PackageResource(stack, "pkg-curl", {
      name: "curl",
      manager: "apt",
    });
    expect(resourceRequiresRoot(aptPkg)).toBe(true);

    const pacmanPkg = new PackageResource(stack, "pkg-git", {
      name: "git",
      manager: "pacman",
    });
    expect(resourceRequiresRoot(pacmanPkg)).toBe(true);

    const brewPkg = new PackageResource(stack, "pkg-brew", {
      name: "wget",
      manager: "brew",
    });
    expect(resourceRequiresRoot(brewPkg)).toBe(false);

    const normalFile = new FileResource(stack, "user-file", {
      path: "~/test.txt",
      content: "hi",
    });
    expect(resourceRequiresRoot(normalFile)).toBe(false);

    const rootFile = new FileResource(stack, "root-file", {
      path: "/etc/test.conf",
      content: "hi",
      become: true,
    });
    expect(resourceRequiresRoot(rootFile)).toBe(true);
  });

  it("respects become: false on normally privileged resources", () => {
    const app = new App();
    const stack = new Stack(app, "test");

    const grp = new GroupResource(stack, "custom-grp", {
      name: "custom",
      become: false,
    });
    expect(resourceRequiresRoot(grp)).toBe(false);

    const usr = new UserResource(stack, "custom-usr", {
      name: "custom",
      become: false,
    });
    expect(resourceRequiresRoot(usr)).toBe(false);

    const srv = new ServiceResource(stack, "user-srv", {
      name: "user-app",
      user: true,
    });
    expect(resourceRequiresRoot(srv)).toBe(false);
  });

  it("throws error when writing to protected path without become", () => {
    if (process.platform === "win32" || process.getuid?.() === 0) return;

    expect(() => checkPathPermission("/etc/hosts")).toThrow(
      /Permission denied/,
    );
    expect(() => checkPathPermission("/usr/bin/mytool")).toThrow(
      /Permission denied/,
    );

    // Permitted when become is set
    expect(() =>
      checkPathPermission("/etc/hosts", { become: true }),
    ).not.toThrow();
    expect(() =>
      checkPathPermission("/usr/bin/mytool", { become: "root" }),
    ).not.toThrow();

    // Permitted in user paths
    expect(() => checkPathPermission("~/myfile.txt")).not.toThrow();
    expect(() => checkPathPermission("/tmp/myfile.txt")).not.toThrow();
  });
});
