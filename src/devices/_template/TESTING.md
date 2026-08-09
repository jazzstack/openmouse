# Hardware verification checklist — Template Mouse

Copy this file into your vendor folder and tick every item on a **real device**
before submitting. A setting that has not been verified on hardware must be
hidden behind the "experimental" toggle or dropped.

## How to capture the protocol

1. Close the vendor's own software so it cannot fight you for the device.
2. Start a USB capture (Wireshark + USBPcap on Windows, `lsusb -t`/usbmon on
   Linux) or use the repo's `capture-panel` against the vendor's web tool.
3. Change **one setting per capture** in the vendor software and diff the
   reports — one changed byte per setting is the norm.
4. Mirror the layout in `protocol.ts` and cover it in `protocol.test.ts`.

## Read path

- [ ] `readStatus()` returns DPI, polling rate, battery, firmware
- [ ] A fresh connect (cold plug) reads correctly without the vendor software
- [ ] Wired and wireless transports both report the same status

## Write path

| Setting | Read back matches write? | Survives replug? |
| --- | --- | --- |
| DPI | [ ] | [ ] |
| Polling rate | [ ] | [ ] |

- [ ] Writes never hang; a missing/unresponsive device errors instead
- [ ] `npm run check` passes locally before the PR

## Caveats to record for the maintainers

- Which firmware / hardware revision was tested
- Any byte that only worked on one transport (wired vs receiver vs Bluetooth)
- Any write that needed a retry or a delay after a poll-rate switch
