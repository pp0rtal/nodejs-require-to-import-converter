# NodeJS `require` to `import` converter 

## Assist you in require() to import usage
This is a dumb project... which could make you win a lot of time ⏳
You are in the situation where:
 - You've got a **legacy NodeJS** project in Javascript
   - [ ] tons of `module.exports` 🕸,
   - [ ] with tons of `require()` 🕸

 - You want to improve by:
   - switching to Typescript with allowJs ✨ (or by switching to Ts at once!)
   - taking benefit of ES `import` interdependency fix unlike CommonJS

This script will (try to) handle all basic replacements to make a big change at once 🚀

## About Dynamic / static
One of the main difference between NodeJs and Typescript is:
- NodeJS can import modules **dynamically**
- Typescript module relied on **static** ES6 modules definition

The update will be a required step to Typescript, so do it!
One important thing is you have to do all at once (or on standalone modules)

- use **only** `require()` / `module.exports` 🚫
- or **only** `import` / `export` 🚫

The purpose of this script is to make you **FAST** in this mission 🚀

## How to use
### Install and run:
```bash
npm i
node ./dist/main.js /path/to/your/project
# Follow the instructions, step by step
```

### Watch changes and test
Your project has to be on Git. Use your file editor to see if the script worked as expected.

#### Package config

Two steps are mandatory to use `import` in Nodejs:
1. All `"type":"module"` to your `package.json`
2. Run your node program with `node --es-module-specifier-resolution=node`

Step 2 is required in order to not specify file extension in imports, which is more common to switch to Typscript.
By not writing extension, you will be able to switch a file ext from `.js` to `.ts` and not update every imports.


#### Eslint
Add to you eslint config file
```
"parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module"
},
```


## Capacities
### Import support

<table>
 <tr>
  <td>

🕸 CommonJS version
```javascript
// Global imports
const _ = require('lodash');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const CustomNameRouter = require('express').Router;

// Local imports
const someFile = require(`../path/file`);
const myFunc = require(`../file2`).func;
const { myUtil } = require(`../file2`);

```

   </td>
   <td>

   
✨ ES6 import version
```javascript
// Global imports
import _ from 'lodash';
import * as sinon from 'sinon';
import { ObjectId } from 'mongodb';
import { Router as CustomNameRouter } from 'express';

// Local imports
import * as someFile from "../path/file.js";
import { func as myFunc, myUtil } from "../file2.js";

```

     
   </td>
   <td>
 </tr>
</table>

### Export support

#### Exports


<table>
 <tr>
  <td>

🕸 CommonJS version
```javascript
const MYCONST = 89;
module.exports = { myFunc, MYCONST };
Object.assign(module.exports, { myFunc, MYCONST });
module.exports.someConst = {};
function myFunc(){}
```

   </td>
   <td>
    
✨ ES6 import version
```javascript
export const MYCONST = 89;
export const someConst = {};
export function myFunc(){}
```

   </td>
   <td>
 </tr>
</table>


#### Handle index.js interface import / export
It's usual with Nodejs to have `index.js` files export like this:


<table>
 <tr>
  <td>

🕸 CommonJS version
```javascript
const myLib = require('./myLib');
const lib2 = require('./lib2/');
module.exports = { ...myLib, lib2, }
```

   </td>
   <td>

✨ ES6 import version
```javascript
export * from './myLib.js';
export lib2 from './lib2/index.js';
```

   </td>
   <td>
 </tr>
</table>




