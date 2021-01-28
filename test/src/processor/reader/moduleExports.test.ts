import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { getExports } from '../../../../src/processor/reader/moduleExports';
import { rewriteExports } from '../../../../src/processor/writer/exports';

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
            const fileContent = `
Object.assign(module.exports,
    {
        myFunction
    }
);`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['myFunction'],
                    raw:
                        'Object.assign(module.exports,\n    {\n        myFunction\n    }\n);',
                },
                inline: [],
            });
        });

        it('should parse multiline module.exports with _.extend()', () => {
            const fileContent = `
_.extend(exports,
    {
        myFunction
    }
);`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    exportedProperties: ['myFunction'],
                    raw:
                        '_.extend(exports,\n    {\n        myFunction\n    }\n);',
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

        it('should remove comments from inline exported values', () => {
            const fileContent = `
module.exports = {
    aaa, // to be removed
    /* comment */
    bbb: 89,
    
    /**
     * Hello
     */
    ccc,
};

`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    assignments: [
                        {
                            key: 'bbb',
                            value: '89',
                        },
                    ],
                    exportedProperties: ['aaa', 'ccc'],
                    raw:
                        'module.exports = {\n    aaa, // to be removed\n    /* comment */\n    bbb: 89,\n    \n    /**\n     * Hello\n     */\n    ccc,\n};\n',
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
                    directAssignment:
                        'function (data) {\n    return u_xml2js.read(data).then(json => snTree(json.manifest));\n};',
                    raw:
                        'module.exports = function (data) {\n    return u_xml2js.read(data).then(json => snTree(json.manifest));\n};',
                },
                inline: [],
            });
        });

        it('should parse full module.export = class', () => {
            const fileContent =
                'module.exports = class AttemptException extends Error {};';

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    directAssignment:
                        'class AttemptException extends Error {};',
                    raw:
                        'module.exports = class AttemptException extends Error {};',
                },
                inline: [],
            });
        });

        it('should parse full module.export = arrow function', () => {
            const fileContent = `module.exports = async () => {
    // code
};`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    directAssignment: 'async () => {\n    // code\n};',
                    raw: 'module.exports = async () => {\n    // code\n};',
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

        describe('Ellipsis and object assignment', () => {
            it('should parse assigned with ... ellipsis members in Object.assign', () => {
                const fileContent = `
const lib1 = require('./lib1');
const lib2 = require('./lib2');
const someFn = require('./file');
module.exports = { ...lib1, ...lib2, someFn};

`;

                const requirements = getExports(fileContent);

                expect(requirements).to.deep.equal({
                    global: {
                        exportedKeySets: ['lib1', 'lib2'],
                        exportedProperties: ['someFn'],
                        raw: 'module.exports = { ...lib1, ...lib2, someFn};\n',
                    },
                    inline: [],
                });
            });

            it('should parse direct assigned objects in multiline Object.assign', () => {
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
                        exportedKeySets: ['config1', 'config2'],
                        exportedProperties: ['lib'],
                        raw:
                            'Object.assign(module.exports, \n   config1, \nconfig2, { lib });\n',
                    },
                    inline: [],
                });
            });

            it('should parse direct assigned objects in multiline Object.assign after {} definition', () => {
                const fileContent = `
const config1 = { /* keys */ };
const config2 = { /* keys */ };
Object.assign(module.exports, 
   config1, { lib }, config2);
function lib(){}
`;

                const requirements = getExports(fileContent);
                console.log(requirements.global)

                expect(requirements).to.deep.equal({
                    global: {
                        exportedKeySets: ['config1', 'config2'],
                        exportedProperties: ['lib'],
                        raw:
                            'Object.assign(module.exports, \n   config1, { lib }, config2);\n',
                    },
                    inline: [],
                });
            });

            it('should parse direct assigned objects members in Object.assign with no inner object', () => {
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
                        exportedKeySets: ['config1', 'config2'],
                        exportedProperties: [],
                        raw:
                            'Object.assign(module.exports, \nconfig1, \nconfig2 );\n',
                    },
                    inline: [],
                });
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
    someConstant,
    ...someKeySet,
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
                        exportedKeySets: ['someKeySet'],
                        raw:
                            'Object.assign(module.exports, {\n    identifiedAuthenticator: someConstructor(),\n    someConstant,\n    ...someKeySet,\n});\n',
                    },
                    inline: [],
                });
            });

            it('should parse hybrid inline instructions having an ellipsis', () => {
                const fileContent = `
Object.assign(module.exports,
    lib,
    questions, {
        name: "value",
        exportedConstant,
    }   
);
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'name',
                                value: '"value"',
                            },
                        ],
                        exportedKeySets: ['lib', 'questions'],
                        exportedProperties: ['exportedConstant'],
                        raw:
                            'Object.assign(module.exports,\n    lib,\n    questions, {\n        name: "value",\n        exportedConstant,\n    }   \n);\n',
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
                            'Object.assign(module.exports, {\n    call: someConstructor(),\n    str: "hello",\n    number: 42,\n    myFn,\n    inlineArray: ["...", "..."],\n    someConstant\n});\n',
                    },
                    inline: [],
                });
            });

            it('should parse direct = object', () => {
                const fileContent = `
module.exports = {
    getA: async req => _db.aaa.find(await getter(req), ["name", "skills"]),
    getB: async req => _db.bbb.find(await getter(req), ["name", "skills"]),
    someMethod
};
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'getA',
                                value:
                                    'async req => _db.aaa.find(await getter(req), ["name", "skills"])',
                            },
                            {
                                key: 'getB',
                                value:
                                    'async req => _db.bbb.find(await getter(req), ["name", "skills"])',
                            },
                        ],
                        exportedProperties: ['someMethod'],
                        raw:
                            'module.exports = {\n    getA: async req => _db.aaa.find(await getter(req), ["name", "skills"]),\n    getB: async req => _db.bbb.find(await getter(req), ["name", "skills"]),\n    someMethod\n};\n',
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
                            'Object.assign(module.exports, {\n    call: someConstructor(), // Comment\n    str: "hello",//Comment\n    number: 42,  // Comment\n    myFn,        // Comment\n    inlineArray: ["...", "..."],  // Comment\n    someConstant // Comment\n});\n',
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
    },

}
);
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
                            'Object.assign(module.exports, {\n    singleLine: buildFirebaseAdapter({ firebaseNative }),\n\n    multilineFn: async function (){\n        // some code,\n        return {\n            someKey: "value",\n            global\n        }\n    },\n\n}\n);\n',
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

            it('should parse functions inline and multiline comments', () => {
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

    /**
         * weird indent
         */
    value: 55,
});
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                comment: '// This comment is important',
                                key: 'test1',
                                value: 'async function test1(\n    ...\n}',
                            },
                            {
                                comment:
                                    '/**\n * This is ESDoc\n * @params {function} callback\n * @return something\n */',
                                key: 'send',
                                value:
                                    'µ.test2(async function (opts) {\n    ...\n})',
                            },
                            {
                                comment: '/**\n     * weird indent\n     */',
                                key: 'value',
                                value: '55',
                            },
                        ],
                        exportedProperties: [],
                        raw:
                            'Object.assign(module.exports, { \n    // This comment is important\n    async function test1 (\n        ...\n    },\n\n    /**\n     * This is ESDoc\n     * @params {function} callback\n     * @return something\n     */\n    send: µ.test2(async function (opts) {\n        ...\n    }),\n\n    /**\n         * weird indent\n         */\n    value: 55,\n});\n',
                    },
                    inline: [],
                });
            });

            it('should parse multiline array definition', () => {
                const fileContent = `
Object.assign(module.exports, { 
    definitions: µ.containsTester([
        "aa",
        "bb",
    ]),

    tool: function (lang) {
        return lang;
    },
});
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'definitions',
                                value:
                                    'µ.containsTester([\n    "aa",\n    "bb",\n])',
                            },
                            {
                                key: 'tool',
                                value: 'function (lang) {\n    return lang;\n}',
                            },
                        ],
                        exportedProperties: [],
                        raw:
                            'Object.assign(module.exports, { \n    definitions: µ.containsTester([\n        "aa",\n        "bb",\n    ]),\n\n    tool: function (lang) {\n        return lang;\n    },\n});\n',
                    },
                    inline: [],
                });
            });

            it('should warn when there are "this.relative" uses', () => {
                const loggerWarnSpy = sandbox.stub(console, 'warn');
                const fileContent = `
Object.assign(module.exports, {
    rand: () => return Math.random(), 
    func: function (lang) {
        return this.rand() * 10;
    },
});
`;

                const requirements = getExports(fileContent, true);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                key: 'rand',
                                value: '() => return Math.random()',
                            },
                            {
                                key: 'func',
                                value:
                                    'function (lang) {\n    return this.rand() * 10;\n}',
                            },
                        ],
                        exportedProperties: [],
                        raw:
                            'Object.assign(module.exports, {\n    rand: () => return Math.random(), \n    func: function (lang) {\n        return this.rand() * 10;\n    },\n});\n',
                    },
                    inline: [],
                });

                expect(loggerWarnSpy).to.be.calledOnceWithExactly(
                    `👀 beware of "this." usage in export "func"
function (lang) {
    return this.rand() * 10;
},`,
                );
            });
        });

        describe('non-supported exports', () => {
            it('should not take advanced exports when experimental mode is disabled', () => {
                const loggerWarnSpy = sandbox.stub(console, 'warn');
                const fileContent = `
Object.assign(module.exports, {
    uExternalFields: [
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

    uExternalFields: [
        "categories",
        "description",
    ]
`,
                );
            });

            it('should avoid global module.exports having function declared inside', () => {
                const loggerWarnSpy = sandbox.stub(console, 'warn');
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
                const loggerWarnSpy = sandbox.stub(console, 'warn');
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
`;

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
