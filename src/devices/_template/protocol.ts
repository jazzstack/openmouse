/**
 * Template vendor protocol — pure encode/decode of HID reports.
 *
 * Keep every function here free of WebHID objects so it can be unit-tested
 * without hardware. Mirror the report layout of the real mouse: capture it
 * from the vendor's own tool or from USB captures before writing this file.
 *
 * Rename "Template" to your vendor/product when copying this folder.
 */

/** Output / feature report ids this vendor's protocol uses. */
export const TEMPLATE_REPORT = {
  /** Status feature report (read current settings). */
  status: 0x04,
} as const;

/** Command ids carried in the first byte of each report payload. */
export const TEMPLATE_COMMAND = {
  dpi: 0x01,
  pollingRate: 0x02,
} as const;

const OUTPUT_REPORT_LENGTH = 64;

/**
 * Build an output report for sendReport(). The browser supplies the report id
 * separately; the command id and payload live inside the report body.
 */
export function buildTemplateReport(command: number, payload: Uint8Array = new Uint8Array()): Uint8Array {
  if (!Number.isInteger(command) || command < 0 || command > 0xff) throw new Error("Invalid command.");
  if (payload.length > OUTPUT_REPORT_LENGTH - 2) throw new Error("Command payload is too large.");
  const report = new Uint8Array(OUTPUT_REPORT_LENGTH);
  report[0] = command;
  report.set(payload, 1);
  return report;
}

/** Decode a status feature report into the fields readStatus() needs. */
export function decodeTemplateStatus(data: Uint8Array): { dpi: number; pollingRateHz: number } {
  if (data.length < 5) throw new Error("Short Template status report.");
  const dpi = data[1]! | (data[2]! << 8);
  const pollingRateHz = data[3]! * 1000;
  return { dpi, pollingRateHz };
}
