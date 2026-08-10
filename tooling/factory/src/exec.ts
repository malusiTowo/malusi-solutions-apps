/**
 * Shelling out to provider CLIs.
 *
 * Some providers have no usable REST surface for provisioning — Expo's project
 * creation and Infisical's secret export are both CLI-first — so the factory calls
 * their binaries rather than reverse-engineering private endpoints.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FactoryError } from "./types";

const run = promisify(execFile);

export interface ExecOptions {
  readonly cwd?: string;
  /** Extra environment for the child, merged over `process.env`. */
  readonly env?: Record<string, string>;
  readonly driver: string;
  /** Seconds before the child is killed. CLIs that prompt would otherwise hang. */
  readonly timeoutSeconds?: number;
}

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Run a binary with an argument array — never a shell string, so product names and
 * secrets cannot be interpreted as shell syntax.
 */
export async function exec(
  command: string,
  args: readonly string[],
  options: ExecOptions,
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await run(command, [...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      timeout: (options.timeoutSeconds ?? 120) * 1000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout, stderr };
  } catch (cause) {
    const detail = cause as { stderr?: string; stdout?: string; code?: number };
    const message = (detail.stderr ?? detail.stdout ?? "").trim();
    throw new FactoryError(
      "command",
      `${command} ${args.join(" ")} exited ${detail.code ?? "non-zero"}${message ? `: ${message}` : ""}`,
      { driver: options.driver, cause },
    );
  }
}

/** Whether a binary is on PATH, so drivers can report a clear prerequisite. */
export async function hasCommand(command: string): Promise<boolean> {
  try {
    await run("which", [command]);
    return true;
  } catch {
    return false;
  }
}

export async function requireCommand(
  command: string,
  driver: string,
  install: string,
): Promise<void> {
  if (!(await hasCommand(command))) {
    throw new FactoryError(
      "command",
      `\`${command}\` is not on PATH. Install it with: ${install}`,
      { driver },
    );
  }
}
