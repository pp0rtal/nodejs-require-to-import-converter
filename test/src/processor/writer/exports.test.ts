import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { rewriteExports } from '../../../../src/processor/writer/exports';
import { getExports } from '../../../../src/processor/reader/moduleExports';
import { getRequires } from '../../../../src/processor/reader/requires';
import { rewriteImports } from '../../../../src/processor/writer/imports';

// TODO test assignment
// TODO test assignemnts

chai.use(sinonChai);
const expect = chai.expect;

describe('writer processor - exports', () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => {
        sandbox.restore();
    });

    describe('global exports', () => {
        it('should rewrite export assignment on declared functions and variables', () => {
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
    });

    it('should rewrite export assignments on imported libs', () => {
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
const {
    someMethod, 
    someConstant,
    a,
} = require("./myLib1");
module.exports = { someMethod, someConstant, a};
`;
        const exports = getExports(fileContent);
        const requirements = getRequires(fileContent);

        let fileUpdate = rewriteImports(fileContent, requirements);
        fileUpdate = rewriteExports(fileUpdate, exports);

        expect(fileUpdate).to.deep.equal(`
export {
    someMethod,
    someConstant,
    a,
} from "./myLib1";
`);
    });

    it('should rewrite export ellipsis of imported libs', () => {
        const fileContent = `
const lib1 = require("./lib1");
const { fn } = require('./lib2')
module.exports = { ...lib1, fn};
`;
        const exports = getExports(fileContent);
        const requirements = getRequires(fileContent);

        let fileUpdate = rewriteImports(fileContent, requirements);
        fileUpdate = rewriteExports(fileUpdate, exports);

        expect(fileUpdate).to.deep.equal(`
export * from "./lib1";
export { fn } from './lib2';
`);
    });

    it('should rewrite export assignments on a single function', () => {
        const fileContent = `
function myMethod () {}
module.exports = myMethod;
`;
        const exports = getExports(fileContent);

        const fileUpdate = rewriteExports(fileContent, exports);

        expect(fileUpdate).to.deep.equal(`
export function myMethod () {}
`);
    });

    describe('inline exports', () => {
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

        it('should rewrite exported function', () => {
            const fileContent = `
module.exports.myArrow = () => {
};
module.exports.myFunction = function () => {};
module.exports.myAsyncFunction = async function() => {
}
`;
            const exports = getExports(fileContent);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(`
export const myArrow = () => {
};
export function myFunction () => {};
export async function myAsyncFunction() => {
}
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
    });

    describe('multiline exports (experimental)', () => {
        it('should rewrite direct function call', () => {
            const fileContent = `Object.assign(module.exports, { identifiedAuthenticator: buildIdentifiedAuthenticator() });`;
            const exports = getExports(fileContent, true);

            const fileUpdate = rewriteExports(fileContent, exports);

            expect(fileUpdate).to.deep.equal(
                `\nexport const identifiedAuthenticator = buildIdentifiedAuthenticator();\n`,
            );
        });

        it('should export constants and direct exports', () => {
            const loggerWarnSpy = sandbox.spy(console, 'warn');
            const fileContent = `
import { someFn1, someFn2 } from './package'

const someConstant = 56;
Object.assign(module.exports, { 
    identifiedAuthenticator: someConstructor(),
    someConstant,
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
`,
            );
            expect(loggerWarnSpy).to.not.be.called;
        });

        it('should warn if direct export is not found', () => {
            const loggerWarnSpy = sandbox.spy(console, 'warn');
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
                `⚠️cannot find and export declaration of property "someMissingLib"`,
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
                `

export const call = someConstructor();

export const str = "hello";

export const number = 42;

export const inlineArray = ["...", "..."];

export const singleLine = buildFirebaseAdapter({ firebaseNative });

export const multilineFn = async function (){
    // some code,
    return {
        someKey: "value",
        global
    }
};
`,
            );
        });
    });
});
