#!/usr/bin/env node
/**
 * Baseline Parser Test
 * Tests all .st files in Examples/Alpha/ against the generated tree-sitter-st parser
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const parserDir = path.join(__dirname, '..', 'tree-sitter-st');
const examplesDir = path.join(__dirname, '..', 'Examples', 'Alpha');

// Find all .st files
const stFiles = [];
function findStFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findStFiles(fullPath);
    } else if (entry.name.endsWith('.st')) {
      stFiles.push(fullPath);
    }
  }
}
findStFiles(examplesDir);

console.log(`Found ${stFiles.length} .st files to test\n`);

let ok = 0;
let errors = 0;
const errorFiles = [];

for (const file of stFiles) {
  const fileName = path.basename(file);
  try {
    const result = execSync(
      `npx tree-sitter parse "${file}"`,
      { cwd: parserDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    if (result.includes('ERROR')) {
      errors++;
      errorFiles.push(fileName);
      console.log(`FAIL: ${fileName}`);
    } else {
      ok++;
    }
  } catch (e) {
    // tree-sitter returns non-zero exit code on parse errors
    const output = (e.stdout || '') + (e.stderr || '');
    if (output.includes('ERROR') || output.includes('error')) {
      errors++;
      errorFiles.push(fileName);
      console.log(`FAIL: ${fileName}`);
    } else {
      ok++;
    }
  }
}

console.log('\n=== BASELINE RESULTS ===');
console.log(`Total: ${stFiles.length}`);
console.log(`OK: ${ok}`);
console.log(`Errors: ${errors}`);
console.log(`Coverage: ${(ok / stFiles.length * 100).toFixed(1)}%`);

if (errorFiles.length > 0) {
  console.log('\n=== FAILED FILES ===');
  errorFiles.forEach(f => console.log(`  - ${f}`));
}
