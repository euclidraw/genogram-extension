import { settingsSchema } from "./preferences.js";
import { ids } from "./model.js";
/** Shared by the bundle and build script; keep the reviewed and executed contracts identical. */
export function createPackageManifest(metadata) {
  return {
    id: metadata.id,
    settingsSchema,
    version: metadata.version,
    engine: metadata.engine,
    dependencies: { ...metadata.dependencies },
    optionalDependencies: { ...metadata.optionalDependencies },
    conflicts: [...metadata.conflicts],
    provides: {
      services: [...metadata.provides.services],
      aspects: Object.keys(ids).map((k) => `${metadata.id}.${k}`),
      hsmSlots: [...metadata.provides.hsmSlots],
    },
  };
}
