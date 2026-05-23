#!/usr/bin/env node
'use strict';

/**
 * Ensures TypeScript toolchain is present before `tsc` runs.
 * Fails fast with Render-specific guidance when devDependencies were skipped.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const typesNode = path.join(root, 'node_modules', '@types', 'node');

function fail(message) {
  console.error('\n[ClearClever build] ERROR:', message);
  console.error('\nRender Build Command must be:');
  console.error('  npm ci --include=dev && npm run build');
  console.error('\nAlso remove manual NODE_ENV=production from Render env (Render sets it at runtime).\n');
  process.exit(1);
}

if (!fs.existsSync(tscBin)) {
  fail('TypeScript is not installed. Run npm ci --include=dev (not npm install alone in production mode).');
}

if (!fs.existsSync(typesNode)) {
  fail('@types/node is not installed. Run npm ci --include=dev.');
}

let version;
try {
  version = execSync(`"${process.execPath}" "${tscBin}" --version`, { encoding: 'utf8' }).trim();
} catch {
  fail('Could not execute the project TypeScript compiler.');
}

console.log(`[ClearClever build] Toolchain OK (${version})`);
