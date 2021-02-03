import { RequireInfo } from '../reader/requires';
import { IMPORT_LAST_COMMA, IMPORT_QUOTE, REMOVE_JS_EXT } from '../config';
import { escapeRegExp } from '../../utils/regex';

/**
 *
 * @param fileContent
 * @param requirements
 */
export function rewriteImports(
    fileContent: string,
    requirements: RequireInfo[],
): string {
    requirements.forEach((requireConfig) => {
        const importLine = generateImport(fileContent, requireConfig);
        if (
            !requireConfig.commaSeparated &&
            /^[ \t]+/.test(requireConfig.raw)
        ) {
            console.warn(
                `👀 replaced an import with tabulation, you should have a look\n${importLine}`,
            );
        }
        fileContent = fileContent.replace(requireConfig.raw, importLine);
    });

    return fileContent;
}

/**
 * Generate "import aaa from bbb" line according requirement config
 * @param fileContent
 * @param requirement
 */
function generateImport(fileContent: string, requirement: RequireInfo): string {
    const quote = IMPORT_QUOTE || requirement.quoteType;
    const isGlobalImport =
        requirement.imports.length === 1 && requirement.imports[0].key === '*';

    if (!requirement.imports.length) {
        return `import ${quote}${requirement.target}${quote};`;
    }

    // format each param
    const importAssignments = requirement.imports.map((importConfig) => {
        if (
            importConfig.key === '*' &&
            importConfig.alias &&
            !requirement.hasDefault &&
            containsClassUsage(fileContent, importConfig.alias)
        ) {
            requirement.hasDefault = true;
        }

        if (importConfig.key === '*' && requirement.hasDefault) {
            return `${importConfig.alias}`;
        }
        if (importConfig.alias) {
            return `${importConfig.key} as ${importConfig.alias}`;
        }
        return `${importConfig.key}`;
    });

    // Surround imported params, multi or single line
    let importFormattedAssignment: string;
    if (requirement.indent) {
        importFormattedAssignment = importAssignments.join(
            `,\n${requirement.indent}`,
        );
        const lastComma = IMPORT_LAST_COMMA ? ',' : '';
        importFormattedAssignment = `{\n${requirement.indent}${importFormattedAssignment}${lastComma}\n}`;
    } else {
        importFormattedAssignment = importAssignments.join(', ');
        if (!isGlobalImport) {
            importFormattedAssignment = `{ ${importFormattedAssignment} }`;
        }
    }

    // remove .js extension
    const firstChar = requirement.target[0];
    if (REMOVE_JS_EXT && (firstChar === '.' || firstChar === '/')) {
        requirement.target = requirement.target.replace(/\.js$/, '');
    }

    return `import ${importFormattedAssignment} from ${quote}${requirement.target}${quote};`;
}

function containsClassUsage(fileContent: string, alias: string): boolean {
    return new RegExp(`new +${escapeRegExp(alias)} *\\(`).test(fileContent)
        || new RegExp(` extends +${escapeRegExp(alias)} *`).test(fileContent);
}
