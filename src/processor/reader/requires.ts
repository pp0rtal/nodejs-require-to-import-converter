// Relative to require() parsing

export type RequireInfo = {
    target: string;
    raw: string;
    hasDefault?: boolean;
    quoteType: string;
    commaSeparated?: boolean;
    imports: Array<{
        key: string;
        alias?: string;
    }>;
    indent?: string;
};

/**
 * Spot all inline require() calls and try to parse them
 * @param content NodeJS File content
 * @returns List of requirements
 */
export function getRequires(content: string): RequireInfo[] {
    const requirements: Array<RequireInfo> = [];
    const requireCallLineRegex = /^\n?(([^;=/*().]*[=])?\s*require\s*\([^)]+\)[^\n]*)$/gm;

    let parseRequire;
    let previousImportCommaSeparated = false;
    do {
        parseRequire = requireCallLineRegex.exec(content);
        if (parseRequire !== null) {
            const parsedRequirement = parseRequirementStatement(
                parseRequire[1],
                previousImportCommaSeparated,
            );

            // Look at the , previous state to store commaSeparated
            if (parsedRequirement && previousImportCommaSeparated) {
                previousImportCommaSeparated =
                    parsedRequirement?.commaSeparated || false;
                parsedRequirement.commaSeparated = true;
            } else {
                previousImportCommaSeparated =
                    parsedRequirement?.commaSeparated || false;
            }

            if (parsedRequirement !== null) {
                if (!parsedRequirement.commaSeparated) {
                    delete parsedRequirement.commaSeparated;
                }
                requirements.push(parsedRequirement);
            }
        }
    } while (parseRequire !== null);

    return requirements.filter((requirement) => requirement !== null);
}

/**
 * Try to parse require() line
 * @param rawLine
 * @param isCommaDelimited
 * @return null or parsed requirement
 */
function parseRequirementStatement(
    rawLine: string,
    isCommaDelimited: boolean,
): RequireInfo | null {
    const requireRegex = /^\s*(?:(const|let|var)?\s*([^=/]+)\s*=)?\s*require\s*\(\s*(['"])([^'"]+)['"]\s*\)(?:\.([^\s;]+))?\s*;?(,)?/g;
    const parse = requireRegex.exec(rawLine);

    // Can happen for various syntactical reasons
    if (parse === null) {
        console.warn(`⚠️require() has failed to parse, input\n${rawLine}`);
        return null;
    }

    const [
        raw,
        varType,
        attributesRaw,
        quoteType,
        target,
        additionalPath,
        comma,
    ] = parse;

    if (!varType && /^\s*require/.test(raw)) {
        if (additionalPath) {
            console.warn(
                `⚠️require has direct direct call, you have to separate instructions\n${raw}`,
            );
            return null;
        }

        return {
            target,
            raw,
            quoteType,
            commaSeparated: comma === ',',
            imports: [],
        };
    }

    let parsedAttributes = parseAttribute(attributesRaw);
    if (!parsedAttributes) {
        return null;
    }

    if (!varType && !isCommaDelimited) {
        console.warn(`⚠️require is called on some global variable\n${raw}`);
        return null;
    }

    // Import can't deeply destructure
    // We'll try to root destructure at least here, or warn
    if (additionalPath) {
        const hasDirectFunctionCall = additionalPath.includes('(');
        const additionalKeysLength = additionalPath.split('.').length;
        const hasDestructuring = parsedAttributes[0].key !== '*';

        if (hasDirectFunctionCall) {
            console.warn(
                `⚠️require has direct function call, you have to separate instructions\n${raw}`,
            );
            return null;
        }

        if (additionalKeysLength > 1) {
            console.warn(
                `⚠ require has deep object destructuring on both sides, you have to use a new constant\n${raw}`,
            );
            return null;
        }

        if (additionalKeysLength === 1 && hasDestructuring) {
            console.warn(
                `⚠️require has object destructuring on a destructured import, you have to use a new constant\n${raw}`,
            );
            return null;
        }

        // We can destructure for 1 key, and no destructuring yet
        if (!hasDestructuring) {
            parsedAttributes = [
                {
                    key: additionalPath,
                    alias: parsedAttributes[0].alias,
                },
            ];
        }
    }

    // Drop useless aliases
    parsedAttributes = parsedAttributes.map(({ key, alias }) => {
        return !alias || alias === key ? { key } : { key, alias };
    });

    // Consider external lib with a default export...
    const isModuleImport =
        !target.startsWith('.') &&
        !target.startsWith('/') &&
        !target.includes('@');
    const hasDefault =
        isModuleImport &&
        parsedAttributes.length === 1 &&
        parsedAttributes[0].key === '*';

    const output: RequireInfo = {
        target,
        raw,
        commaSeparated: comma === ',',
        quoteType,
        imports: parsedAttributes,
    };

    if (hasDefault) {
        output.hasDefault = true;
    }

    const searchIndentRegex = /\n(\s+)/m.exec(parse[0]);
    if (searchIndentRegex !== null) {
        output.indent = searchIndentRegex[1];
    }

    return output;
}

/**
 * Parse left operand of require
 * const xxx = require, where xxx should handle all testcases
 * @param input left operand of require
 */
function parseAttribute(input: string): RequireInfo['imports'] | null {
    input = input.trim().replace(/\n/g, '');
    const hasDestructuring =
        input[0] === '{' && input[input.length - 1] === '}';
    if (!hasDestructuring) {
        return [
            {
                key: '*',
                alias: input,
            },
        ];
    }

    const innerDestructuringRaw = input.substring(1, input.length - 1).trim();
    if (innerDestructuringRaw.includes('{')) {
        console.warn(
            `⚠️require has deep object destructuring on left side, you have to use a new constant\n${input}`,
        );
        return null;
    }

    return innerDestructuringRaw
        .split(',')
        .filter((str) => str.length)
        .map((str) => str.trim())
        .map((str) => {
            const [rawKey, rawAlias] = str.split(':');

            return {
                key: rawKey.trim(),
                alias: rawAlias && rawAlias.trim(),
            };
        });
}
