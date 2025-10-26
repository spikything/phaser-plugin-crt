#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { readdir, stat } = require('node:fs/promises');
const { join, resolve } = require('node:path');

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const buildDir = resolve('build-tests', 'test');
  let stats;

  try {
    stats = await stat(buildDir);
  } catch (error) {
    console.error(`Compiled tests not found at ${buildDir}. Did you run "npm run build-tests"?`);
    process.exitCode = 1;
    return;
  }

  if (!stats.isDirectory()) {
    console.error(`Expected a directory at ${buildDir}, but found something else.`);
    process.exitCode = 1;
    return;
  }

  const files = (await collectTestFiles(buildDir)).sort();

  if (files.length === 0) {
    console.error(`No compiled test files found inside ${buildDir}.`);
    process.exitCode = 1;
    return;
  }

  const child = spawn(process.execPath, ['--test', ...files], {
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`Test runner exited with signal ${signal}.`);
      process.exit(1);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error('Failed to launch Node test runner:', error);
    process.exit(1);
  });
}

main();
