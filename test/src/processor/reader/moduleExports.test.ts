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
                    properties: ['myFunction'],
                    raw: 'Object.assign(module.exports, {myFunction})\n',
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
                    properties: ['myFunction'],
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

class SomeClass = {};

`;

            const requirements = getExports(fileContent);

            expect(requirements).to.deep.equal({
                global: {
                    properties: ['myFunction', 'SomeClass'],
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
                    assignment: 'MyError',
                    raw: 'module.exports = MyError;\n',
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
                    properties: ['myFunction', 'SomeClass'],
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

        describe.skip('experimental direct exported assignments', () => {
            it('should parse inline instructions', () => {
                const fileContent = `
Object.assign(module.exports, { identifiedAuthenticator: buildIdentifiedAuthenticator() });
`;

                const requirements = getExports(fileContent);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                property: 'identifiedAuthenticator',
                                rawValue: 'buildIdentifiedAuthenticator()',
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
    someConstant
});
`;

                const requirements = getExports(fileContent);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                property: 'identifiedAuthenticator',
                                value: 'someConstructor()',
                            },
                        ],
                        properties: ['someConstant'],
                        raw:
                            'Object.assign(module.exports, { identifiedAuthenticator: buildIdentifiedAuthenticator() });\n',
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
    inlineObject: { ok: "..." },
    inlineArray: ["...", "..."],
    someConstant
});
`;

                const requirements = getExports(fileContent);

                expect(requirements).to.deep.equal({
                    global: {
                        assignments: [
                            {
                                property: 'call',
                                rawValue: 'someConstructor()',
                            },
                            {
                                property: 'str',
                                rawValue: '"hello"',
                            },
                            {
                                property: 'number',
                                rawValue: '42',
                            },
                            {
                                property: 'inlineObject',
                                rawValue: '{ ok: "..." }',
                            },
                            {
                                property: 'inlineObject',
                                rawValue: '["...", "..."]',
                            },
                        ],
                        properties: ['someConstant'],
                        raw:
                            'Object.assign(module.exports, { identifiedAuthenticator: buildIdentifiedAuthenticator() });\n',
                    },
                    inline: [],
                });
            });
        });

        describe('non-supported exports', () => {
            it('should not take advanced exports (experimental)', () => {
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
                    `⚠ module.exports is too complex (try "experimental" mode)

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
                    `⚠ module.exports support with declaration inside is not supported
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
                    `⚠ module.exports support with calls inside is not supported
    module.exports = {
        firebaseNative: buildFirebaseNative()
    };
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
                            'module.exports.someVariable = { total: 30,};',
                        property: 'someVariable',
                    },
                ],
            });
        });

        it('should export multiples exported variables', () => {
            const fileContent = `
// ...
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
                        rawFullLine: 'module.exports.someVariable = {',
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
