import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { rewriteImports } from '../../../../src/processor/writer/imports';
import { getRequires } from '../../../../src/processor/reader/requires';

chai.use(sinonChai);
const expect = chai.expect;

describe('writer processor - imports', () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => {
        sandbox.restore();
    });

    it('should not rewrite commented imports', () => {
        const fileContent = `//const _ = require('lodash');`;
        const requirements = getRequires(fileContent);

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal("//const _ = require('lodash');");
    });

    it('should rewrite direct import', () => {
        const fileContent = `require('source-map-support')`;
        const requirements = getRequires(fileContent);

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal("import 'source-map-support';");
    });

    it('should rewrite import with direct assignment', () => {
        const fileContent = `const _ = require('lodash');`;
        const requirements = getRequires(fileContent);

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal("import * as _ from 'lodash';");
    });

    it('should rewrite basic import having default', () => {
        const fileContent = `const _ = require('lodash');`;
        const requirements = getRequires(fileContent);
        requirements[0].hasDefault = true;

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal("import _ from 'lodash';");
    });

    it('should rewrite import with multiple keys', () => {
        const fileContent = `const {map,omit}=require('lodash');`;
        const requirements = getRequires(fileContent);

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal("import { map, omit } from 'lodash';");
    });

    it('should rewrite import with multiple keys with alias', () => {
        const fileContent = `const {map: _map, omit }=require('lodash');`;
        const requirements = getRequires(fileContent);

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal(
            "import { map as _map, omit } from 'lodash';",
        );
    });

    it('should rewrite import on specific requirements key', () => {
        const fileContent = `const expect = require("sinon").expect;`;
        const requirements = getRequires(fileContent);

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal('import { expect } from "sinon";');
    });

    it('should update multiple requirements', () => {
        const fileContent = `
const _ = require('lodash');
const sinon = require("sinon");

function a (){
  // some code
}
`;
        const requirements = getRequires(fileContent);

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal(`
import * as _ from 'lodash';
import * as sinon from "sinon";

function a (){
  // some code
}
`);
    });

    it('should update multiline requirements', () => {
        const fileContent = `
const _ = require('lodash');
const {
    validateSession,
    getToken,
} = require("./authenticator");
`;
        const requirements = getRequires(fileContent);

        const fileUpdate = rewriteImports(fileContent, requirements);

        expect(fileUpdate).to.deep.equal(`
import * as _ from 'lodash';
import {
    validateSession,
    getToken,
} from "./authenticator";
`);
    });
});
