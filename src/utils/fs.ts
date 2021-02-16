import * as path from 'path';
// @ts-ignore
import * as scanDirRecursive from 'scan-dir-recursive/relative';
import * as Bluebird from 'bluebird';
import { promises as fs } from 'fs';

const IGNORE_DEFAULT = ['**/node_modules/**', '**/.git/**'];
const EXTENSION_FILTER = /\.(js)$/;

export type TypeFileWithContent = { [key: string]: string };

/**
 * List files having .js / .ts / .json extension
 * @param dirPath
 * @param ignore
 * @returns Full relative path of files
 */
export async function scanDir(
    dirPath: string,
    ignore = IGNORE_DEFAULT,
): Promise<string[]> {
    const files: string[] = await new Promise((resolve) => {
        scanDirRecursive(dirPath, (files: string[]) => resolve(files), ignore);
    });

    return files
        .filter((file) => EXTENSION_FILTER.test(file))
        .map((filePath) => path.join(dirPath, filePath));
}

/**
 * Read full content of all files
 * @param files
 * @return Associative array path => file content
 */
export async function loadFilesContent(files: string[]): Promise<TypeFileWithContent> {
    const output: TypeFileWithContent = {};

    await Bluebird.reduce(
        files,
        async (output, path) => {
            output[path] = await fs.readFile(path, 'utf-8');
            return output;
        },
        output,
    );

    return output;
}
