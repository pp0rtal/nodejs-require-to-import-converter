import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { getExports } from '../../../../src/processor/reader/moduleExports';

chai.use(sinonChai);
const expect = chai.expect;

describe('reader processor - module.exports', () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => {
        sandbox.restore();
    });

    describe('export full assignment', () => {
        it('should parse inline module.exports with Object.assign()', () => {
            const fileContent =
                '\n\n\nObject.assign(module.exports, {myFunction})\n\n\n';

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['myFunction'],
                    raw: 'Object.assign(module.exports, {myFunction})\n',
                },
                inline: [],
            });
        });

        it('should parse multiline module.exports with Object.assign()', () => {
            const fileContent =
                `
Object.assign(module.exports,
    {
        myFunction
    }
);`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['myFunction'],
                    raw: 'Object.assign(module.exports,\n    {\n        myFunction\n    }\n);',
                },
                inline: [],
            });
        });

        it('should parse multiline module.exports with _.extend()', () => {
            const fileContent =
                `
_.extend(exports,
    {
        myFunction
    }
);`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['myFunction'],
                    raw: '_.extend(exports,\n    {\n        myFunction\n    }\n);',
                },
                inline: [],
            });
        });

        it('should parse inline module.exports with a function call', () => {
            const fileContent =
                '\n\n\nObject.assign(module.exports, {myFunction})\n\n\n';

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['myFunction'],
                    raw: 'Object.assign(module.exports, {myFunction})\n',
                },
                inline: [],
            });
        });

        it('should parse full module.export = { ... } with direct exports', () => {
            const fileContent = `
const { insertLearningNeed } = require("../lib");

module.exports = {
    myFunction,
    SomeClass,
};

async function myFunction(req) {
    return {
        someCode: "value",
    });
}

class SomeClass  = {};

`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['myFunction', 'SomeClass'],
                    raw:
                        'module.exports = {\n    myFunction,\n    SomeClass,\n};\n',
                },
                inline: [],
            });
        });

        it('should parse full module.export = variable', () => {
            const fileContent = `
class MyError extends Error {}

module.exports = MyError;
`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    directAssignment: 'MyError',
                    raw: 'module.exports = MyError;\n',
                },
                inline: [],
            });
        });

        it('should parse full module.export = multiline assignment', () => {
            const fileContent = `
module.exports = function (data) {
    return u_xml2js.read(data).then(json => snTree(json.manifest));
};
`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    directAssignment: 'function (data) {\n    return u_xml2js.read(data).then(json => snTree(json.manifest));\n};',
                    raw: 'module.exports = function (data) {\n    return u_xml2js.read(data).then(json => snTree(json.manifest));\n};',
                },
                inline: [],
            });
        });

        it('should parse full module.export with Object.assign()', () => {
            const fileContent = `
Object.assign(module.exports, {
    myFunction,
    SomeClass,
});
`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['myFunction', 'SomeClass'],
                    raw:
                        'Object.assign(module.exports, {\n    myFunction,\n    SomeClass,\n});\n',
                },
                inline: [],
            });
        });

        it('should parse ellipsis members in Object.assign', () => {
            const fileContent = `
const config1 = { /* keys */ };
const config2 = { /* keys */ };
Object.assign(module.exports, 
   config1, 
config2, { lib });
function lib(){}
`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['config1', 'config2', 'lib'],
                    raw: 'Object.assign(module.exports, \n   config1, \nconfig2, { lib });\n',
                },
                inline: [],
            });
        });

        it('should parse ellipsis members in Object.assign with no inner object', () => {
            const fileContent = `
const config1 = { /* keys */ };
const config2 = { /* keys */ };
Object.assign(module.exports, 
config1, 
config2 );
`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['config1', 'config2'],
                    raw: 'Object.assign(module.exports, \nconfig1, \nconfig2 );\n',
                },
                inline: [],
            });
        });

        it('should not take experimental export and warn', () => {
            const fileContent = `
// Object.assign(module.exports, { ...lib1, ...lib2 });
// module.exports = { ...lib1, ...lib2 };
`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {},
                inline: [],
            });
        });

        describe('experimental direct exported definitions', () => {
            it('should parse inline instructions', () => {
                const fileContent = `
Object.assign(module.exports, { identifiedAuthenticator: buildIdentifiedAuthenticator() });
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'identifiedAuthenticator',
                                value: 'buildIdentifiedAuthenticator()',
                            },
                        ],
                        exportedProperties: [],
                        raw:
                            'Object.assign(module.exports, { identifiedAuthenticator: buildIdentifiedAuthenticator() });\n',
                    },
                    inline: [],
                });
            });

            it('should parse hybrid inline instructions + keys', () => {
                const fileContent = `
Object.assign(module.exports, {
    identifiedAuthenticator: someConstructor(),
    someConstant
});
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'identifiedAuthenticator',
                                value: 'someConstructor()',
                            },
                        ],
                        exportedProperties: ['someConstant'],
                        raw:
                            'Object.assign(module.exports, {\n    identifiedAuthenticator: someConstructor(),\n    someConstant\n});\n',
                    },
                    inline: [],
                });
            });

            it('should parse hybrid inline instructions + keys with inline comments', () => {
                const fileContent = `
Object.assign(module.exports, {
    identifiedAuthenticator: someConstructor(), // Some comment 
    someConstant                                // comment
});
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'identifiedAuthenticator',
                                value: 'someConstructor()',
                            },
                        ],
                        exportedProperties: ['someConstant'],
                        raw:
                            'Object.assign(module.exports, {\n    identifiedAuthenticator: someConstructor(), // Some comment \n    someConstant                                // comment\n});\n',
                    },
                    inline: [],
                });
            });

            it('should parse various key declaration', () => {
                const fileContent = `
Object.assign(module.exports, {
    call: someConstructor(),
    str: "hello",
    number: 42,
    myFn,
    inlineArray: ["...", "..."],
    someConstant
});
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            { key: 'call', value: 'someConstructor()' },
                            { key: 'str', value: '"hello"' },
                            { key: 'number', value: '42' },
                            { key: 'inlineArray', value: '["...", "..."]' },
                        ],
                        exportedProperties: ['myFn', 'someConstant'],
                        raw:
                            'Object.assign(module.exports, {\n    call: someConstructor(),\n    str: \"hello\",\n    number: 42,\n    myFn,\n    inlineArray: [\"...\", \"...\"],\n    someConstant\n});\n',
                    },
                    inline: [],
                });
            });

            it('should parse various key declaration with inline comments', () => {
                const fileContent = `
Object.assign(module.exports, {
    call: someConstructor(), // Comment
    str: "hello",//Comment
    number: 42,  // Comment
    myFn,        // Comment
    inlineArray: ["...", "..."],  // Comment
    someConstant // Comment
});
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            { key: 'call', value: 'someConstructor()' },
                            { key: 'str', value: '"hello"' },
                            { key: 'number', value: '42' },
                            { key: 'inlineArray', value: '["...", "..."]' },
                        ],
                        exportedProperties: ['myFn', 'someConstant'],
                        raw:
                            'Object.assign(module.exports, {\n    call: someConstructor(), // Comment\n    str: \"hello\",//Comment\n    number: 42,  // Comment\n    myFn,        // Comment\n    inlineArray: [\"...\", \"...\"],  // Comment\n    someConstant // Comment\n});\n',
                    },
                    inline: [],
                });
            });

            it('should parse multilines object/arrays declarations following tab size', () => {
                const fileContent = `
Object.assign(module.exports, {
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

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'singleLine',
                                value:
                                    'buildFirebaseAdapter({ firebaseNative })',
                            },
                            {
                                key: 'multilineFn',
                                value:
                                    'async function (){\n    // some code,\n    return {\n        someKey: "value",\n        global\n    }\n}',
                            },
                        ],
                        exportedProperties: [],
                        raw:
                            'Object.assign(module.exports, {\n    singleLine: buildFirebaseAdapter({ firebaseNative }),\n    multilineFn: async function (){\n        // some code,\n        return {\n            someKey: \"value\",\n            global\n        }\n    }\n});\n',
                    },
                    inline: [],
                });
            });

            it('should parse multilines function without alias', () => {
                const fileContent = `
Object.assign(module.exports, {
    myInlineFunc () { return true },
    async myMultilineFunc(file) {
       // code
    }
});
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'myInlineFunc',
                                value:
                                    'function myInlineFunc() { return true }',
                            },
                            {
                                key: 'myMultilineFunc',
                                value:
                                    'async function myMultilineFunc(file) {\n   // code\n}',
                            },
                        ],
                        exportedProperties: [],
                        raw:
                            'Object.assign(module.exports, {\n    myInlineFunc () { return true },\n    async myMultilineFunc(file) {\n       // code\n    }\n});\n',
                    },
                    inline: [],
                });
            });
        });

        describe('non-supported exports', () => {
            it('should not take advanced exports when experimental mode is disabled', () => {
                const loggerWarnSpy = sandbox.spy(console, 'warn');
                const fileContent = `
Object.assign(module.exports, {
    udemyExternalFields: [
        "categories",
        "description",
    ]
});
`;

                const requirements = getExports(fileContent);

                expect(requirements).to.deep.equal({
                    global: {},
                    inline: [],
                });
                expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                    `⚠ module.exports contains direct declarations (try "experimental" mode)

    udemyExternalFields: [
        "categories",
        "description",
    ]
`,
                );
            });

            it('should avoid global module.exports having function declared inside', () => {
                const loggerWarnSpy = sandbox.spy(console, 'warn');
                const fileContent = `
module.exports = {
    myFunction: function(){
        // This function should be moved at root scope
        // We will let the developer handle it
    },
    SomeClass,
};
`;

                const requirements = getExports(fileContent);

                expect(requirements).to.deep.equal({
                    global: {},
                    inline: [],
                });
                expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                    `⚠ module.exports support with declaration inside is skipped (try "experimental" mode)
module.exports = {
    myFunction: function(){
        // This function should be moved at root scope
        // We will let the developer handle it
    }`,
                );
            });

            it('should avoid global module.exports having function declared inside', () => {
                const loggerWarnSpy = sandbox.spy(console, 'warn');
                const fileContent = `
    module.exports = {
        firebaseNative: buildFirebaseNative()
    };
`;

                const requirements = getExports(fileContent);

                expect(requirements).to.deep.equal({
                    global: {},
                    inline: [],
                });

                expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                    `⚠ module.exports contains direct declarations (try "experimental" mode)

        firebaseNative: buildFirebaseNative()
    `,
                );
            });
        });
    });

    describe('export partial assignment', () => {
        it('should export an exported variables', () => {
            const fileContent = `// ...
module.exports.someVariable = { total: 30,};
console.log("Some use of " + module.exports.someVariable.total);`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {},
                inline: [
                    {
                        raw: 'module.exports.someVariable = ',
                        rawFullLine:
                            '\nmodule.exports.someVariable = { total: 30,};',
                        property: 'someVariable',
                    },
                ],
            });
        });

        it('should export multiples exported variables', () => {
            const fileContent = `
module.exports.someVariable = {
    total: 30,
};
module.exports.CONSTANT="Hello";
exports.OTHER_CONSTANT="test";

console.log("Some use of " + module.exports.someVariable.total);
`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {},
                inline: [
                    {
                        raw: 'module.exports.someVariable = ',
                        rawFullLine: '\nmodule.exports.someVariable = {',
                        property: 'someVariable',
                    },
                    {
                        raw: 'module.exports.CONSTANT=',
                        rawFullLine: 'module.exports.CONSTANT="Hello";',
                        property: 'CONSTANT',
                    },
                    {
                        raw: 'exports.OTHER_CONSTANT=',
                        rawFullLine: 'exports.OTHER_CONSTANT="test";',
                        property: 'OTHER_CONSTANT',
                    },
                ],
            });
        });
    });
});
