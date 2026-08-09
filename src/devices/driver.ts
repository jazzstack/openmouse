/**
 * Public driver contract — the only file a new vendor needs to know about.
 *
 * It defines the surface the control shell uses to talk to any mouse, and the
 * helper that turns a client class into a registry entry. The shell never
 * references a vendor class by name; it talks to a `DeviceClient` and hides
 * whatever the client does not implement.
 *
 * New contributors: copy `src/devices/_template/` to `src/devices/<vendor>/`,
 * implement `DeviceClient`, then register one `defineDriver(...)` line in
 * `src/devices/registry.ts`. See `docs/adding-a-vendor.md`.
 */
import type { MouseLighting, MouseStatus } from "./mouse-types.ts";

/**
 * Minimum every driver must provide. A client that implements only this
 * surface is already selectable in the sidebar and can be read; the settings
 * grid simply stays hidden until the client adds write methods.
 *
 * `open`/`close` intentionally stay out of the core: some drivers manage their
 * own connection state and expose neither publicly.
 */
export interface DeviceClientCore {
  readonly device: HIDDevice;
  readStatus(): Promise<MouseStatus>;
  getDpiOptions(): number[] | Promise<number[]>;
}

/**
 * Full public contract for a vendor client.
 *
 * Every member below is optional on purpose: a setting method that is not
 * present simply does not render a control. Only implement what the mouse
 * actually supports, and only after verifying it on hardware.
 */
export interface DeviceClient extends DeviceClientCore {
  /** Sidebar/status name before the first status read resolves. */
  displayName?(): string;
  open?(): Promise<void>;
  close?(): Promise<void>;
  /** How often the shell refreshes status while this mouse is active. */
  pollIntervalMs?: number;
  /** Push notification stream; the shell re-reads status on each change. */
  startNotifications?(onChange: () => void): Promise<unknown>;
  setDpi?(dpi: number, dpiY?: number): Promise<unknown>;
  setPollingRate?(pollingRateHz: number): Promise<unknown>;
  setLiftOffDistance?(value: NonNullable<MouseStatus["liftOffDistance"]>): Promise<unknown>;
  setLiftOff?(liftOff: number, landing: number): Promise<unknown>;
  setLighting?(lighting: MouseLighting): Promise<unknown>;
  setMotionSync?(enabled: boolean): Promise<unknown>;
  setAngleSnapping?(enabled: boolean): Promise<unknown>;
  setRippleControl?(enabled: boolean): Promise<unknown>;
  setPerformanceMode?(enabled: boolean): Promise<unknown>;
  setDebounceTime?(milliseconds: number): Promise<unknown>;
  setSleepTimeout?(seconds: number): Promise<unknown>;
  setLowPowerThreshold?(percent: number): Promise<unknown>;
  setWheelAcceleration?(enabled: boolean): Promise<unknown>;
  setAngleTuning?(value: number): Promise<unknown>;
  setProfile?(profile: number): Promise<unknown>;
  setDongleLed?(enabled: boolean): Promise<unknown>;
  getSleepOptions?(): number[];
  getDebounceMaxMs?(): number;
  getLowPowerOptions?(): number[];
  getLowPowerPollingCeiling?(): number;
}

/** One entry in the registry; a driver owns a brand and a client class. */
export interface DeviceDriver<C extends DeviceClientCore = DeviceClientCore> {
  brand: string;
  supports(device: HIDDevice): boolean;
  create(device: HIDDevice): C;
  score(device: HIDDevice): number;
}

/**
 * A client class that can declare its own support check and score. Only
 * `isSupported` is required; `supportScore` lets a class order itself when
 * several drivers accept the same device.
 */
export interface DeviceClientClass<C extends DeviceClientCore = DeviceClientCore> {
  new (device: HIDDevice): C;
  isSupported(device: HIDDevice): boolean;
  supportScore?(device: HIDDevice): number;
}

/**
 * Turn a client class into a registry entry. `defaultScore` is used unless the
 * class declares `static supportScore`; raise it when this driver should win
 * over others that accept the same device.
 */
export function defineDriver<C extends DeviceClientCore>(
  brand: string,
  Client: DeviceClientClass<C>,
  defaultScore = 5,
): DeviceDriver<C> {
  return {
    brand,
    supports: (device) => Client.isSupported(device),
    create: (device) => new Client(device),
    score: (device) => Client.supportScore?.(device) ?? defaultScore,
  };
}
