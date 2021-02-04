import { Assignment, ExportsInfo } from '../reader/moduleExports';
import { escapeRegExp } from 'tslint/lib/utils';
import { dropBlockStr, insertBeforeSearch } from '../../utils/string';

/**
 *
 * @param fileContent
 * @param exportsInfo
 */
export function rewriteExports(
    fileContent: string,
    exportsInfo: ExportsInfo,
): string {
    fileContent = rewriteGlobalExport(fileContent, exportsInfo.global);
    fileContent = rewriteInlineExports(fileContent, exportsInfo.inline);

    return fileContent;
}

/**
 *
 * @param content
 * @param globalExports
 */
function rewriteGlobalExport(
    content: string,
    globalExports: ExportsInfo['global'],
): string {
    if (!globalExports.raw) {
        return content;
    }

    // Default export (export=)
    if (globalExports.directAssignment) {
        const isDirectDeclaration = /[,={}]/.test(
            globalExports.directAssignment,
        );

        if (isDirectDeclaration) {
            const functionDefinition = `export default ${globalExports.directAssignment}`;
            content = content.replace(globalExports.raw, functionDefinition);
        } else {
            content = replacePropertyDeclaration(
                content,
                globalExports.directAssignment,
                { isDefault: true },
            );
        }
    }

    if (globalExports.exportedProperties) {
        globalExports.exportedProperties.forEach((property) => {
            const [alias, key] = property.split(':');
            if (alias && key) {
                content = moveExportedAssignment(content, globalExports.raw, {
                    key: alias,
                    value: key,
                });
            } else {
                content = replacePropertyDeclaration(content, property);
            }
        });
    }

    if (globalExports.exportedKeySets) {
        globalExports.exportedKeySets.forEach((property) => {
            content = replacePropertyDeclaration(content, property, {
                isKeySet: true,
            });
        });
    }

    if (globalExports.assignments) {
        globalExports.assignments.forEach((assignment) => {
            content = moveExportedAssignment(
                content,
                globalExports.raw,
                assignment,
            );
        });
    }

    // Don't replace content for direct default export
    const isDirectInlineAssignment =
        globalExports.directAssignment &&
        /[\s"':;=(){}]/.test(globalExports.directAssignment); // not a var name
    if (isDirectInlineAssignment) {
        return content;
    }

    try {
        content = dropBlockStr(content, globalExports.raw);
    } catch (err) {
        // May never happen
        console.warn(`⚠️cannot find raw export\n${globalExports.raw}`);
    }

    return content;
}

/**
 * Update exported const / function / class with export keyword
 * @param fileContent
 * @param inlineExports
 */
function rewriteInlineExports(
    fileContent: string,
    inlineExports: ExportsInfo['inline'],
): string {
    const sortedExports = inlineExports.sort(
        (exportA, exportB) => exportB.property.length - exportA.property.length,
    );

    // Replace declarations
    sortedExports.forEach((inlineExport) => {
        const fileWithFunctionReplacement = rewriteInlineFunctionDefinitions(
            fileContent,
            inlineExport,
        );
        if (fileWithFunctionReplacement) {
            fileContent = fileWithFunctionReplacement;
            return;
        }

        const searchDefinedConst = new RegExp(
            `^(const|let|var)\\s+${escapeRegExp(
                inlineExport.property,
            )}\\s*[=;].*`,
            'gm',
        );
        const hasDefinedConst = searchDefinedConst.exec(fileContent);
        const importedValue = findPropertyImport(
            fileContent,
            inlineExport.property,
        );

        if (hasDefinedConst) {
            // Update original constant definition and drop the export statement
            fileContent = fileContent.replace(
                hasDefinedConst[0],
                `export ${hasDefinedConst[0]}`,
            );
            fileContent = fileContent.replace(
                new RegExp(`${escapeRegExp(inlineExport.raw)}.*\n`),
                '',
            );
        } else if (typeof importedValue === 'string') {
            const reExport = importedValue.replace(/^import /, 'export ');
            fileContent = fileContent.replace(
                importedValue,
                `${importedValue}\n${reExport}`,
            );
            fileContent = fileContent.replace(
                `${inlineExport.rawFullLine}\n`,
                '',
            );
            console.warn(
                `👀 ️a property is used and exported, you should manually check\n${inlineExport.property}`,
            );
        } else {
            // Update export statement
            const replacement = `export const ${inlineExport.property} = `;
            fileContent = fileContent.replace(inlineExport.raw, replacement);
        }
    });

    // Replace usages
    sortedExports.forEach((inlineExport) => {
        fileContent = deleteExportsUsage(fileContent, inlineExport.property);
    });

    return fileContent;
}

function deleteExportsUsage(
    fileContent: string,
    property: string,
    exportDefinition: number = -1,
) {
    const usagePosition = fileContent.indexOf(`exports.${property}`);
    if(exportDefinition !== -1 && usagePosition !== -1 && usagePosition < exportDefinition){
        console.warn(
            `⚠️an exported constant is used before its definition: "${property}"`,
        );
    }
    return fileContent.replace(
        new RegExp(`(module\\.)?exports\\.${escapeRegExp(property)}`, 'g'),
        property,
    );
}

/**
 * Search for function exported declarations and replace them with direct name
 * - `exports.fnName = function()` --- `export function fnName (){}`
 * - `exports.fnName = async () => {}` --- `export async fnName () => {}`
 */
function rewriteInlineFunctionDefinitions(
    fileContent: string,
    inlineExport: ExportsInfo['inline'][0],
): string | null {
    const parseFn = /(.*=\s*(?:async\s*)?)function([\s(])/.exec(
        inlineExport.rawFullLine,
    );
    const parseArrow = /(.*=\s*)async(\s*\()/.exec(inlineExport.rawFullLine);

    // Last ; is becoming useless
    if (parseFn || parseArrow) {
        const rawFullLine = inlineExport.rawFullLine;
        const strWithoutSemicolon = rawFullLine.replace(/;\s*$/m, '');
        fileContent = fileContent.replace(rawFullLine, strWithoutSemicolon);
    }

    if (parseFn !== null) {
        fileContent = fileContent.replace(
            parseFn[0],
            `${parseFn[1]}function ${inlineExport.property}${parseFn[2]}`,
        );
        return fileContent.replace(inlineExport.raw, 'export ');
    }
    if (parseArrow !== null) {
        fileContent = fileContent.replace(
            parseArrow[0],
            `${parseArrow[1]}async ${inlineExport.property}${parseArrow[2]}`,
        );
        return fileContent.replace(inlineExport.raw, 'export ');
    }

    return null;
}

/**
 * Update const / function / class declaration using export keyword
 * @param content
 * @param assignment
 * @param options
 */
function replacePropertyDeclaration(
    content: string,
    assignment: string,
    options: { isDefault?: boolean; isKeySet?: boolean } = {},
): string {
    const rawPropertyImport = findPropertyImport(
        content,
        assignment,
        options.isKeySet,
    );

    // Filter where the variable is used in the code
    const countUsageRegex = new RegExp(
        `[^a-zA-Z\d_-]${escapeRegExp(assignment)}[^a-zA-Z\d_:-]`,
        'g',
    );
    const useOccurrences = [...content.matchAll(countUsageRegex)].map(
        (regexMath) => regexMath[0],
    );
    const occurrenceDirectUsage = useOccurrences.filter((occurrence) => {
        const lastChar = occurrence[occurrence.length - 1];
        return lastChar === '.' || lastChar === '(';
    });

    const shouldReImport = occurrenceDirectUsage.length > 0;

    // Already exported with another key
    if (rawPropertyImport === true) {
        return content;
    }

    const rawPropertyDeclaration = findPropertyDeclaration(content, assignment);

    if (rawPropertyDeclaration === null && rawPropertyImport === null) {
        console.warn(
            `👀 ️cannot find and export declaration of property "${assignment}"`,
        );
    }

    if (rawPropertyDeclaration) {
        // TODO => should export named function
        const defaultKey = options.isDefault ? 'default ' : '';
        const updatedDeclaration = `export ${defaultKey}${rawPropertyDeclaration}`;
        content = content.replace(rawPropertyDeclaration, updatedDeclaration);

        if (/^(const)|(var)|(let) /.test(rawPropertyDeclaration)) {
            const insertPosition = content.indexOf(updatedDeclaration);
            content = deleteExportsUsage(content, assignment, insertPosition);
        } else {
            content = deleteExportsUsage(content, assignment);
        }
    } else if (rawPropertyImport) {
        let updatedImport: string;
        if (options.isKeySet) {
            updatedImport = rawPropertyImport.replace(
                `import * as ${assignment} `,
                `export * `,
            );
        } else {
            updatedImport = rawPropertyImport.replace(/^import /, 'export ');
            if (shouldReImport) {
                updatedImport += `\n${rawPropertyImport}`;
                console.warn(
                    `👀 ️a property is used and exported, you should manually check\n${updatedImport}`,
                );
            }
        }
        content = content.replace(rawPropertyImport, updatedImport);
    }

    return content;
}

/**
 * Check if the property is imported in a import instruction
 * @param fileContent
 * @param property
 * @param isEllipsis
 * @return true if already exported with other key
 */
function findPropertyImport(
    fileContent: string,
    property: string,
    isEllipsis: boolean = false,
): string | null | true {
    const findImportRegex = new RegExp(
        isEllipsis
            ? `^import \\* as ${escapeRegExp(property)} from .*$`
            : `^import ([^;]*)?[\\s{,]${escapeRegExp(
                  property,
              )}([,\\s}][^;]*)?from.*$`,
        'm',
    );

    const findExportRegex = new RegExp(
        isEllipsis
            ? `^export \\* as_ ${escapeRegExp(property)} from .*$`
            : `^export ([^;]*)?[\\s{,]${escapeRegExp(
                  property,
              )}[,\\s}][^;]*?from.*$`,
        'm',
    );

    const importDeclaration = findImportRegex.exec(fileContent);
    const exportDeclaration = findExportRegex.exec(fileContent);
    if (!importDeclaration && exportDeclaration) {
        return true;
    }

    if (importDeclaration) {
        return importDeclaration[0];
    }

    return null;
}

/**
 * Try to find property declaration in imports / const / class declarations
 * @param fileContent
 * @param property
 */
function findPropertyDeclaration(
    fileContent: string,
    property: string,
): string | null {
    const findFnRegex = new RegExp(
        `^(async)? *function\\s+${escapeRegExp(property)}[\\s(]`,
        'm',
    );
    const fnDeclaration = findFnRegex.exec(fileContent);
    if (fnDeclaration) {
        return fnDeclaration[0];
    }

    const findConstRegex = new RegExp(
        `^(const|var|let)\\s${escapeRegExp(property)}[\\s=]`,
        'gm',
    );
    const constDeclaration = findConstRegex.exec(fileContent);
    if (constDeclaration) {
        return constDeclaration[0];
    }

    const findClassRegex = new RegExp(
        `^(class)\\s${escapeRegExp(property)}[\\s(]`,
        'gm',
    );
    const classDeclaration = findClassRegex.exec(fileContent);
    if (classDeclaration) {
        return classDeclaration[0];
    }

    return null;
}

function moveExportedAssignment(
    fileContent: string,
    rawExport: string = '',
    assignment: Assignment,
): string {
    const firstLine = assignment.value.split('\n')[0];
    let toInsert: string;

    const protoComment = assignment.comment ? `\n${assignment.comment}` : '';

    // Case: named function
    if (firstLine.includes(` ${assignment.key}(`)) {
        toInsert = `${protoComment}\nexport ${assignment.value}\n`;
    } else {
        const parseFunctionProto = /^([^(]*function)\s*(\([\s\S]*)/g.exec(
            assignment.value,
        );
        if (parseFunctionProto) {
            // Case: convert to myFunction()
            toInsert = `${protoComment}\nexport ${parseFunctionProto[1]} ${assignment.key}${parseFunctionProto[2]}\n`;
        } else {
            // Not a function
            toInsert = `${protoComment}\nexport const ${assignment.key} = ${assignment.value};\n`;
        }
    }

    fileContent = insertBeforeSearch(fileContent, rawExport, toInsert, true);
    return fileContent;
}
