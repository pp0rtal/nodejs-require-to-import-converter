import { RequireInfo } from '../reader/requires';
import { IMPORT_LAST_COMMA, IMPORT_QUOTE, REMOVE_JS_EXT } from '../config';
import { escapeRegExp } from '../../utils/regex';
import DefaultUseHandler from '../../utils/DefaultUseHandler';
import logger from "../../utils/sessionLogger";

/**
 */
export function rewriteImports(
    fileContent: string,
    requirements: RequireInfo[],
    filePath: string | null = null,
    defaultUseHandler: DefaultUseHandler | null = null,
): string {
    requirements.forEach((requireConfig) => {
        const importLine = generateImport(
            fileContent,
            requireConfig,
            filePath,
            defaultUseHandler,
        );
        if (
            !requireConfig.commaSeparated &&
            /^[ \t]+/.test(requireConfig.raw)
        ) {
            logger.warn(
                `👀 replaced an import with tabulation, you should have a look\n${importLine}`,
            );
        }
        fileContent = fileContent.replace(requireConfig.raw, importLine);
    });

    return fileContent;
}

/**
 * Generate "import aaa from bbb" line according requirement config
 */
function generateImport(
    fileContent: string,
    requirement: RequireInfo,
    filePath: string | null = null,
    defaultUseHandler: DefaultUseHandler | null = null,
): string {
    const quote = IMPORT_QUOTE || requirement.quoteType;
    const isGlobalImport =
        requirement.imports.length === 1 && requirement.imports[0].key === '*';

    if (!requirement.imports.length) {
        return `import ${quote}${requirement.target}${quote};`;
    }

    // format each param
    let importAssignments = requirement.imports.map((importConfig) => {
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

    // Use session path handler
    if (
        filePath &&
        defaultUseHandler &&
        requirement.imports.length === 1 &&
        requirement.imports[0].key === '*' &&
        requirement.imports[0].alias
    ) {
        if (defaultUseHandler.isDefaultImport(filePath, requirement.target)) {
            importAssignments = [requirement.imports[0].alias];
        }
    }

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
    return (
        new RegExp(`new +${escapeRegExp(alias)} *\\(`).test(fileContent) ||
        new RegExp(` extends +${escapeRegExp(alias)} *`).test(fileContent)
    );
}
