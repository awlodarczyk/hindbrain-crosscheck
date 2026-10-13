import pkg from "../package.json" with { type: "json" };

/** Application version from package.json, shown in the status line and /api/health. */
export const APP_VERSION: string = pkg.version;
