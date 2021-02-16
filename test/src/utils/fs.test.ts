import { expect } from 'chai';

import { scanDir, loadFilesContent } from '../../../src/utils/fs';

const TEST_DIR = './test/fixtures/fakefs';

describe('lib - fs', () => {
    describe('scanDir', () => {
        it('should scan the file system without node_modules/ and .git/ dirs', async () => {
            const files = await scanDir(TEST_DIR);

            expect(files).to.deep.equal([
                './test/fixtures/fakefs/index.js',
                './test/fixtures/fakefs/lib/MyDefaultExport.js',
                './test/fixtures/fakefs/lib/hello.js',
                './test/fixtures/fakefs/useDefault.js',
            ]);
        });

        it('should scan all files', async () => {
            const files = await scanDir(TEST_DIR, []);

            expect(files).to.deep.equal([
                './test/fixtures/fakefs/index.js',
                './test/fixtures/fakefs/lib/MyDefaultExport.js',
                './test/fixtures/fakefs/lib/hello.js',
                './test/fixtures/fakefs/node_modules/fakepackage/test.js',
                './test/fixtures/fakefs/useDefault.js',
            ]);
        });
    });

    describe('loadFiles', () => {
        it('should load file content', async () => {
            const filesWithContent = await loadFilesContent([
                './test/fixtures/fakefs/index.js',
                './test/fixtures/fakefs/lib/hello.js',
            ]);

            expect(filesWithContent).to.deep.equal({
                './test/fixtures/fakefs/index.js': `const helloLib = require('./lib/hello');
helloLib.sayHello();
`,
                './test/fixtures/fakefs/lib/hello.js': `module.exports.sayHello = sayHello;

function sayHello(){
    console.log(\'hello\');
}
`,
            });
        });
    });
});
