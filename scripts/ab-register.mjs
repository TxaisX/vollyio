import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./ab-loader.mjs", pathToFileURL("./scripts/"));
