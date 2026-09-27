/** Registers the TypeScript resolution hooks used by `npm run test:word`. */
import { register } from "node:module";

register("./ts-resolve-hooks.mjs", import.meta.url);
