# Adding a vendor

This guide is the public contract for contributors. A vendor PR should touch
only its own folder, one registry line, and (optionally) a WebHID filter. The
control shell (`control.ts`, `control-events.ts`) must stay untouched.

## What you add

```
src/devices/<vendor>/
  hid.ts            → your client class, `implements DeviceClient`
  protocol.ts       → pure report encode/decode (no HID objects)
  protocol.test.ts  → unit tests for the protocol functions
  TESTING.md        → hardware verification checklist
```

Copy `src/devices/_template/` to `src/devices/<vendor>/` and rename the
`Template*` identifiers. The template compiles and passes `npm run check` as-is
before you change a single byte.

## The contract

`src/devices/driver.ts` defines everything the shell needs:

- `DeviceClient` — the surface the control shell talks to. Required: `device`,
  `open`, `close`, `readStatus`, `getDpiOptions`. Everything else is optional:
  **implement only what your mouse really supports.** A method you leave off
  hides that control; you never add a `if (brand === ...)` anywhere.

- `defineDriver(brand, ClientClass, score?)` — turns your class into a registry
  entry. `ClientClass.isSupported(device)` decides ownership; a static
  `supportScore` (or the `score` argument) orders drivers that accept the same
  device.

## The three steps

1. **Implement** the client in your vendor folder. `readStatus()` returns a
   `MouseStatus`; optional `ui` hints control which cards render.
2. **Register** one line in `src/devices/registry.ts`:
   ```ts
   defineDriver("YourBrand", YourMouseHidClient),
   ```
3. **Offer it in the picker** — add a `HIDDeviceFilter` to `SUPPORTED_HID_FILTERS`
   in `src/devices/vendors.ts` (vendor id only, or vendor + product + usage page
   when the vendor shares ids with unrelated devices).

## Should we really support a setting?

Not every vendor quirk is worth the maintenance. A setting ships only when it
passes all four checks:

1. **It exists.** Confirmed on the real mouse, not guessed from marketing.
2. **Verified on hardware.** Read-back matches the write and survives a replug.
   Unverified work hides behind the interface's "experimental" toggle.
3. **Reversible and low-risk.** No firmware writes or one-way commands that can
   leave the device in a bad state.
4. **Economical.** Shared across several models → put it on the standard
   interface. A one-model quirk → a small driver-only panel, not a
   `MouseStatus` field the whole UI must carry.

## Where to get the protocol

There is no unified "mice protocol" library; every vendor is proprietary.
Port from the best open-source references instead:

- **Logitech HID++** — [Solaar](https://github.com/pwr-Solaar/Solaar) is the
  canonical reference (this repo's `logitech/` is a port of it).
- **Multi-vendor** — [libratbag](https://github.com/libratbag/libratbag)
  models devices as a set of capabilities; borrow its *feature model*, not code.
- **Razer** — [OpenRazer](https://github.com/openrazer/openrazer).
- **SteelSeries** — [rivalcfg](https://github.com/flozz/rivalcfg).
- **Anything with a web tool** — the vendor's own WebHID page is the fastest
  spec: the minified JS contains every report pattern. Capture it with the
  repo's `capture-panel` / `hid-diagnostics` tools.
- **USB capture** — Wireshark/USBPcap (Windows) or usbmon (Linux) for diffing
  one-settings-per-capture.

## What the maintainers will check in review

- `npm run check` passes (`tsc --noEmit`, `vite build`, `node --test`).
- `TESTING.md` is complete; every write you exposed is ticked as verified.
- `isSupported()` is narrow enough that `registry.test.ts`'s overlap probe
  proves it can never claim another driver's device.
- No imports from `control.ts` or brand branches in the shell.
