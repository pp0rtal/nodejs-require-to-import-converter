import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { getRequires } from '../../../../src/processor/reader/requires';

chai.use(sinonChai);
const expect = chai.expect;

describe('reader processor - require()', () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => {
        sandbox.restore();
    });

    describe('non-supported imports', () => {
        it('should avoid non supported require and warn', () => {
            const fileContent = `const _ = require(SOME_VARIABLE);`;
            const loggerWarnSpy = sandbox.stub(console, 'warn');

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([]);
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                '⚠️require() has failed to parse, input\n' +
                    'const _ = require(SOME_VARIABLE);',
            );
        });

        it('should avoid function call inside imports and warn', () => {
            const fileContent = `const router = require("express").Router();`;
            const loggerWarnSpy = sandbox.stub(console, 'warn');

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([]);
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                '⚠️require has direct function call, you have to separate instructions\n' +
                    'const router = require("express").Router();',
            );
        });

        it('should avoid multiline function call imports and warn', () => {
            const fileContent = `
            require("fs").copyFileSync(
                path.resolve(filesRoot),
            );`;
            const loggerWarnSpy = sandbox.stub(console, 'warn');

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([]);
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                '⚠️require has direct direct call, you have to separate instructions\n' +
                    '            require("fs").copyFileSync(',
            );
        });

        it('should avoid deep object destructuring and warn', () => {
            const fileContent = `
/* some useless comment */
const createClock = require("sinon").clock.create;`;
            const loggerWarnSpy = sandbox.stub(console, 'warn');

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([]);
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                '⚠ require has deep object destructuring on both sides, you have to use a new constant\n' +
                    'const createClock = require("sinon").clock.create;',
            );
        });

        it('should avoid deep object destructuring for single key on destructured constant and warn', () => {
            const fileContent = `const { create: creatClock } = require("sinon").clock;`;
            const loggerWarnSpy = sandbox.stub(console, 'warn');

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([]);
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                '⚠️require has object destructuring on a destructured import, you have to use a new constant\n' +
                    'const { create: creatClock } = require("sinon").clock;',
            );
        });
    });

    describe('var/let/const basic support', () => {
        it('should parse require without assignment', () => {
            const fileContent = " require('source-map-support')";

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    target: 'source-map-support',
                    quoteType: "'",
                    raw: " require('source-map-support')",
                    imports: [],
                },
            ]);
        });

        it('should parse basic global require in "const"', () => {
            const fileContent = `const _ = require('lodash');`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    hasDefault: true,
                    target: 'lodash',
                    quoteType: "'",
                    raw: "const _ = require('lodash');",
                    imports: [
                        {
                            key: '*',
                            alias: '_',
                        },
                    ],
                },
            ]);
        });

        it('should parse basic global require in "let"', () => {
            const fileContent = `let _ = require("lodash");`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    hasDefault: true,
                    target: 'lodash',
                    quoteType: '"',
                    raw: 'let _ = require("lodash");',
                    imports: [
                        {
                            key: '*',
                            alias: '_',
                        },
                    ],
                },
            ]);
        });

        it('should parse basic global require in "var"', () => {
            const fileContent = ` var _ = require('../some/path')`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    target: '../some/path',
                    quoteType: "'",
                    raw: " var _ = require('../some/path')",
                    imports: [
                        {
                            key: '*',
                            alias: '_',
                        },
                    ],
                },
            ]);
        });

        it('should support comma separated require', () => {
            const fileContent = `var fs = require("graceful-fs"),
    xml2js = require("xml2js");
const _ = require("underscore");`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    commaSeparated: true,
                    hasDefault: true,
                    target: 'graceful-fs',
                    quoteType: '"',
                    raw: 'var fs = require("graceful-fs"),',
                    imports: [
                        {
                            key: '*',
                            alias: 'fs',
                        },
                    ],
                },
                {
                    hasDefault: true,
                    commaSeparated: true,
                    target: 'xml2js',
                    quoteType: '"',
                    raw: '    xml2js = require("xml2js");',
                    imports: [
                        {
                            key: '*',
                            alias: 'xml2js',
                        },
                    ],
                },
                {
                    hasDefault: true,
                    target: 'underscore',
                    quoteType: '"',
                    raw: 'const _ = require("underscore");',
                    imports: [
                        {
                            key: '*',
                            alias: '_',
                        },
                    ],
                },
            ]);
        });

        it('should avoid commented require() calls', () => {
            const fileContent = `some_code() // const _ = require('lodash');`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([]);
        });

        it('should avoid comments after a requirement', () => {
            const fileContent = `const _ = require('lodash');    // some comment after`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    hasDefault: true,
                    target: 'lodash',
                    quoteType: "'",
                    raw: "const _ = require('lodash');",
                    imports: [
                        {
                            key: '*',
                            alias: '_',
                        },
                    ],
                },
            ]);
        });

        it('should avoid non declared variable and warn', () => {
            const fileContent = `_ = require('lodash');`;
            const loggerWarnSpy = sandbox.stub(console, 'warn');

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([]);
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                '⚠️require is called on some global variable\n' +
                    "_ = require('lodash');",
            );
        });
    });

    describe('Object destructuring', () => {
        it('should parse require having object destructuring without alias', () => {
            const fileContent = `const {map,omit}=require('lodash');`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    target: 'lodash',
                    quoteType: "'",
                    raw: "const {map,omit}=require('lodash');",
                    imports: [
                        {
                            key: 'map',
                        },
                        {
                            key: 'omit',
                        },
                    ],
                },
            ]);
        });

        it('should parse require having object destructuring with aliases', () => {
            const fileContent = `const {map: _map,  omit: _omit }=require('lodash');`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    target: 'lodash',
                    quoteType: "'",
                    raw: "const {map: _map,  omit: _omit }=require('lodash');",
                    imports: [
                        {
                            key: 'map',
                            alias: '_map',
                        },
                        {
                            key: 'omit',
                            alias: '_omit',
                        },
                    ],
                },
            ]);
        });

        it('should parse require on a specific key using destructuring', () => {
            const fileContent = `const expect = require("sinon").expect;`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    target: 'sinon',
                    quoteType: '"',
                    raw: 'const expect = require("sinon").expect;',
                    imports: [
                        {
                            key: 'expect',
                        },
                    ],
                },
            ]);
        });

        it('should parse require on a specific key + alias using destructuring', () => {
            const fileContent = `const sinonExpect = require("sinon").expect;`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    target: 'sinon',
                    quoteType: '"',
                    raw: 'const sinonExpect = require("sinon").expect;',
                    imports: [
                        {
                            key: 'expect',
                            alias: 'sinonExpect',
                        },
                    ],
                },
            ]);
        });

        it('should avoid deep object destructuring and warn', () => {
            const fileContent = `const {map: _map,  omit: _omit }=require('lodash');`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    target: 'lodash',
                    quoteType: "'",
                    raw: "const {map: _map,  omit: _omit }=require('lodash');",
                    imports: [
                        {
                            key: 'map',
                            alias: '_map',
                        },
                        {
                            key: 'omit',
                            alias: '_omit',
                        },
                    ],
                },
            ]);
        });

        it('should avoid deep object destructuring and warn', () => {
            const fileContent = `const { fake: { rejects} } = require('sinon');`;
            const loggerWarnSpy = sandbox.stub(console, 'warn');

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([]);
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                '⚠️require has deep object destructuring on left side, you have to use a new constant\n' +
                    '{ fake: { rejects} }',
            );
        });
    });

    describe('Multiple lines', () => {
        it('should parse multiple imports', () => {
            const fileContent = `
const _ = require('lodash');
const sinon = require("sinon");

function a (){
  // some code
}
`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    hasDefault: true,
                    target: 'lodash',
                    quoteType: "'",
                    raw: "const _ = require('lodash');",
                    imports: [
                        {
                            key: '*',
                            alias: '_',
                        },
                    ],
                },
                {
                    hasDefault: true,
                    target: 'sinon',
                    quoteType: '"',
                    raw: 'const sinon = require("sinon");',
                    imports: [
                        {
                            key: '*',
                            alias: 'sinon',
                        },
                    ],
                },
            ]);
        });

        it('should parse multiline import', () => {
            const fileContent = `
const _ = require("lodash");

const {
    validateSession,
    getToken,
} = require("./authenticator");
`;

            const requirements = getRequires(fileContent);

            expect(requirements).to.deep.equal([
                {
                    hasDefault: true,
                    target: 'lodash',
                    quoteType: '"',
                    raw: 'const _ = require("lodash");',
                    imports: [
                        {
                            key: '*',
                            alias: '_',
                        },
                    ],
                },
                {
                    target: './authenticator',
                    quoteType: '"',
                    raw:
                        'const {\n    validateSession,\n    getToken,\n} = require("./authenticator");',
                    indent: '    ',
                    imports: [
                        {
                            key: 'validateSession',
                        },
                        {
                            key: 'getToken',
                        },
                    ],
                },
            ]);
        });
    });
});
