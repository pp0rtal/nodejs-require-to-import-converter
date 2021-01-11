// Relative to module.export() parsing

export type ExportsInfo = {
    global: {
        directAssignment?: string;
        assignments?: Array<{
            key: string;
            value: string;
        }>;
        raw?: string;
        exportedProperties?: string[];
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
 * @param allowExperimental Will try to export single line assignments
 */
export function getExports(
    content: string,
    allowExperimental: boolean = false,
): ExportsInfo {
    const globalExports = getGlobalExports(content, allowExperimental);
    const inlineExports = getInlineExports(content);

    return {
        global: globalExports,
        inline: inlineExports,
    };
}

/**
 * Returns all exported values for direct module.exports assignments
 * @param content File content
 * @param allowExperimental
 */
export function getGlobalExports(
    content: string,
    allowExperimental: boolean = false,
): GlobalExportedContent {
    const exportedContent: GlobalExportedContent = {};
    const exportsAttributionRegex = /^ *(?:Object\.assign\(\s*)?module\.exports\s*[=,]([^{}=()\[\]]+)?\s*{([\s\S]*?)}\)?;?\n?/m;
    const exportsAssignEllipsisOnly = /^ *Object\.assign\(\s*module\.exports\s*,([^{}=()\[\]]+)\);?\n?/m;
    const exportsAttributionRegexExperiment = /^ *(?:Object\.assign\(\s*)?module\.exports\s*[=,]\s*{([\s\S]*?)\n}\)?;?\n?/m; // Search for linebreak
    const exportDirectAssignment = /^ *module\.exports\s*=\s*([^\s;]+);?\n?/m;

    const parseDirectAssignment = exportDirectAssignment.exec(content);
    const parseAssignEllipsis = exportsAssignEllipsisOnly.exec(content);
    const parseAssign = exportsAttributionRegex.exec(content);
    const parseAssignExperiment = exportsAttributionRegexExperiment.exec(
        content,
    );

    // Case: Direct assignment with no properties module.exports=VAR
    if (parseDirectAssignment && !parseAssign) {
        return {
            raw: parseDirectAssignment[0],
            directAssignment: parseDirectAssignment[1],
        };
    }

    if (!parseAssign && parseAssignEllipsis) {
        const { exportedProperties } = parseInnerAdvancedExport(
            parseAssignEllipsis[1],
        );
        exportedContent.exportedProperties = (exportedProperties || []).concat(
            exportedContent.exportedProperties || [],
        );
        exportedContent.raw = parseAssignEllipsis[0];
        return exportedContent;
    }

    if (parseAssign === null) {
        return exportedContent;
    }

    let [rawOuterExport, ellipsis, innerRaw] = parseAssign;
    const totalOpenBraces = rawOuterExport.split('{').length - 1;
    const totalCloseBraces = rawOuterExport.split('}').length - 1;
    const hasInnerScope = totalOpenBraces > 1 || totalCloseBraces > 1;
    const isAdvancedExport = /[{}()[\]]/.test(innerRaw);
    const isAdvancedMultilineExport =
        isAdvancedExport && innerRaw.includes('\n') && /[[{]/.test(innerRaw);

    if (hasInnerScope && !allowExperimental) {
        console.warn(
            `⚠ module.exports support with declaration inside is skipped (try "experimental" mode)\n${rawOuterExport}`,
        );
        return exportedContent;
    }

    if (isAdvancedExport && !allowExperimental) {
        console.warn(
            `⚠ module.exports contains direct declarations (try "experimental" mode)\n${innerRaw}`,
        );
        return exportedContent;
    }

    // Experimental on multiline has to catch \n})?;
    if (isAdvancedMultilineExport && parseAssignExperiment === null) {
        console.warn(
            `⚠ module.exports experimental mode not able to find export content\n${innerRaw}`,
        );
        return exportedContent;
    }

    // Even more hacky than the rest of the project 😅
    if (isAdvancedExport) {
        if (isAdvancedMultilineExport && parseAssignExperiment) {
            try {
                innerRaw = parseAssignExperiment[1];
                rawOuterExport = parseAssignExperiment[0];
                const {
                    assignments,
                    exportedProperties,
                } = parseInnerMultilineAdvancedExport(innerRaw);
                exportedContent.raw = rawOuterExport;
                exportedContent.assignments = assignments;
                exportedContent.exportedProperties = exportedProperties;
            } catch (err) {
                console.warn(
                    `⚠ module.exports unable to parse multiline content (${err.message})\n${parseAssignExperiment[1]}`,
                );
                return exportedContent;
            }
        } else {
            const {
                assignments,
                exportedProperties,
            } = parseInnerAdvancedExport(innerRaw);
            exportedContent.raw = rawOuterExport;
            exportedContent.assignments = assignments;
            exportedContent.exportedProperties = exportedProperties;
        }
    } else {
        const exportedAttributes = parseInnerExportedMethods(innerRaw);
        exportedContent.raw = rawOuterExport;
        exportedContent.exportedProperties = exportedAttributes;
    }

    if (ellipsis) {
        const { exportedProperties } = parseInnerAdvancedExport(ellipsis);
        exportedContent.exportedProperties = (exportedProperties || []).concat(
            exportedContent.exportedProperties || [],
        );
    }

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

/**
 * @param innerContent
 */
function parseInnerAdvancedExport(
    innerContent: string,
): {
    assignments: ExportsInfo['global']['assignments'];
    exportedProperties: ExportsInfo['global']['exportedProperties'];
} {
    const sanitizedContent = innerContent;
    const containsAssignments = sanitizedContent.indexOf(':') !== -1;
    const assignmentsStr = sanitizedContent.split(
        containsAssignments ? /,\s*\n/ : ',',
    );

    const assignments: ExportsInfo['global']['assignments'] = [];
    const properties: ExportsInfo['global']['exportedProperties'] = [];

    assignmentsStr.forEach((assignmentStr) => {
        const twoDotsIndex = assignmentStr.indexOf(':');
        if (twoDotsIndex === -1) {
            properties.push(assignmentStr.trim());
        } else {
            assignments.push({
                key: assignmentStr.substr(0, twoDotsIndex).trim(),
                value: assignmentStr.substr(twoDotsIndex + 1).trim(),
            });
        }
    });

    return {
        assignments,
        exportedProperties: properties.filter((str) => str !== ''),
    };
}

/**
 * Try to spot declarations according tab size
 * @param innerContent
 */
function parseInnerMultilineAdvancedExport(
    innerContent: string,
): {
    assignments: ExportsInfo['global']['assignments'];
    exportedProperties: ExportsInfo['global']['exportedProperties'];
} {
    const assignments: ExportsInfo['global']['assignments'] = [];
    const properties: ExportsInfo['global']['exportedProperties'] = [];
    const sanitizedContent = innerContent
        .replace(/^\s*\n/gm, '')
        .replace(/^\n+/m, '');

    // Check if tabulation level is standard
    const lines = sanitizedContent.split('\n');
    const tabParse = /^(\s*)/.exec(sanitizedContent);
    if (tabParse === null || tabParse[1] === '') {
        throw new Error('cannot detect tabulation level');
    }
    const tab = tabParse[1];
    lines.forEach((line) => {
        if (!line.startsWith(tab)) {
            throw new Error('invalid tabulation level');
        }
    });

    // Check each line for key declaration or direct function declaration
    const inlineNewAssign = new RegExp(
        `^${tab}([^\\s:,?(){}="']+)\\s*:\\s*(.*?)(,?)\\s*$`,
    );
    const directFunction = new RegExp(
        `^${tab}((?:async\\s+)?(?:function\\s+)?)([^\\s:,?(){}="']+)\\s*(\\(.*?)(,?)$`,
    );

    let multilineBlocBuffer = '';
    let multilineBlockProperty = '';
    lines.forEach((line) => {
        const parseAliasDeclaration = inlineNewAssign.exec(line);
        const parseDirectFunction = directFunction.exec(line);

        line = line.replace(tab, ''); // tab to the left
        if (parseAliasDeclaration === null && parseDirectFunction === null) {
            if (multilineBlockProperty === '') {
                if (/[^:,=(){}]/.test(line)) {
                    properties.push(line.trim());
                } else {
                    throw new Error('inconsistency');
                }
            } else {
                multilineBlocBuffer += `\n${line}`;
            }
        } else {
            // end of multiline declaration
            if (multilineBlockProperty) {
                assignments.push({
                    key: multilineBlockProperty,
                    value: multilineBlocBuffer,
                });
                multilineBlockProperty = '';
                multilineBlocBuffer = '';
            }

            let key, rightLine, hasComma;
            if (parseAliasDeclaration === null && parseDirectFunction) {
                // Handle direct function declaration
                let fn;
                [, fn, key, rightLine, hasComma] = parseDirectFunction;
                if (fn !== '' && !fn.includes('function')) {
                    fn = `${fn}function `;
                }
                rightLine = `${fn ? fn : 'function '}${key}${rightLine}`;
            } else {
                // @ts-ignore
                [, key, rightLine, hasComma] = parseAliasDeclaration;
            }

            if (hasComma) {
                assignments.push({
                    key,
                    value: rightLine,
                });
            } else {
                multilineBlockProperty = key;
                multilineBlocBuffer = rightLine;
            }
        }
    });

    if (multilineBlocBuffer && multilineBlocBuffer.trim()) {
        if (!multilineBlockProperty) {
            properties.push(multilineBlocBuffer.trim());
        } else {
            assignments.push({
                key: multilineBlockProperty,
                value: multilineBlocBuffer,
            });
        }
    }

    return {
        assignments,
        exportedProperties: properties.map((str) => str.replace(/[^\w]/g, '')),
    };
}
