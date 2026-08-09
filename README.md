# OpenMouse

OpenMouse is a browser-based control panel for supported gaming mice.

Connect a mouse, view its information, and change supported settings such as DPI
and polling rate without installing a different app for every brand.

This branch is deployed as the public development control panel.

## Development

```bash
npm install
npm run dev
```

Run the full local check before pushing changes:

```bash
npm run check
```

The control panel is organized by responsibility: `control.ts` coordinates the
application, while the template, events, DOM helpers, persisted preferences,
battery history, and device-client selection live in focused modules under
`src/`. Vendor drivers are grouped under `src/devices/`: `atk/`, `endgame/`,
`finalmouse/`, `logitech/`, `pulsar/`, `razer/`, `teevolution/`, and `wlmouse/`;
shared device types and HID filters remain directly under `src/devices/`.

## Adding a vendor

Each supported vendor is self-contained under `src/devices/<vendor>/`. Copy the
`src/devices/_template/` skeleton, implement the `DeviceClient` contract from
`src/devices/driver.ts`, then register one `defineDriver(...)` line in
`src/devices/registry.ts`. Full walkthrough: `docs/adding-a-vendor.md`.

The registry is the only central integration point for a new vendor; the
control UI discovers supported clients through it automatically, and a PR that
adds a vendor never touches `control.ts`.

Hardware-specific validation checklists live with each driver, for example
`src/devices/orbital/TESTING.md` for Orbital DMS V1/V2 devices and receivers.
