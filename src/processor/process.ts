import * as Bluebird from 'bluebird';
import * as fs from 'fs/promises';

import { loadFilesContent } from '../utils/fs';
import { getRequires } from './reader/requires';
import { getExports } from './reader/exports';
import { rewriteImports } from './writer/imports';
import { rewriteExports } from './writer/exports';

const stats = {
    total: 0,
    current: 0,
};

export async function updateFiles(filePaths: string[]) {
    stats.total = filePaths.length;
    stats.current = 0;
    const fileContents = await loadFilesContent(filePaths);

    await Bluebird.each(filePaths, async (path) => {
        const updatedContent = getUpdatedFile(path, fileContents[path]);
        updateStatus(path);
        await fs.writeFile(path, updatedContent);
    });
}

function getUpdatedFile(path: string, content: string) {
    // Read
    const requirements = getRequires(content);
    const exports = getExports(content);
    const nothingToDo =
        requirements.length === 0 &&
        !exports.global.raw &&
        !exports.inline.length;

    // if (nothingToDo) return content;

    // Write
    let updatedContent = rewriteImports(content, requirements);
    updatedContent = rewriteExports(updatedContent, exports);

    return updatedContent;
}

function updateStatus(file: string) {
    stats.current++;
    const percent = Math.round((stats.current / stats.total) * 100);

    const digits = String(stats.total).length;
    const str_current = String(stats.current).padStart(digits, ' ');
    const str_total = String(stats.total).padStart(digits, ' ');
    const str_percent = String(percent).padStart(3, ' ');

    console.log(
        `\r(${str_current}/${str_total}) ${str_percent}% - ${file}`,
    );
}
