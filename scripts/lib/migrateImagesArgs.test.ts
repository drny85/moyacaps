import { describe, expect, it } from "vitest";
import { MIGRATE_IMAGES_USAGE, parseMigrateImagesArgs } from "./migrateImagesArgs";

describe("parseMigrateImagesArgs", () => {
  it("requires an explicit deployment", () => {
    expect(() => parseMigrateImagesArgs([])).toThrow(MIGRATE_IMAGES_USAGE);
    expect(() => parseMigrateImagesArgs(["--dry-run"])).toThrow(MIGRATE_IMAGES_USAGE);
  });
  it("rejects both deployments and unknown flags", () => {
    expect(() => parseMigrateImagesArgs(["--dev", "--prod"])).toThrow(MIGRATE_IMAGES_USAGE);
    expect(() => parseMigrateImagesArgs(["--dev", "--wat"])).toThrow(MIGRATE_IMAGES_USAGE);
    expect(() => parseMigrateImagesArgs(["--dev", "extra"])).toThrow(MIGRATE_IMAGES_USAGE);
  });
  it("parses target and dry-run", () => {
    expect(parseMigrateImagesArgs(["--dev"])).toEqual({ prod: false, dryRun: false });
    expect(parseMigrateImagesArgs(["--prod", "--dry-run"])).toEqual({ prod: true, dryRun: true });
  });
});
