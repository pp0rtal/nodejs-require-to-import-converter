import * as Bluebird from 'bluebird';
import * as fs from 'fs/promises';

import { loadFilesContent, TypeFileWithContent } from '../utils/fs';
import { getRequires, RequireInfo } from './reader/requires';
import { ExportsInfo, getExports } from './reader/moduleExports';
import { rewriteImports } from './writer/imports';
import { rewriteExports } from './writer/exports';
import { REFORMAT_EXPORTS_DIRECT_DEFINITION } from './config';
import DefaultUseHandler from '../utils/DefaultUseHandler';

type AllExports = { [key: string]: ExportsInfo };
type AllRequirements = { [key: string]: RequireInfo[] };
type Stats = { total: number; current: number };

export async function updateFiles(filePaths: string[]) {
    const stats: Stats = {
        total: filePaths.length,
        current: 0,
    };
    const fileContents = await loadFilesContent(filePaths);
    const allRequirements = getAllRequirements(fileContents);
    const allExports = getAllExports(fileContents);
    const pathsHavingDefaultExport = getPathsHavingDefaultExports(allExports);
    const defaultUseHandler = new DefaultUseHandler(pathsHavingDefaultExport);

    await Bluebird.each(filePaths, async (path) => {
        updateStatus(stats, path);
        const updatedContent = getUpdatedFile(
            path,
            fileContents[path],
            allRequirements[path],
            allExports[path],
            defaultUseHandler,
        );
        await fs.writeFile(path, updatedContent);
    });

    return stats;
}

function getAllRequirements(
    fileContents: TypeFileWithContent,
): AllRequirements {
    return Object.keys(fileContents).reduce((allRequirements, path) => {
        allRequirements[path] = getRequires(fileContents[path]);
        return allRequirements;
    }, {} as AllRequirements);
}

function getAllExports(fileContents: TypeFileWithContent): AllExports {
    return Object.keys(fileContents).reduce((allExports, path) => {
        allExports[path] = getExports(
            fileContents[path],
            REFORMAT_EXPORTS_DIRECT_DEFINITION,
        );
        return allExports;
    }, {} as AllExports);
}

function getPathsHavingDefaultExports(allExports: AllExports) {
    return Object.keys(allExports).filter((path) => {
        return allExports[path].global?.directAssignment;
    });
}

function getUpdatedFile(
    path: string,
    content: string,
    requirements: RequireInfo[],
    exports: ExportsInfo,
    defaultUseHandler: DefaultUseHandler,
) {
    let updatedContent = rewriteImports(
        content,
        requirements,
        path,
        defaultUseHandler,
    );
    updatedContent = rewriteExports(updatedContent, exports);

    return updatedContent;
}

function updateStatus(stats: Stats, file: string) {
    stats.current++;
    const percent = Math.round((stats.current / stats.total) * 100);

    const digits = String(stats.total).length;
    const str_current = String(stats.current).padStart(digits, ' ');
    const str_total = String(stats.total).padStart(digits, ' ');
    const str_percent = String(percent).padStart(3, ' ');

    console.log(`\r(${str_current}/${str_total}) ${str_percent}% - ${file}`);
}
