import { AtkHidClient } from "./atk/hid.ts";
import { EggOp1HidClient } from "./endgame/egg-op1-hid.ts";
import { eggWeCreate, eggWeIsSupported, eggWeSupportScore, isEggWeClient, type EggWeHidClient } from "./endgame/egg-we-control.ts";
import { FinalmouseHidClient } from "./finalmouse/hid.ts";
import { LamzuHidClient } from "./lamzu/hid.ts";
import { LogitechHidppClient } from "./logitech/hidpp.ts";
import { OrbitalHidClient } from "./orbital/hid.ts";
import { PulsarHidClient } from "./pulsar/pulsar-hid.ts";
import { PulsarProHidClient } from "./pulsar/pulsar-pro-hid.ts";
import { RazerHidClient } from "./razer/hid.ts";
import { RazerViperMiniHidClient } from "./razer/viper-mini-hid.ts";
import { RazerViperV4ProHidClient } from "./razer/viper-v4-pro-hid.ts";
import { TeevolutionHidClient } from "./teevolution/hid.ts";
import { VgnF2HidClient } from "./vgn/hid.ts";
import { WLMouseHidClient } from "./wlmouse/hid.ts";
import { defineDriver } from "./driver.ts";

export type PulsarClient = PulsarHidClient | PulsarProHidClient;
export type SupportedClient = LogitechHidppClient | PulsarClient | EggOp1HidClient | EggWeHidClient | FinalmouseHidClient | WLMouseHidClient | LamzuHidClient | OrbitalHidClient | RazerHidClient | RazerViperMiniHidClient | RazerViperV4ProHidClient | TeevolutionHidClient | AtkHidClient | VgnF2HidClient;

/**
 * Ordered list of device drivers. `driverFor` returns the first driver whose
 * `supports()` accepts a device, so earlier entries win ties between brands.
 *
 * A new vendor is one `defineDriver(...)` line here plus a WebHID filter in
 * `./vendors.ts`. See `src/devices/_template/` and `docs/adding-a-vendor.md`.
 */
export const DEVICE_DRIVERS = [
  defineDriver("Finalmouse", FinalmouseHidClient, 10),
  defineDriver("Endgame Gear", EggOp1HidClient, 10),
  {
    brand: "Endgame Gear",
    supports: eggWeIsSupported,
    create: eggWeCreate,
    score: eggWeSupportScore,
  },
  defineDriver("Pulsar", PulsarProHidClient, 8),
  defineDriver("Pulsar", PulsarHidClient, 7),
  defineDriver("Teevolution", TeevolutionHidClient, 7),
  defineDriver("VGN", VgnF2HidClient, 7),
  defineDriver("Logitech", LogitechHidppClient, 6),
  defineDriver("WLMouse", WLMouseHidClient, 5),
  defineDriver("Lamzu", LamzuHidClient, 5),
  defineDriver("Orbital", OrbitalHidClient, 6),
  defineDriver("Razer", RazerHidClient, 6),
  defineDriver("Razer", RazerViperMiniHidClient, 6),
  defineDriver("ATK", AtkHidClient, 5),
  defineDriver("Razer", RazerViperV4ProHidClient, 7),
];

function driverFor(device: HIDDevice) {
  return DEVICE_DRIVERS.find((driver) => driver.supports(device));
}

export function createSupportedClient(device: HIDDevice): SupportedClient | null {
  return driverFor(device)?.create(device) ?? null;
}

export function clientSupportScore(device: HIDDevice): number {
  return driverFor(device)?.score(device) ?? 0;
}

export function deviceBrand(client: SupportedClient): string {
  if (client instanceof EggOp1HidClient || isEggWeClient(client)) return "Endgame Gear";
  return driverFor(client.device)?.brand ?? "Unknown";
}
