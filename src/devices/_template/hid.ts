/**
 * Template device client — copy this folder to src/devices/<vendor>/ and
 * rename everything that says "Template".
 *
 * `implements DeviceClient` (src/devices/driver.ts): implement only the
 * methods your mouse actually supports. A missing method is not an error — it
 * simply hides that setting in the control shell. Only ship a write after
 * verifying it on hardware (see TESTING.md).
 */
import type { DeviceClient } from "../driver.ts";
import type { MouseStatus } from "../mouse-types.ts";
import { buildTemplateReport, decodeTemplateStatus, TEMPLATE_COMMAND, TEMPLATE_REPORT } from "./protocol.ts";

export const TEMPLATE_VENDOR_ID = 0x1234;
export const TEMPLATE_PRODUCT_ID = 0x5678;
export const TEMPLATE_DISPLAY_NAME = "Template Mouse";

const POLLING_RATES = [1000, 2000] as const;
const DPI_MIN = 400;
const DPI_MAX = 12000;

export class TemplateHidClient implements DeviceClient {
  readonly device: HIDDevice;

  constructor(device: HIDDevice) {
    this.device = device;
  }

  /** True when this driver owns the device. Keep it narrow (vid + pid + collection). */
  static isSupported(device: HIDDevice): boolean {
    return (
      device.vendorId === TEMPLATE_VENDOR_ID
      && device.productId === TEMPLATE_PRODUCT_ID
      && device.collections.some((collection) => collection.usagePage === 0xff00 && collection.usage === 0x0001)
    );
  }

  /** Optional: ranks this driver when several accept the same device. */
  static supportScore(_device: HIDDevice): number {
    return 5;
  }

  displayName(): string {
    return TEMPLATE_DISPLAY_NAME;
  }

  async open(): Promise<void> {
    if (!this.device.opened) await this.device.open();
  }

  async close(): Promise<void> {
    if (this.device.opened) await this.device.close();
  }

  getDpiOptions(): number[] {
    return Array.from({ length: DPI_MAX - DPI_MIN + 1 }, (_, index) => DPI_MIN + index);
  }

  async readStatus(): Promise<MouseStatus> {
    await this.open();
    const view = await this.device.receiveFeatureReport(TEMPLATE_REPORT.status);
    const data = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
    const telemetry = decodeTemplateStatus(data);

    return {
      brand: "Template",
      name: this.displayName(),
      ui: {
        family: "template",
        defaultDisplayName: TEMPLATE_DISPLAY_NAME,
        hideUnsupportedPollingRates: true,
      },
      batteryPercent: null,
      batteryState: "Unknown",
      dpi: telemetry.dpi,
      pollingRateHz: telemetry.pollingRateHz,
      supportedPollingRates: [...POLLING_RATES],
      activeProfile: null,
      liftOffDistance: null,
      firmware: [],
    };
  }

  async setDpi(dpi: number): Promise<number> {
    if (!Number.isInteger(dpi) || dpi < DPI_MIN || dpi > DPI_MAX) {
      throw new Error(`${TEMPLATE_DISPLAY_NAME} DPI must be between ${DPI_MIN} and ${DPI_MAX}.`);
    }
    await this.write(TEMPLATE_COMMAND.dpi, new Uint8Array([dpi & 0xff, dpi >> 8]));
    return dpi;
  }

  async setPollingRate(pollingRateHz: number): Promise<number> {
    if (!(POLLING_RATES as readonly number[]).includes(pollingRateHz)) {
      throw new Error("Unsupported polling rate.");
    }
    await this.write(TEMPLATE_COMMAND.pollingRate, new Uint8Array([pollingRateHz / 1000]));
    return pollingRateHz;
  }

  private async write(command: number, payload: Uint8Array): Promise<void> {
    await this.open();
    const report = buildTemplateReport(command, payload);
    await this.device.sendReport(TEMPLATE_REPORT.status, report.buffer as ArrayBuffer);
  }
}
