import { scanDir } from './utils/fs';

require('source-map-support').install();

import * as inquirer from 'inquirer';
import { updateFiles } from './processor/process';

async function main(): Promise<void> {
    const path = process.argv[2] || process.cwd();

    await confirmScan(path);
    const { files } = await getParams(path);
    await warnBeforeRun();

    try {
        await updateFiles(files);

        console.log(`
----------------------
Hope You won time using this script ---
Beware:
  - To review all changes
  - to check for any warnings above as this script do only weak things

To use imports with NodeJs
  - add "type":"module" inside your package.json,
  - use node --es-module-specifier-resolution=node your script
    => it's better to not include files extension if you're moving to Typescript soon :)
`);
    } catch (err) {
        console.error('root-level error - fatal');
        console.error(err);
    }
}

async function confirmScan(path: string): Promise<void | never> {
    const prompt = inquirer.createPromptModule();
    const { doScan } = await prompt([
        {
            message: `This program will scan ${path}, continue?`,
            name: 'doScan',
            type: 'confirm',
        },
    ]);

    if (!doScan) {
        process.exit();
    }
}

async function getParams(path: string): Promise<{ files: string[] } | never> {
    const prompt = inquirer.createPromptModule();
    let ignore = 'node_modules .git dist eslintrc';
    let doUpdate = false;
    let files: string[] = [];
    let refreshTree = true;
    while (!doUpdate) {
        if (refreshTree) {
            files = await scanDir(path, buildFilter(ignore));
            console.log(files.join('\n'));
            refreshTree = false;
            if (files.length === 0) {
                console.log(`No JS files in ${path}`);
            }
        }

        console.log('----------------------');
        const actions = {
            rescan: '🔍 Rescan files',
            ignore: `🚫 Update ignore pattern (currently ${ignore})`,
            process: `🚀 Process to update!`,
            exit: `❎ Exit`,
        };

        const { action } = await prompt([
            {
                message: `Action:`,
                name: 'action',
                choices: Object.values(actions),
                type: 'list',
            },
        ]);

        switch (action) {
            case actions.exit:
                process.exit();
                break;
            case actions.rescan:
                refreshTree = true;
                break;
            case actions.process:
                if (files.length) {
                    console.log(`No JS files in ${path}`);
                }
                doUpdate = true;
                break;
            case actions.ignore:
                const { ignoreInput } = await prompt([
                    {
                        message: `Ignore pattern:`,
                        name: 'ignoreInput',
                        default: ignore,
                        type: 'input',
                    },
                ]);

                ignore = ignoreInput;
                refreshTree = true;
                break;
            default:
                console.error('unhandled choice');
                console.error(action);
                process.exit();
        }
    }

    return { files };
}

async function warnBeforeRun(): Promise<void | never> {
    const prompt = inquirer.createPromptModule();
    const { doProcess } = await prompt([
        {
            message:
                '⚠️This program is going to rewrite all above files\n' +
                '      - require() => import\n' +
                '      - module.exports => export\n' +
                '⚠️Ensure this project is versioned to view the diff and revert.\n      --- ⚠ The FILES LISTED ABOVE WILL BE UPDATED --- \n\nContinue?',
            name: 'doProcess',
            type: 'confirm',
        },
    ]);

    if (!doProcess) {
        process.exit();
    }
}

function buildFilter(ignoreStr: string): string[] {
    return ignoreStr
        .split(' ')
        .filter((str) => str !== '')
        .map((dir) => `**/${dir}/**`);
}

main();
