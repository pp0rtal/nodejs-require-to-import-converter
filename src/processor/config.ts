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
