# OpenMouse

OpenMouse is a browser-based control panel for supported gaming mice.

Connect a mouse, view its information, and change supported settings such as DPI
and polling rate without installing a different app for every brand.

## This branch

`feat/device-driver-contract` publishes the vendor contribution system: a single
typed contract every driver implements, one registry line per vendor, and a
copyable template so a new mouse needs no changes to the control shell.

- **`src/devices/driver.ts`** — the public contract (`DeviceClient`,
  `DeviceClientCore`) and the `defineDriver(brand, ClientClass, score?)` helper.
- **`src/devices/_template/`** — the **unified vendor template** to copy.
- **`src/devices/registry.ts`** — the only central integration point; one
  `defineDriver(...)` line per vendor.
- **`docs/adding-a-vendor.md`** — full walkthrough and decision framework.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome or Edge (WebHID requires a browser with
HID support; localhost counts as a secure context).

## Development

The control panel is organized by responsibility: `control.ts` coordinates the
application, while the template, events, DOM helpers, persisted preferences,
battery history, and device-client selection live in focused modules under
`src/`. Vendor drivers are grouped under `src/devices/`: `atk/`, `endgame/`,
`finalmouse/`, `logitech/`, `pulsar/`, `razer/`, `teevolution/`, `vgn/`,
`wlmouse/`, and `_template/`; shared device types, the driver contract, and HID
filters remain directly under `src/devices/`.

### Running the checks

```bash
npm run check    # tsc --noEmit + vite build + node --test (all suites)
npm run size     # bundle-size budgets
```

### Verifying the driver contract (dev-side test)

The registry regression test walks a synthetic probe matrix and proves every
registered driver still resolves to the same class, brand, and priority score:

```bash
npm test                # includes "registered drivers keep their brand and priority score"
npm test -- --test-name-pattern="brand and priority"   # just that test
```

Simulate the contributor flow end-to-end without hardware — copy the template,
rename `Template*` → `Acme*`, add one line to `registry.ts`:

```ts
defineDriver("Acme", AcmeHidClient, 5),
```

then confirm the shell can resolve a matching device:

```bash
node --input-type=module -e "
import { createSupportedClient, clientSupportScore } from './src/devices/registry.ts';
const device = {
  vendorId: 0x1234, productId: 0x5678, productName: 'probe', opened: false,
  collections: [{ usagePage: 0xff00, usage: 1 }],
};
const client = createSupportedClient(device);
console.log(client?.constructor?.name ?? null, clientSupportScore(device));
"
# expect: AcmeHidClient 5
```

### Testing against real hardware

1. `npm run dev`, connect a supported mouse in Chrome/Edge.
2. Verify the sidebar entry and status read (DPI, polling rate, battery).
3. Change DPI or polling rate and **Flash** — the control must settle on the
   value the mouse reports back.

### Previewing a driver's UI without hardware

Each supported driver has a dev-only fixture rendered purely from `MouseStatus`:

```
http://localhost:5173/?preview=pulsar
http://localhost:5173/?preview=finalmouse
http://localhost:5173/?preview=razer-viper-mini
```

Add a fixture in `src/preview-fixtures.ts` and a key in `src/preview-modes.ts`
to preview a new vendor's cards. Preview routes are gated to dev mode and never
reach the production build.

## Adding a vendor (contributors)

Each supported vendor is self-contained under `src/devices/<vendor>/`.

1. **Copy the unified template** — `src/devices/_template/` → `src/devices/<vendor>/`
   and rename the `Template*` identifiers:

   ```
   src/devices/<vendor>/
     hid.ts            → your client, `implements DeviceClient`
     protocol.ts       → pure report encode/decode (no HID objects)
     protocol.test.ts  → unit tests for the protocol functions
     TESTING.md        → hardware verification checklist
   ```

2. **Implement the contract** (`src/devices/driver.ts`) — provide
   `device`, `readStatus`, `getDpiOptions`; add optional write methods only for
   settings the mouse really supports. A missing method hides that control —
   never add a `if (brand === ...)` branch in the shell.

3. **Register** — one line in `src/devices/registry.ts`:

   ```ts
   defineDriver("YourBrand", YourMouseHidClient),
   ```

4. **Offer it in the picker** — add a `HIDDeviceFilter` to `SUPPORTED_HID_FILTERS`
   in `src/devices/vendors.ts`.

5. **Verify** — `npm run check`, then tick `TESTING.md` on real hardware.
   Unverified settings hide behind the "experimental" toggle.

A vendor PR touches only its own folder, `registry.ts`, and `vendors.ts` —
never `control.ts`. Full walkthrough, the "should we really support this
setting?" gate, and where to port protocols from (Solaar, libratbag, OpenRazer,
rivalcfg, vendor web tools): `docs/adding-a-vendor.md`.
