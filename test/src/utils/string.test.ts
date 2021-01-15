import { expect } from 'chai';

import { insertBeforeSearch } from '../../../src/utils/string';

describe('lib - string', () => {
    describe('insertBeforeSearch', () => {
        it('should insert a string before the search pattern', async () => {
            const str = 'abcdefgh';

            expect(insertBeforeSearch(str, 'c', '_')).to.equal('ab_cdefgh');
            expect(insertBeforeSearch(str, '', '_')).to.equal('_abcdefgh');
        });

        it('should let new lines unchanged within the insertion', async () => {
            const str = 'aaa\n\nbbb';

            expect(insertBeforeSearch(str, 'b', '___', false)).to.equal(
                'aaa\n\n___bbb',
            );
        });

        it('should set adapted new lines within a content', async () => {
            const str = 'aaa\nbbb\n';

            expect(insertBeforeSearch(str, 'b', '___', true)).to.equal(
                'aaa\n\n___\n\nbbb\n',
            );
        });

        it('should let no space if in the first line', async () => {
            const str = 'aaa\nbbb\n';

            expect(insertBeforeSearch(str, 'a', '___', true)).to.equal(
                '___\n\naaa\nbbb\n',
            );
        });

        it('should let one space after if in the last line', async () => {
            const str = '';

            expect(insertBeforeSearch(str, '', '___', true)).to.equal('___\n');
        });
    });
});
