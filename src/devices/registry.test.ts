import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEVICE_DRIVERS, clientSupportScore, createSupportedClient, deviceBrand } from "./registry.ts";
import { SUPPORTED_HID_FILTERS, VENDOR_ID } from "./vendors.ts";

const DEVICES_DIR = dirname(fileURLToPath(import.meta.url));

const REPORT_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0x0f, 0x10, 0x11, 0x20, 0xa1];
const USAGE_PAGES = [0x01, 0x0c, 0xff00, 0xff01, 0xff02, 0xff0a, 0xff43];

function report(reportId: number, byteLength = 16): HIDReportInfo {
  return { reportId, items: [{ reportSize: 8, reportCount: byteLength }] } as unknown as HIDReportInfo;
}

function collection(
  usagePage: number,
  usage: number,
  options: { feature?: number[]; input?: number[]; output?: number[] } = {},
): HIDCollectionInfo {
  return {
    usagePage,
    usage,
    type: 1,
    children: [],
    featureReports: (options.feature ?? []).map((id) => report(id)),
    inputReports: (options.input ?? []).map((id) => report(id)),
    outputReports: (options.output ?? []).map((id) => report(id)),
  } as unknown as HIDCollectionInfo;
}

function collectionShapes(): HIDCollectionInfo[][] {
  const shapes: HIDCollectionInfo[][] = [[]];
  shapes.push(USAGE_PAGES.map((page) =>
    collection(page, 1, { feature: REPORT_IDS, input: REPORT_IDS, output: REPORT_IDS })));
  for (const page of USAGE_PAGES) {
    for (const usage of [0, 1, 2]) {
      shapes.push([collection(page, usage, { feature: REPORT_IDS, input: REPORT_IDS, output: REPORT_IDS })]);
      for (const id of REPORT_IDS) {
        shapes.push([collection(page, usage, { input: [id], output: [id] })]);
        shapes.push([collection(page, usage, { feature: [id] })]);
      }
    }
  }
  return shapes;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

function candidateProductIds(): number[] {
  const ids = new Set<number>([0x0000, 0x0001, 0x1234, 0xffff]);
  for (const file of sourceFiles(DEVICES_DIR)) {
    for (const match of readFileSync(file, "utf8").matchAll(/0x[0-9a-f]{4}\b/gi)) {
      ids.add(Number.parseInt(match[0], 16));
    }
  }
  return [...ids];
}

const SHAPES = collectionShapes();
const PRODUCT_IDS = candidateProductIds();
const VENDOR_IDS = [...new Set(Object.values(VENDOR_ID))];

const probe = {
  vendorId: 0,
  productId: 0,
  productName: "probe",
  opened: false,
  collections: [] as HIDCollectionInfo[],
} as unknown as HIDDevice;

function claimsFor(vendorId: number, productId: number, collections: HIDCollectionInfo[]): string[] {
  const mutable = probe as unknown as { vendorId: number; productId: number; collections: HIDCollectionInfo[] };
  mutable.vendorId = vendorId;
  mutable.productId = productId;
  mutable.collections = collections;
  const claims: string[] = [];
  for (const driver of DEVICE_DRIVERS) {
    if (driver.supports(probe)) claims.push(driver.brand);
  }
  return claims;
}

test("the probe matrix can trigger every driver", () => {
  const fired = new Set<number>();
  for (const vendorId of VENDOR_IDS) {
    for (const productId of PRODUCT_IDS) {
      for (const collections of SHAPES) {
        const mutable = probe as unknown as { vendorId: number; productId: number; collections: HIDCollectionInfo[] };
        mutable.vendorId = vendorId;
        mutable.productId = productId;
        mutable.collections = collections;
        DEVICE_DRIVERS.forEach((driver, index) => {
          if (driver.supports(probe)) fired.add(index);
        });
      }
    }
  }
  const never = DEVICE_DRIVERS
    .map((driver, index) => ({ driver, index }))
    .filter(({ index }) => !fired.has(index))
    .map(({ driver, index }) => `[${index}] ${driver.brand}`);
  assert.deepEqual(
    never,
    [],
    "No synthetic device satisfies this driver's isSupported(), so the overlap test above proves nothing about it. Add its report id, usage page, or product id to REPORT_IDS / USAGE_PAGES.",
  );
});

test("no device can be claimed by more than one driver", () => {
  const clashes: string[] = [];
  for (const vendorId of VENDOR_IDS) {
    for (const productId of PRODUCT_IDS) {
      for (const collections of SHAPES) {
        const claims = claimsFor(vendorId, productId, collections);
        if (claims.length > 1) {
          clashes.push(`vid 0x${vendorId.toString(16)} pid 0x${productId.toString(16)}: ${claims.join(" + ")}`);
        }
      }
    }
  }
  assert.deepEqual(
    [...new Set(clashes)],
    [],
    "Two drivers accept the same device. driverFor() returns the first match in DEVICE_DRIVERS, so the later one is silently dead. Narrow one driver's isSupported().",
  );
});

test("every product id offered in the picker has a driver", () => {
  const orphans: string[] = [];
  for (const filter of SUPPORTED_HID_FILTERS) {
    const { vendorId, productId } = filter;
    if (vendorId === undefined || productId === undefined) continue;
    const claimed = SHAPES.some((collections) => claimsFor(vendorId, productId, collections).length > 0);
    if (!claimed) orphans.push(`vid 0x${vendorId.toString(16)} pid 0x${productId.toString(16)}`);
  }
  assert.deepEqual(
    orphans,
    [],
    "These ids are offered in the browser picker but no driver accepts them, so the device connects and then fails to read.",
  );
});

// Frozen contract: the class each driver resolves to, plus its brand and
// priority score. These are the values a future registry refactor could
// silently change (a wrong score argument reorders drivers; a wrong brand
// relabels the sidebar). If a change is deliberate, update this table.
const EXPECTED_RESOLUTION: Record<string, { brand: string; score: number | null }> = {
  FinalmouseHidClient: { brand: "Finalmouse", score: 10 },
  EggOp1HidClient: { brand: "Endgame Gear", score: 10 },
  EggWeHidClient: { brand: "Endgame Gear", score: null },
  PulsarProHidClient: { brand: "Pulsar", score: 8 },
  PulsarHidClient: { brand: "Pulsar", score: 7 },
  TeevolutionHidClient: { brand: "Teevolution", score: 7 },
  VgnF2HidClient: { brand: "VGN", score: 7 },
  LogitechHidppClient: { brand: "Logitech", score: 6 },
  WLMouseHidClient: { brand: "WLMouse", score: 5 },
  LamzuHidClient: { brand: "Lamzu", score: 5 },
  OrbitalHidClient: { brand: "Orbital", score: 6 },
  RazerHidClient: { brand: "Razer", score: 6 },
  RazerViperMiniHidClient: { brand: "Razer", score: 6 },
  AtkHidClient: { brand: "ATK", score: 5 },
  RazerViperV4ProHidClient: { brand: "Razer", score: 7 },
};

test("registered drivers keep their brand and priority score", () => {
  const resolved = new Map<string, { vendorId: number; productId: number; collections: HIDCollectionInfo[] }>();
  for (const vendorId of VENDOR_IDS) {
    for (const productId of PRODUCT_IDS) {
      for (const collections of SHAPES) {
        const mutable = probe as unknown as { vendorId: number; productId: number; collections: HIDCollectionInfo[] };
        mutable.vendorId = vendorId;
        mutable.productId = productId;
        mutable.collections = collections;
        const client = createSupportedClient(probe);
        if (client && !resolved.has(client.constructor.name)) {
          resolved.set(client.constructor.name, { vendorId, productId, collections });
        }
        if (resolved.size >= Object.keys(EXPECTED_RESOLUTION).length) break;
      }
    }
  }

  for (const [name, expected] of Object.entries(EXPECTED_RESOLUTION)) {
    const snapshot = resolved.get(name);
    assert.ok(snapshot, `${name} was never reached by the probe matrix; fix its isSupported or remove it from EXPECTED_RESOLUTION.`);
    const device = { ...probe, ...snapshot } as unknown as HIDDevice;
    const client = createSupportedClient(device);
    assert.ok(client, `${name} stopped resolving.`);
    assert.equal(client.constructor.name, name);
    assert.equal(deviceBrand(client), expected.brand, `${name} brand changed.`);
    if (expected.score !== null) {
      assert.equal(clientSupportScore(device), expected.score, `${name} priority score changed.`);
    }
  }

  for (const name of resolved.keys()) {
    assert.ok(name in EXPECTED_RESOLUTION, `${name} resolved but is not in EXPECTED_RESOLUTION; add it so its score is locked.`);
  }
});

const WITHOUT_TESTS = new Set(["lamzu", "pulsar", "teevolution"]);

function deviceDirectories(): string[] {
  return readdirSync(DEVICES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

test("a new device directory ships tests", () => {
  const missing = deviceDirectories().filter((name) =>
    !WITHOUT_TESTS.has(name) && !readdirSync(join(DEVICES_DIR, name)).some((file) => file.endsWith(".test.ts")));
  assert.deepEqual(missing, [], "Add a *.test.ts covering this device's protocol encoding.");
});

test("the grandfathered list only names directories that still exist", () => {
  const present = new Set(deviceDirectories());
  const stale = [...WITHOUT_TESTS].filter((name) => !present.has(name));
  assert.deepEqual(stale, [], "Remove stale entries from WITHOUT_TESTS as devices gain coverage.");
});
