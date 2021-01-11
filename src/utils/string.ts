/**
 *
 * @param str
 * @param search
 * @param insert
 * @param limitLinebreak Maximum new line before and after the test insert
 */
export function insertBeforeSearch(
    str: string,
    search: string,
    insert: string,
    limitLinebreak: boolean = false,
) {
    const index = str.indexOf(search);
    if (index === -1) {
        throw new Error('cannot find pattern in str: ' + search);
    }

    let prepend = str.slice(0, index);
    if (limitLinebreak) {
        prepend = prepend.replace(/\n\n$/m, '\n');
    }

    return prepend + insert + str.slice(index);
}
