import * as path from 'path';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as fs from 'fs/promises';

import { updateFiles } from '../../../src/processor/process';
import { SinonStub } from 'sinon';

chai.use(sinonChai);
const expect = chai.expect;

describe('process', () => {
    const fixtureDir = path.join(__dirname, '../../fixtures/fakefs');
    const sandbox = sinon.createSandbox();
    let writeFileStub: SinonStub;
    let consoleLogStub: SinonStub;

    beforeEach(() => {
        writeFileStub = sandbox.stub(fs, 'writeFile');
        consoleLogStub = sandbox.stub(console, 'log');
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should process nothing when there is no files', async () => {
        const stats = await updateFiles([]);

        expect(writeFileStub).to.not.be.called;
        expect(stats.total).to.equal(0);
    });

    it('should process the file path', async () => {
        const filePath = `${fixtureDir}/index.js`;

        const stats = await updateFiles([filePath]);

        expect(writeFileStub).to.be.calledOnceWith(
            `${fixtureDir}/index.js`,
            `import * as helloLib from './lib/hello';
helloLib.sayHello();
`,
        );
        expect(stats.total).to.equal(1);
    });

    it('should process a file with lib not use as a default export', async () => {
        const filePath = `${fixtureDir}/useDefault.js`;

        await updateFiles([filePath]);

        expect(writeFileStub).to.be.calledOnceWith(
            `${fixtureDir}/useDefault.js`,
            `import * as MyDefaultExport from "./lib/MyDefaultExport";
console.log(MyDefaultExport.prototype)
`,
        );
    });

    it('should process a file with lib used as a default export', async () => {
        const filePath1 = `${fixtureDir}/useDefault.js`;
        const filePath2 = `${fixtureDir}/lib/MyDefaultExport.js`;

        await updateFiles([filePath1, filePath2]);

        expect(writeFileStub).to.be.calledTwice;
        expect(writeFileStub.args[0]).to.deep.equal([
            `${fixtureDir}/useDefault.js`,
            `import MyDefaultExport from "./lib/MyDefaultExport";
console.log(MyDefaultExport.prototype)
`,
        ]);
        expect(writeFileStub.args[1]).to.deep.equal([
            `${fixtureDir}/lib/MyDefaultExport.js`,
            `export default class MyDefaultExport extends Error {}
`,
        ]);
    });
});
