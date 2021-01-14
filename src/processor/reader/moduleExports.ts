// Relative to module.export() parsing

import { log } from 'util';

export type Assignment = {
    key: string;
    value: string;
    comment?: string;
};

export type ExportsInfo = {
    global: {
        directAssignment?: string;
        assignments?: Assignment[];
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
    const inlineExports = getInlineExports(removeInlineComment(content));

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

    // Search for exports={} and assign(exports, {...});
    const exportsAttributionRegex = /^ *(?:module\.)?exports\s*=([^{}=()\[\]]+)?\s*{([\s\S]*?)}\s*;?\n?/m;
    const exportsAssignAttributionRegex = /^ *(?:(?:(?:Object\.assign)|(?:_\.extend)|(?:_\.assign))\(\s*)(?:module\.)?exports\s*,([^{}=()\[\]]+)?\s*{([\s\S]*?)}\s*\);?\n?/m;

    // Search for assign(exports, var, var, var);
    const exportsAssignEllipsisOnly = /^ *(?:(?:Object\.assign)|(?:_\.extend)|(?:_\.assign))\(\s*(?:module\.)?exports\s*,([^{}=()\[\]]+)\);?\n?/m;

    // Similar to above but with a little trick:
    // RELYING ON   \n})
    const exportsAttributionRegexExperiment = /^ *(?:module\.)?exports\s*=\s*{([\s\S]*?)\n}?;?\n?/m;
    const exportsAssignRegexExperiment = /^ *(?:(?:(?:Object\.assign)|(?:_\.extend)|(?:_\.assign))\(\s*)(?:module\.)?exports\s*,\s*{([\s\S]*?)\n}\);?\n?/m;

    const exportMultilineDirectAssignment = /^(?:module\.)?exports\s*=\s*([^\n]+{\n.*\n}[^\n]+)/m;
    const exportDirectAssignment = /^(?:module\.)?exports\s*=\s*([^\s;]+);?\n?/m;

    // Execute regex
    const parseDirectEqual = exportDirectAssignment.exec(content);
    const parseDirectMultiEqual = exportMultilineDirectAssignment.exec(content);

    const parseObjectEllipsisAssign = exportsAssignEllipsisOnly.exec(content);

    const parseObjectEqual = exportsAttributionRegex.exec(content);
    const parseObjectEqualAssign = exportsAssignAttributionRegex.exec(content);
    const parseObjectEqualExp = exportsAttributionRegexExperiment.exec(content);
    const parseObjectAssignExp = exportsAssignRegexExperiment.exec(content);

    const parseAssignExperiment = parseObjectAssignExp || parseObjectEqualExp;
    const parseAssign = parseObjectEqualAssign || parseObjectEqual;

    // Case: Direct assignment with no properties module.exports=VAR
    if ((parseDirectEqual || parseDirectMultiEqual) && !parseAssign) {
        if (parseDirectMultiEqual) {
            return {
                raw: parseDirectMultiEqual[0],
                directAssignment: parseDirectMultiEqual[1],
            };
        }
        if (parseDirectEqual) {
            return {
                raw: parseDirectEqual[0],
                directAssignment: parseDirectEqual[1],
            };
        }
    }

    if (!parseAssign && parseObjectEllipsisAssign) {
        const { exportedProperties } = parseInnerAdvancedExport(
            parseObjectEllipsisAssign[1],
        );
        exportedContent.exportedProperties = (exportedProperties || []).concat(
            exportedContent.exportedProperties || [],
        );
        exportedContent.raw = parseObjectEllipsisAssign[0];
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
        let exportedAttributes = parseInnerExportedMethods(innerRaw);
        exportedContent.raw = rawOuterExport;

        // Ultimate sanitize function for basic assignments
        const assignments: ExportsInfo['global']['assignments'] = [];
        exportedAttributes = exportedAttributes.filter((attr) => {
            const split = attr.split(':');
            if (split.length === 2) {
                assignments.push({
                    key: split[0],
                    value: split[1].trim(),
                });
                return false;
            }
            return true;
        });

        exportedContent.exportedProperties = exportedAttributes;
        if (assignments.length) {
            exportedContent.assignments = assignments;
        }
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
    const sanitizedContent = removeInlineComment(innerContent);
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
            const valueSanitized = removeInlineComment(
                assignmentStr.substr(twoDotsIndex + 1).trim(),
            );

            assignments.push({
                key: assignmentStr.substr(0, twoDotsIndex).trim(),
                value: valueSanitized,
            });
        }
    });

    return {
        assignments,
        exportedProperties: properties.filter((str) => str !== ''),
    };
}

function removeInlineComment(str: string): string {
    return str.replace(/[ \t]*\/\/.*/g, '');
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
        if (!line.startsWith(tab) && line !== '') {
            throw new Error('invalid tabulation level');
        }
    });

    // Check each line for key declaration or direct function declaration
    const inlineNewAssign = /^([^\s:,?(){}="']+)\s*:\s*(.*?)(,?)\s*$/;
    const directFunction = /((?:async\s+)?(?:function\s+)?)([^\s:,?(){}="']+)\s*(\(.*?)(,?)$/;

    // Comment state
    let inMultilineComment = false;
    let multilineCommentBuffer = '';

    // Function state
    let blocBuffer = '';
    let blockProperty = '';

    // Handle function / comment state line by line
    lines.forEach((line) => {
        const paddedLine = line.replace(tab, ''); // tab to the left
        const paddedLineWithoutComment = paddedLine.replace(/\s*\/\/.*$/, '');
        const isInlineComment = /^\s*\/\/.*/.test(paddedLine);
        const isMultilineCommentStart = /^\/\*/.test(paddedLine);
        const isMultilineCommentEnd = /^\s\*\//.test(paddedLine);
        const isEndOfDefinition =
            /^[})]/.test(paddedLine) && !paddedLineWithoutComment.endsWith('{');
        const isEndOfAssignment = blockProperty && isEndOfDefinition;

        if (isEndOfAssignment) {
            blocBuffer += `\n${paddedLine}`;
            assignments.push(flushAssignment());
        }

        // Handle multiline comment state
        let isCommentLine =
            !blockProperty &&
            (inMultilineComment ||
                isInlineComment ||
                isMultilineCommentStart ||
                isMultilineCommentEnd);

        if (isCommentLine) {
            const isStart = multilineCommentBuffer;
            multilineCommentBuffer += `${isStart ? '\n' : ''}${paddedLine}`;
            if (isMultilineCommentStart) inMultilineComment = true;
            if (isMultilineCommentEnd) inMultilineComment = false;
        }
        if (isMultilineCommentStart && blockProperty) {
            assignments.push(flushAssignment());
        }

        const parseAliasDeclaration = inlineNewAssign.exec(
            paddedLineWithoutComment,
        );
        const parseDirectFunction = directFunction.exec(
            paddedLineWithoutComment,
        );

        if (
            !isCommentLine &&
            !isEndOfAssignment &&
            parseAliasDeclaration === null &&
            parseDirectFunction === null
        ) {
            if (blockProperty === '') {
                if (/[^:,=(){}]/.test(paddedLineWithoutComment)) {
                    properties.push(paddedLineWithoutComment.trim());
                } else if (!isCommentLine && /[^\s]/.test(line)) {
                    throw new Error('inconsistency');
                }
            } else {
                blocBuffer += `\n${paddedLine}`;
            }
        } else if (!isEndOfAssignment && !isCommentLine) {
            // Allow empty line
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
                blockProperty = key;
                blocBuffer = rightLine;
            }
        }
    });

    if (blocBuffer && blocBuffer.trim()) {
        if (!blockProperty) {
            properties.push(blocBuffer.trim());
        } else {
            assignments.push(flushAssignment());
        }
    }

    return {
        assignments,
        exportedProperties: properties
            .map((str) => str.replace(/[^\w]/g, ''))
            .filter((str) => str.length),
    };

    function flushAssignment() {
        const newAssignment: Assignment = {
            key: blockProperty,
            value: cleanMultilineAssignment(blocBuffer),
        };
        if (multilineCommentBuffer) {
            newAssignment.comment = multilineCommentBuffer;
        }
        multilineCommentBuffer = '';
        blockProperty = '';
        blocBuffer = '';
        return newAssignment;
    }
}

function cleanMultilineAssignment(str: string): string {
    return str.replace(/,[\n\s]*$/g, '');
}
