import { describe, expect, it, spyOn } from "bun:test";
import {
  LiveDisplay,
  alignRight,
  formatDuration,
  safeTruncateAnsi,
} from "./display";

describe("formatDuration", () => {
  it("formats under 1ms", () => {
    expect(formatDuration(0.5)).toBe("<1ms");
  });

  it("formats milliseconds", () => {
    expect(formatDuration(450)).toBe("450ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(2340)).toBe("2.34s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(65000)).toBe("1m 5.0s");
  });
});

describe("alignRight", () => {
  it("aligns text within max width", () => {
    const aligned = alignRight("left", "right", 20);
    expect(aligned.length).toBe(20);
    expect(aligned.startsWith("left")).toBe(true);
    expect(aligned.endsWith("right")).toBe(true);
  });
});

describe("safeTruncateAnsi", () => {
  it("does not truncate strings within limit", () => {
    expect(safeTruncateAnsi("hello", 10)).toBe("hello");
  });

  it("truncates strings longer than limit with ellipsis", () => {
    const truncated = safeTruncateAnsi("hello world this is a test", 10);
    expect(truncated.includes("...")).toBe(true);
  });
});

describe("LiveDisplay", () => {
  it("in non-verbose mode, collapses output and only prints completion line", () => {
    const display = new LiveDisplay({ verbose: false });
    const logs: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    display.onResourceStart("test:res", 1, 1);
    display.onResourceCommand("test:res", "echo hello", "/tmp");
    display.onResourceOutput("test:res", "hello world");
    display.onResourceComplete("test:res", {
      status: "created",
      labelPrefix: "+ Create: test:res",
      durationMs: 120,
    });

    logSpy.mockRestore();
    display.stop();

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("+ Create: test:res");
    expect(logs.some((l) => l.includes("echo hello"))).toBe(false);
    expect(logs.some((l) => l.includes("hello world"))).toBe(false);
  });

  it("in verbose mode, prints command, output lines and completion line", () => {
    const display = new LiveDisplay({ verbose: true });
    const logs: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    display.onResourceStart("test:res", 1, 1);
    display.onResourceCommand("test:res", "echo hello", "/tmp");
    display.onResourceOutput("test:res", "hello world");
    display.onResourceComplete("test:res", {
      status: "created",
      labelPrefix: "+ Create: test:res",
      durationMs: 120,
    });

    logSpy.mockRestore();
    display.stop();

    expect(
      logs.some((l) => l.includes("=>") && l.includes("#1 [test:res]")),
    ).toBe(true);
    expect(logs.some((l) => l.includes("echo hello"))).toBe(true);
    expect(logs.some((l) => l.includes("hello world"))).toBe(true);
    expect(logs.some((l) => l.includes("+ Create: test:res"))).toBe(true);
  });

  it("in non-verbose mode on failure, prints command, output lines and error", () => {
    const display = new LiveDisplay({ verbose: false });
    const logs: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    display.onResourceStart("test:fail", 1, 1);
    display.onResourceCommand("test:fail", "bad-cmd", "/tmp");
    display.onResourceOutput("test:fail", "bad-cmd: command not found");
    display.onResourceFail("test:fail", new Error("Exit code 127"), 1);

    logSpy.mockRestore();
    display.stop();

    expect(
      logs.some((l) => l.includes("=>") && l.includes("#1 [test:fail]")),
    ).toBe(true);
    expect(logs.some((l) => l.includes("bad-cmd"))).toBe(true);
    expect(logs.some((l) => l.includes("bad-cmd: command not found"))).toBe(
      true,
    );
    expect(logs.some((l) => l.includes("Exit code 127"))).toBe(true);
    expect(logs.some((l) => l.includes("■ Failed: test:fail"))).toBe(true);
  });
});
