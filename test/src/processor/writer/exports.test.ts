import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { rewriteExports } from '../../../../src/processor/writer/exports';
import { getExports } from '../../../../src/processor/reader/moduleExports';
import { getRequires } from '../../../../src/processor/reader/requires';
import { rewriteImports } from '../../../../src/processor/writer/imports';

chai.use(sinonChai);
const expect = chai.expect;

describe('writer processor - exports', () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => {
        sandbox.restore();
    });

    describe("inline exports' - constants", () => {
        it('should rewrite inline export assignment on declared functions and variables', () => {
            const fileContent = `
const MY_CONST = 42;

class MyClass(){}
class MyError extend Error(){}
function myFunction(){}
async function myAsyncFunction(){}
const myArrowFunction = async (context) => {};

module.exports = {
    myAsyncFunction,
    myArrowFunction,
    MyClass,
    MyError,
    myFunction,
    MY_CONST,
};
`;
            const exports = getExports(fileContent);
            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const MY_CONST = 42;

export class MyClass(){}
export class MyError extend Error(){}
export function myFunction(){}
export async function myAsyncFunction(){}
export const myArrowFunction = async (context) => {};
`);
        });

        it('should replace successfully exported properties with a same prefixed name', () => {
            const fileContent = `
module.exports.port_http = sessionConfig.port_http;
module.exports.port_https = sessionConfig.port_https;
`;
            const exports = getExports(fileContent);
            const requirements = getRequires(fileContent);

            let fileUpdate = rewriteImports(fileContent, requirements);
            fileUpdate = rewriteExports(fileUpdate, exports);

            expect(fileUpdate).to.deep.equal(`
export const port_http = sessionConfig.port_http;
export const port_https = sessionConfig.port_https;
`);
        });

        it('should rewrite basic exported number constant) with module.exports', () => {
            const fileContent = 'module.exports.some_variable = 56';
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal('export const some_variable = 56');
        });

        it('should rewrite basic exported number constant) with exports', () => {
            const fileContent = 'exports.some_variable = 56';
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal('export const some_variable = 56');
        });

        it('should rewrite multiline exported constant (string)', () => {
            const fileContent = `
module.exports.some_variable = 'test'
module.exports.differentQuotes = "hello";
module.exports.template = \`
  multiline
\`;
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const some_variable = 'test'
export const differentQuotes = "hello";
export const template = \`
  multiline
\`;
`);
        });

        it('should rewrite exported object', () => {
            const fileContent = `
module.exports.some_variable = [\n78];
exports.CONSTANT = {
   value: 56,
   second: 'a'
}
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const some_variable = [\n78];
export const CONSTANT = {
   value: 56,
   second: 'a'
}
`);
        });

        it('should not export a named constant already defined', () => {
            const fileContent = `
function(){
    const router = "dont_export";
}

const router = Router();

exports.router = router;

`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
function(){
    const router = "dont_export";
}

export const router = Router();


`);
        });

        it('should export a non initialized constant', () => {
            const fileContent = `
let router;
exports.router = router;
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export let router;
`);
        });

        it('should rewrite exported constant and usages', () => {
            const fileContent = `
module.exports.CONSTANT = "...";
module.exports.myFunction = function () => {}

function(){
  // anything with module.exports.CONSTANT
  module.exports.myFunction(module.exports.CONSTANT);
}
`;
            const exports = getExports(fileContent);
            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const CONSTANT = "...";
export function myFunction () => {}

function(){
  // anything with CONSTANT
  myFunction(CONSTANT);
}
`);
        });

        it('should rewrite exported constant in the Object.assign() ellipsis', () => {
            const fileContent = `
const config1 = { /* keys */ };
const config2 = { /* keys */ };
Object.assign(module.exports, 
config1, 
config2, { lib });
function lib(){}
`;
            const exports = getExports(fileContent);
            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const config1 = { /* keys */ };
export const config2 = { /* keys */ };

export function lib(){}
`);
        });

        it('should not declare a constant with a redundant name', () => {
            const fileContent = `
const get = async (req) => {};
_.extend(module.exports, {
    get: get,
});
`;
            const exports = getExports(fileContent);
            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const get = async (req) => {};
`);
        });
    });

    describe('inline exports - functions', () => {
        it('should rewrite unnamed arrow with const', () => {
            const fileContent = `
module.exports.myArrow = () => {};
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const myArrow = () => {};
`);
        });

        it('should exported named function', () => {
            const fileContent = `
module.exports.myFunction = function () => {};
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export function myFunction () => {}
`);
        });

        it('should rewrite named async function', () => {
            const fileContent = `
module.exports.myAsyncFunction = async function() => {}
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export async function myAsyncFunction() => {}
`);
        });

        it('should rewrite named arrow function', () => {
            const fileContent = `
exports.XXXX = async (user, clearPw) => {};
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export async XXXX (user, clearPw) => {}
`);
        });

        it('should use const for wrapped functions', () => {
            const fileContent = `
module.exports.isAuthorOfObjOrAdmin = µ.cm(async function (req) {});
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const isAuthorOfObjOrAdmin = µ.cm(async function (req) {});
`);
        });

        it('should use const for wrapped arrow functions', () => {
            const fileContent = `
module.exports.isAuthorOfObjOrAdmin = µ.cm((req) => {});
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const isAuthorOfObjOrAdmin = µ.cm((req) => {});
`);
        });
    });

    describe('Import / export', () => {
        it('should rewrite exported assignments on imported libs', () => {
            const fileContent = `
const { someMethod } = require("./myLib1");
const { someConstant } = require("./myLib2");
const { a, b } =require("./myLib3");
module.exports = { someMethod, someConstant, a,b};
`;
            const exports = getExports(fileContent);
            const requirements = getRequires(fileContent);

            let fileUpdate = rewriteImports(fileContent, requirements);
            fileUpdate = rewriteExports(fileUpdate, exports);

            expect(fileUpdate).to.deep.equal(`
export { someMethod } from "./myLib1";
export { someConstant } from "./myLib2";
export { a, b } from "./myLib3";
`);
        });

        it('should rewrite export assignments on multiple lines', () => {
            const fileContent = `
const _ = require("lodash");
const {
    someMethod, 
    someConstant,
    a,
} = require("./myLib1");
const $ = require("jquery");
module.exports = { someMethod, someConstant, a};
`;
            const exports = getExports(fileContent);
            const requirements = getRequires(fileContent);

            let fileUpdate = rewriteImports(fileContent, requirements);
            fileUpdate = rewriteExports(fileUpdate, exports);

            expect(fileUpdate).to.deep.equal(`
import * as _ from "lodash";
export {
    someMethod,
    someConstant,
    a,
} from "./myLib1";
import * as $ from "jquery";
`);
        });

        it('should rewrite export ellipsis of imported libs', () => {
            const fileContent = `
const lib1 = require("./lib1");
module.exports = { ...lib1};
`;
            const exports = getExports(fileContent);
            const requirements = getRequires(fileContent);

            let fileUpdate = rewriteImports(fileContent, requirements);
            fileUpdate = rewriteExports(fileUpdate, exports);

            expect(fileUpdate).to.deep.equal(`
export * from "./lib1";
`);
        });

        it('should not recreate const for a same named import', () => {
            const fileContent = `
const dbLogger = require('./logger');
Object.assign(module.exports, { dbLogger: dbLogger, });
`;
            const exports = getExports(fileContent);
            const requirements = getRequires(fileContent);

            let fileUpdate = rewriteImports(fileContent, requirements);
            fileUpdate = rewriteExports(fileUpdate, exports);

            expect(fileUpdate).to.deep.equal(`
export * as dbLogger from './logger';
`);
        });

        it('should rewrite exported objects and some other keys', () => {
            const fileContent = `
const lib = require("./lib.js");
const { jumanji } = require("./file1");
const { prop1, prop2 } = require("./file2");

Object.assign(module.exports, lib, {
    prop1,
    prop2,
    jumanji
});

`;
            const exports = getExports(fileContent);
            const requirements = getRequires(fileContent);

            let fileUpdate = rewriteImports(fileContent, requirements);
            fileUpdate = rewriteExports(fileUpdate, exports);

            expect(fileUpdate).to.deep.equal(`
export * from "./lib";
export { jumanji } from "./file1";
export { prop1, prop2 } from "./file2";
`);
        });

        it('should rewrite direct export all keys of a file', () => {
            const fileContent = `
const integrationsInterface = require("./integrationsInterface");
Object.assign(module.exports, integrationsInterface);
`;
            const exports = getExports(fileContent);
            const requirements = getRequires(fileContent);

            let fileUpdate = rewriteImports(fileContent, requirements);
            fileUpdate = rewriteExports(fileUpdate, exports);

            expect(fileUpdate).to.deep.equal(`
export * from "./integrationsInterface";
`);
        });

        it('should export imported property assigned to a constant and warn', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
const { assertTrue } = require("./assertTrue");
const lib = require("./lib");
module.exports.assertFalse = !assertTrue;
module.exports.assertTrue = assertTrue;
`;
            const exports = getExports(fileContent);
            const requirements = getRequires(fileContent);

            let fileUpdate = rewriteImports(fileContent, requirements);
            fileUpdate = rewriteExports(fileUpdate, exports);

            expect(fileUpdate).to.deep.equal(`
import { assertTrue } from "./assertTrue";
import * as lib from "./lib";
export { assertTrue } from "./assertTrue";
export const assertFalse = !assertTrue;
`);
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                `👀 ️a property is used and exported, you should manually check
export { assertTrue } from "./assertTrue";`,
            );
        });
    });

    describe('default export', () => {
        it('should rewrite export direct assignment on a detached single function', () => {
            const fileContent = `
function myMethod () {}

module.exports = myMethod;
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export default function myMethod () {}
`);
        });

        it('should rewrite export direct assignment on a full function definition', () => {
            const fileContent = `
module.exports = async () => {
    const sessions = await _db.programSessions.find({ sharingInfo: $ex });
});
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export default async () => {
    const sessions = await _db.programSessions.find({ sharingInfo: $ex });
});
`);
        });

        it('should rewrite export direct assignment on a single line definition', () => {
            const fileContent =
                'module.exports = class AttemptException extends Error {};';
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                'export default class AttemptException extends Error {};',
            );
        });

        it('should rewrite direct multiline export', () => {
            const fileContent = `
module.exports = function (data) {
    return u_xml2js.read(data).then(json => snTree(json.manifest));
};
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export default function (data) {
    return u_xml2js.read(data).then(json => snTree(json.manifest));
};
`);
        });
    });

    describe('multiline exports', () => {
        it('should rewrite direct function call', () => {
            const fileContent = `Object.assign(module.exports, { identifiedAuthenticator: buildIdentifiedAuthenticator() });`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `export const identifiedAuthenticator = buildIdentifiedAuthenticator();\n`,
            );
        });

        it('should replace module.exports.variable usage', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
const value = 45;
log(module.exports.value)
Object.assign(module.exports, { value });`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
export const value = 45;
log(value)
`,
            );
            expect(loggerWarnSpy).to.not.be.called;
        });

        it('should replace module.exports.variable usage and warn if the usage is before the definition', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
setTimeout(() => log(module.exports.value), 50);
const value = 45;
Object.assign(module.exports, { value });`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
setTimeout(() => log(value), 50);
export const value = 45;
`,
            );
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                `⚠️an exported constant is used before its definition: "value"`,
            );
        });

        it.skip('should export named function', () => {
            const fileContent = `
const get = async (req) => {};
_.extend(module.exports, { get: get });
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
export async get (req) => {};
`,
            );
        });

        it('should export constants with an alias', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
const someConstant = {};
module.exports = { 
    alias: someConstant,
};
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
const someConstant = {};

export const alias = someConstant;
`,
            );
            expect(loggerWarnSpy).to.not.be.called;
        });

        it('should export constants and direct exports', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
import { someFn1, someFn2 } from './package'

const someConstant = 56;

Object.assign(module.exports, { 
    identifiedAuthenticator: someConstructor(),
    someConstant,
    someAlias: someConstant,
    someFn1,
    someFn2,
});
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
export { someFn1, someFn2 } from './package'

export const someConstant = 56;

export const identifiedAuthenticator = someConstructor();

export const someAlias = someConstant;
`,
            );
            expect(loggerWarnSpy).to.not.be.called;
        });

        it('should export constants and direct multiline exports', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
import {
    someFn1,
    someFn2
} from './package'

Object.assign(module.exports, { 
    someFn1,
    someFn2,
});
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
export {
    someFn1,
    someFn2
} from './package'
`,
            );
            expect(loggerWarnSpy).to.not.be.called;
        });

        it('should export constants and re import used ones', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
import {
    usedAndExportedMethod
} from './package';

usedAndExportedMethod();

Object.assign(module.exports, { usedAndExportedMethod });
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
import {
    usedAndExportedMethod
} from './package';
export {
    usedAndExportedMethod
} from './package';

usedAndExportedMethod();
`,
            );
            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                `👀 ️a property is used and exported, you should manually check
export {
    usedAndExportedMethod
} from './package';`,
            );
        });

        it('should export declared constant', () => {
            const fileContent = `
const someMethod = async (course) => {
    const myArrow = _.every(medias, m => _canMediaBeOffline(m));
};
const myArrow = async (course) => {};
Object.assign(module.exports, { myArrow });
`;
            const exports = getExports(fileContent);
            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
const someMethod = async (course) => {
    const myArrow = _.every(medias, m => _canMediaBeOffline(m));
};
export const myArrow = async (course) => {};
`);
        });

        it('should not export constant if import is not called', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
import {
    usedAndExportedMethod
} from './usedAndExportedMethod'

Object.assign(module.exports, { usedAndExportedMethod });
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
export {
    usedAndExportedMethod
} from './usedAndExportedMethod'
`,
            );
            expect(loggerWarnSpy).to.not.be.called;
        });

        it('should warn if direct export is not found', () => {
            const loggerWarnSpy = sandbox.stub(console, 'warn');
            const fileContent = `
import { someLibs } from './package'
module.exports = { someLibs, someMissingLib };
`;

            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
export { someLibs } from './package'
`,
            );

            expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                `👀 ️cannot find and export declaration of property "someMissingLib"`,
            );
        });

        it('should export various direct definition', () => {
            const fileContent = `
Object.assign(module.exports, { 
    call: someConstructor(),
    str: "hello",
    number: 42,
    inlineArray: ["...", "..."],
    singleLine: buildFirebaseAdapter({ firebaseNative }),
    multilineFn: async function (){ 
        // some code,
        return {
            someKey: "value",
            global
        }
    }
});
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `export const call = someConstructor();

export const str = "hello";

export const number = 42;

export const inlineArray = ["...", "..."];

export const singleLine = buildFirebaseAdapter({ firebaseNative });

export async function multilineFn(){
    // some code,
    return {
        someKey: "value",
        global
    }
}
`,
            );
        });

        it('should export function definition with comments', () => {
            const fileContent = `
// Inline comment method1
exports.method1 = async function () {
    // code
};

/**
 * Multiline comment 2
 */
exports.method2 = async function () {
    // code
};
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `
// Inline comment method1
export async function method1 () {
    // code
};

/**
 * Multiline comment 2
 */
export async function method2 () {
    // code
};
`,
            );
        });

        it('should export direct named functions', () => {
            const fileContent = `
Object.assign(module.exports, { 
    singleLine({ param }){ /* code */ },
    async function multilineFn (){ 
    },
    async multilineFn2 (){ 
    },
    errorHandler: function (err, req, res, next) {
        // Code
    },
    multilineFn3 (){ 
    }
});
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `export function singleLine({ param }){ /* code */ }

export async function multilineFn(){ 
}

export async function multilineFn2(){ 
}

export function errorHandler(err, req, res, next) {
    // Code
}

export function multilineFn3(){ 
}
`,
            );
        });

        it('should export functions containing function callback', () => {
            const fileContent = `
Object.assign(module.exports, { 
    async function test1 (function(){ 
        // Inside callback
    }) {
        // In test1
    },

    send: µ.test2(async function (opts) {
        // Inside callback
    }),
});
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `export async function test1(function(){ 
    // Inside callback
}) {
    // In test1
}

export const send = µ.test2(async function (opts) {
    // Inside callback
});
`,
            );
        });

        it('should rewrite functions inline and multiline comments', () => {
            const fileContent = `
Object.assign(module.exports, { 
    // This comment is important
    async function test1 (
        ...
    },

    /**
     * This is ESDoc
     * @params {function} callback
     * @return something
     */
    send: µ.test2(async function (opts) {
        ...
    }),
});
`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `// This comment is important
export async function test1(
    ...
}

/**
 * This is ESDoc
 * @params {function} callback
 * @return something
 */
export const send = µ.test2(async function (opts) {
    ...
});
`,
            );
        });
    });
});
