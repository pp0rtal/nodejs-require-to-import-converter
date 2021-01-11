export function insertBeforeSearch(
    str: string,
    search: string,
    insert: string,
) {
    const index = str.indexOf(search);
    if (index === -1) {
        throw new Error('cannot find pattern in str: ' + search);
    }

    return str.slice(0, index) + insert + str.slice(index);
}
