/**
 * Related to file insertions:
 * Will try to insert with an adapted spacing
 * - depending if the block is in the first line (no \n)
 * - last line (1 \n)
 * - in the middle of content (\n\n then \n\n)
 */
export function insertBeforeSearch(
    str: string,
    search: string,
    insert: string,
    autoLineBreak: boolean = false,
) {
    const index = str.indexOf(search);
    if (index === -1) {
        throw new Error('cannot find pattern in str: ' + search);
    }

    let nbSpaceBefore = 0;
    let nbSpaceAfter = 0;
    const strEnd = str.slice(index);
    let strStart = str.slice(0, index);
    if (autoLineBreak) {
        nbSpaceBefore = 2;
        nbSpaceAfter = 2;
        strStart = removeLineBreakAfter(strStart);
        insert = removeLineBreakAround(insert);

        if (strStart === '') nbSpaceBefore = 0;
        if (strEnd === '') nbSpaceAfter = 1;
    }

    return [
        strStart,
        '\n'.repeat(nbSpaceBefore),
        insert,
        '\n'.repeat(nbSpaceAfter),
        strEnd,
    ].join('');
}

/**
 * Related to file block deletion:
 * Will try to delete str and let an adpated spacing
 * - no line break when in the first line
 * - 1 last line if at the end (1 \n)
 * - in the middle of content (\n\n then \n\n)
 */
export function dropBlockStr(
    str: string,
    search: string,
    autoLineBreak = true,
): string {
    const index = str.indexOf(search);
    if (index === -1) {
        throw new Error('cannot find pattern in str: ' + search);
    }

    let strStart = str.slice(0, index);
    let strEnd = str.slice(index + search.length);
    let nbSpaces = 0;
    if (autoLineBreak) {
        nbSpaces = 2;
        strStart = removeLineBreakAfter(strStart);
        strEnd = removeLineBreakBefore(strEnd);
        if (strStart === '') nbSpaces = 0;
        if (strEnd === '') nbSpaces = 1;
    }

    return strStart + '\n'.repeat(nbSpaces) + strEnd;
}

function removeLineBreakAround(str: string): string {
    return removeLineBreakBefore(removeLineBreakAfter(str));
}

function removeLineBreakBefore(str: string): string {
    return str.replace(/^\n*/m, '');
}

function removeLineBreakAfter(str: string): string {
    while (str.length && str[str.length - 1] === '\n') {
        str = str.substr(0, str.length - 1);
    }
    return str;
}
