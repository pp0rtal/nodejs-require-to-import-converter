import * as path from 'path';

/**
 * Stores all default export in session.
 * Boolean method to define if an import is requiring a global
 */
export default class DefaultUseHandler {
    private pathsHavingDefaultExport: string[];

    constructor(paths: string[]) {
        this.pathsHavingDefaultExport = paths;
    }

    /**
     *
     * @param filePath
     * @param rawLocalPath
     * @return True if the import is on a default
     */
    isDefaultImport(filePath: string, rawLocalPath: string): boolean {
        if (!rawLocalPath.startsWith('.')) {
            return false;
        }

        const dirPath = filePath.replace(/[^/]+$/, '');
        const localPath = `${rawLocalPath}${
            rawLocalPath.endsWith('.js') ? '' : '.js'
        }`;
        const importFullPath = path.resolve(dirPath, localPath);
        return this.pathsHavingDefaultExport.includes(importFullPath);
    }
}
