/**
 * Specify (" or ') for `import from "file"` instructions
 * Set null to keep original quote system
 */
export const IMPORT_QUOTE: '"' | "'" | null = null;

/**
 * Set true if you want the last comma in import like
 * import {
 *     key,
 * } from "./file"
 */
export const IMPORT_LAST_COMMA: boolean = true;

/**
 * Will try to move and export direct function definition in module.export
 */
export const REFORMAT_EXPORTS_DIRECT_DEFINITION: boolean = true;

/**
 * Will convert require("./myfile.js") to import "myfile" (no extension)
 */
export const REMOVE_JS_EXT: boolean = true;

/**
 * Will use import { default as ClassName } from ...
 * when the files has a direct export and
 */
export const IMPORT_DEFAULT_MODULE_INTEROP: boolean = true;

