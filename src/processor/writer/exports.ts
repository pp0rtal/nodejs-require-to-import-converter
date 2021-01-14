import { Assignment, ExportsInfo } from '../reader/moduleExports';
import { escapeRegExp } from 'tslint/lib/utils';
import { insertBeforeSearch } from '../../utils/string';

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
            // module.exports({ alias: originalKeyToExport })
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

    const globalRawPosition = content.indexOf(globalExports.raw);
    if (globalRawPosition === -1) {
        // May never happen
        console.warn(`⚠️cannot find raw export\n${globalExports.raw}`);
    } else {
        content = content.replace(globalExports.raw, '');
    }

    return content;
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

    // Already exported with another key
    if (rawPropertyImport === true) {
        return content;
    }

    const rawPropertyDeclaration = findPropertyDeclaration(content, assignment);

    if (rawPropertyDeclaration === null && rawPropertyImport === null) {
        console.warn(
            `⚠️cannot find and export declaration of property "${assignment}"`,
        );
    }
    if (rawPropertyDeclaration) {
        const defaultKey = options.isDefault ? 'default ' : '';
        content = content.replace(
            rawPropertyDeclaration,
            `export ${defaultKey}${rawPropertyDeclaration}`,
        );
    } else if (rawPropertyImport) {
        let updatedImport: string;
        if (options.isKeySet) {
            updatedImport = rawPropertyImport.replace(
                `import * as ${assignment} `,
                `export * `,
            );
        } else {
            updatedImport = rawPropertyImport.replace(/^import /, 'export ');
        }
        content = content.replace(rawPropertyImport, updatedImport);
    }

    return content;

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
                ? `^export \\* as ${escapeRegExp(property)} from .*$`
                : `^export ([^;])*?[\\s{,]${escapeRegExp(
                      property,
                  )}([,\\s}][^;])*?from.*$`,
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
    inlineExports.forEach((inlineExport) => {
        const parseFn = /(.*\s)function([\s(])/.exec(inlineExport.rawFullLine);

        if (parseFn !== null) {
            fileContent = fileContent.replace(
                parseFn[0],

                `${parseFn[1]}function ${inlineExport.property}${parseFn[2]}`,
            );
            fileContent = fileContent.replace(inlineExport.raw, 'export ');
        } else {
            const replacement = `export const ${inlineExport.property} = `;
            fileContent = fileContent.replace(inlineExport.raw, replacement);
        }
        fileContent = fileContent.replace(
            new RegExp(`module\.exports\.${inlineExport.property}`, 'g'),
            inlineExport.property,
        );
    });

    return fileContent;
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
