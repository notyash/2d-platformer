// scripts/verify-tokens.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tokensTsPath = path.resolve(__dirname, '../src/theme/tokens.ts');
const tokensCssPath = path.resolve(__dirname, '../src/theme/tokens.css');

const tokensTsContent = fs.readFileSync(tokensTsPath, 'utf8');
const tokensCssContent = fs.readFileSync(tokensCssPath, 'utf8');

// Helper to convert camelCase to kebab-case
function camelToKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// Extract CSS variables from tokens.css
const cssVarRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
const cssTokens = new Map();
let match;
while ((match = cssVarRegex.exec(tokensCssContent)) !== null) {
  cssTokens.set(match[1].trim(), match[2].trim());
}

// Basic evaluation of TOKENS object from tokens.ts
const matchTokens = tokensTsContent.match(/export const TOKENS = (\{[\s\S]*?\}) as const;/);
if (!matchTokens) {
  console.error('❌ Failed to parse TOKENS from tokens.ts');
  process.exit(1);
}

let tokensObj;
try {
  // Safe simple evaluate of JSON-like JS object
  const cleaned = matchTokens[1]
    .replace(/(['"])?([a-zA-Z0-9_-]+)(['"])?:/g, '"$2":')
    .replace(/'/g, '"')
    .replace(/,\s*([\]}])/g, '$1');
  tokensObj = JSON.parse(cleaned);
} catch (_e) {
  // If JSON parse fails due to JS syntax, use function constructor
  const fn = new Function(`return ${matchTokens[1]}`);
  tokensObj = fn();
}

let errorCount = 0;

// Mapping rules from TOKENS properties to CSS var names
function verifyGroup(groupName, groupObj, prefix = '') {
  for (const [key, _val] of Object.entries(groupObj)) {
    let cssVarName;
    if (groupName === 'colors') {
      if (['success', 'successBg', 'warning', 'warningBg', 'danger', 'dangerBg'].includes(key)) {
        cssVarName = `color-${camelToKebab(key)}`;
      } else {
        cssVarName = camelToKebab(key);
      }
    } else if (groupName === 'fonts') {
      cssVarName = `font-${key}`;
    } else if (groupName === 'space') {
      cssVarName = `space-${key}`;
    } else if (groupName === 'radii') {
      cssVarName = `radius-${key}`;
    } else if (groupName === 'shadows') {
      cssVarName = `shadow-${camelToKebab(key)}`;
    } else if (groupName === 'zIndex') {
      cssVarName = `z-${camelToKebab(key)}`;
    } else if (groupName === 'transitions') {
      cssVarName = `transition-${key}`;
    } else {
      cssVarName = prefix ? `${prefix}-${camelToKebab(key)}` : camelToKebab(key);
    }

    if (!cssTokens.has(cssVarName)) {
      console.error(`❌ Token Drift: TOKENS.${groupName}.${key} is missing --${cssVarName} in tokens.css`);
      errorCount++;
    } else {
      const tsVal = String(_val).trim().replace(/\s+/g, ' ').replace(/"/g, "'");
      const cssVal = String(cssTokens.get(cssVarName)).trim().replace(/\s+/g, ' ').replace(/"/g, "'");
      if (tsVal !== cssVal && tsVal.toLowerCase() !== cssVal.toLowerCase()) {
        console.error(`❌ Value Mismatch: --${cssVarName} in tokens.css ("${cssVal}") does not match TOKENS.${groupName}.${key} in tokens.ts ("${tsVal}")`);
        errorCount++;
      }
    }
  }
}

for (const [groupName, groupObj] of Object.entries(tokensObj)) {
  if (typeof groupObj === 'object' && groupObj !== null) {
    verifyGroup(groupName, groupObj);
  }
}

if (errorCount > 0) {
  console.error(`\n❌ Token verification failed with ${errorCount} error(s).`);
  process.exit(1);
} else {
  console.log(`✅ Token parity verified: All TOKENS in tokens.ts match tokens.css (${cssTokens.size} CSS variables).`);
}
