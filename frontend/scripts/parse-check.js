#!/usr/bin/env node
// Babel syntax check for one or more JS/JSX files. Read-only — parses only, never executes the target file.
// Usage: node scripts/parse-check.js <file> [file...]
const babel = require('@babel/core');
const fs = require('fs');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/parse-check.js <file> [file...]');
  process.exit(1);
}

let hasError = false;
for (const f of files) {
  try {
    babel.parse(fs.readFileSync(f, 'utf8'), {
      presets: [require.resolve('@babel/preset-react')],
      filename: f,
    });
    console.log(f, 'OK');
  } catch (e) {
    console.log(f, 'ERROR:', e.message);
    hasError = true;
  }
}
process.exit(hasError ? 1 : 0);
