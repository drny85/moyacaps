export type MigrateImagesRequest = { prod: boolean; dryRun: boolean };

export const MIGRATE_IMAGES_USAGE = "Usage: bun run migrate:product-images (--dev | --prod) [--dry-run]";

/** Parse CLI args. The deployment must be named: there is no default, so a run never hits prod by accident. */
export function parseMigrateImagesArgs(argv: string[]): MigrateImagesRequest {
  const flags = new Set(argv);
  const known = new Set(["--dev", "--prod", "--dry-run"]);
  if (argv.some((a) => !known.has(a)) || flags.has("--dev") === flags.has("--prod")) {
    throw new Error(MIGRATE_IMAGES_USAGE);
  }
  return { prod: flags.has("--prod"), dryRun: flags.has("--dry-run") };
}
