#!/usr/bin/env node

const path = require('path');
const { bundleRequire } = require('bundle-require');
const minimist = require('minimist');

const runBin = async () => {
  const cwd = process.cwd();
  const rcFilepath = path.resolve(cwd, '.genapirc.ts');
  const result = await bundleRequire({ filepath: rcFilepath });
  const config = result.mod.default || result.mod;
  const argv = minimist(process.argv.slice(2));
  const { OpenApiGenerator } = require('../dist/cli-exports/index');

  OpenApiGenerator.initialize(config).generate({ idx: argv.idx });
};

runBin();

