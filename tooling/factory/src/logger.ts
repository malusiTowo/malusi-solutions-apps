import type { Logger } from "./types";

const ESC = String.fromCharCode(27);
const RESET = `${ESC}[0m`;
const DIM = `${ESC}[2m`;
const RED = `${ESC}[31m`;
const YELLOW = `${ESC}[33m`;

const useColor = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
const paint = (code: string, text: string) => (useColor ? `${code}${text}${RESET}` : text);

export function createLogger(verbose: boolean): Logger {
  return {
    info: (m) => console.log(m),
    warn: (m) => console.warn(paint(YELLOW, `warn  ${m}`)),
    error: (m) => console.error(paint(RED, `error ${m}`)),
    debug: (m) => {
      if (verbose) console.log(paint(DIM, `      ${m}`));
    },
  };
}

/** Discards everything. Used by tests and by `plan --json`. */
export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
