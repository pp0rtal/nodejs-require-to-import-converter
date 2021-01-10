import { ExportsInfo } from '../reader/moduleExports';
import { escapeRegExp } from 'tslint/lib/utils';

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

    if (globalExports.directAssignment) {
        content = replacePropertyDeclaration(content, globalExports.directAssignment);
    }

    if (globalExports.exportedProperties) {
        globalExports.exportedProperties.forEach((property) => {
            content = replacePropertyDeclaration(content, property);
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
 */
function replacePropertyDeclaration(
    content: string,
    assignment: string,
): string {
    const isEllipsis = assignment.startsWith('...');
    if (isEllipsis) {
        assignment = assignment.substr(3);
    }
    const rawPropertyImport = findPropertyImport(
        content,
        assignment,
        isEllipsis,
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
        content = content.replace(
            rawPropertyDeclaration,
            `export ${rawPropertyDeclaration}`,
        );
    } else if (rawPropertyImport) {
        const updatedImport = isEllipsis
            ? rawPropertyImport.replace(
                  `import * as ${assignment} `,
                  `export * `,
              )
            : rawPropertyImport.replace(/^import/, 'export');
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
        isEllipsis: boolean,
    ): string | null | true {
        const findImportRegex = new RegExp(
            isEllipsis
                ? `^import \\* as ${escapeRegExp(property)} from .*$`
                : `^import [\\s\\S]*?[\\s{,]${escapeRegExp(property)}[,\\s}][\\s\\S]*?from.*$`,
            'm',
        );

        const findExportRegex = new RegExp(
            isEllipsis
                ? `^export \\* as ${escapeRegExp(property)} from .*$`
                : `^export [\\s\\S]*[\\s{,]${escapeRegExp(property)}[,\\s}][\\s\\S]*from.*$`,
            'm',
        );

        const importDeclaration = findImportRegex.exec(fileContent);
        const exportDeclaration = findExportRegex.exec(fileContent);
        if(!findImportRegex && exportDeclaration){
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
