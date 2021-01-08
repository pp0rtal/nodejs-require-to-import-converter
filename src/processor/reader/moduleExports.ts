// Relative to module.export() parsing

export type ExportsInfo = {
    global: {
        assignment?: string;
        raw?: string;
        properties?: string[];
    };
    inline: Array<{
        raw: string;
        rawFullLine: string;
        property: string;
    }>;
};

type GlobalExportedContent = ExportsInfo['global'];
type InlineExportedContent = ExportsInfo['inline'];

/**
 * Search for all supported module.exports usage
 * @param content
 */
export function getExports(content: string): ExportsInfo {
    const globalExports = getGlobalExports(content);
    const inlineExports = getInlineExports(content);

    return {
        global: globalExports,
        inline: inlineExports,
    };
}

/**
 * Returns all exported values for direct module.exports assignments
 * @param content File content
 */
export function getGlobalExports(content: string): GlobalExportedContent {
    const exportedContent: GlobalExportedContent = {};
    const exportsAttributionRegex = /^ *module\.exports\s*=\s*{([\s\S]*?)};?\n?/m;
    const exportsAssignAttributionRegex = /^ *Object\.assign\(\s*module\.exports\s*,\s*{([\s\S]*?)}\);?\n?/m;
    const exportDirectAssignment = /^ *module\.exports\s*=\s*([^\s;]+);?\n?/m;

    const parseDirectAssignment = exportDirectAssignment.exec(content);
    const parseDirectObjectAssign = exportsAttributionRegex.exec(content);
    const parseObjectAssign = exportsAssignAttributionRegex.exec(content);
    const parseAssign = parseDirectObjectAssign || parseObjectAssign;

    // Case: Direct assignment with no properties module.exports=VAR
    if (parseDirectAssignment && !parseAssign) {
        return {
            raw: parseDirectAssignment[0],
            assignment: parseDirectAssignment[1],
        };
    }

    if (parseAssign === null) {
        return exportedContent;
    }

    const [rawOuterExport, innerRaw] = parseAssign;
    const totalOpenBraces = rawOuterExport.split('{').length - 1;
    const totalCloseBraces = rawOuterExport.split('}').length - 1;
    const hasInnerScope = totalOpenBraces > 1 || totalCloseBraces > 1;
    const hasFunctionCall = innerRaw.includes('(');

    if (hasInnerScope) {
        console.warn(
            `⚠ module.exports support with declaration inside is not supported\n${rawOuterExport}`,
        );
        return exportedContent;
    }

    if (hasFunctionCall) {
        console.warn(
            `⚠ module.exports support with calls inside is not supported\n${rawOuterExport}`,
        );
        return exportedContent;
    }

    const isExperimentalExport = /[{}()[\]]/.test(innerRaw);
    if (isExperimentalExport) {
        console.warn(
            `⚠ module.exports is too complex (try "experimental" mode)\n${innerRaw}`,
        );
        return exportedContent;
    }

    const exportedAttributes = parseInnerExportedMethods(innerRaw);
    exportedContent.raw = rawOuterExport;
    exportedContent.properties = exportedAttributes;

    return exportedContent;
}

/***
 * Search for module.exports.attribute= instructions
 * @param content File content
 */
function getInlineExports(content: string): InlineExportedContent {
    const exportedContent: InlineExportedContent = [];
    const exportsPropertyRegex = /^\n?(\s*?(?:module\.)?exports\.([^=.\s]+)\s*=\s*).*/gm;

    let parsePropertyExport;
    do {
        parsePropertyExport = exportsPropertyRegex.exec(content);
        if (parsePropertyExport !== null) {
            exportedContent.push({
                raw: parsePropertyExport[1],
                property: parsePropertyExport[2],
                rawFullLine: parsePropertyExport[0],
            });
        }
    } while (parsePropertyExport !== null);

    return exportedContent;
}

/**
 *
 * @param innerContent
 */
function parseInnerExportedMethods(innerContent: string): string[] {
    const sanitizedContent = innerContent.replace(/\s/g, '');
    const methods = sanitizedContent.split(',');

    return methods.filter((str) => str.length > 0);
}
