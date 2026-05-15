import { defineConfig } from './src';

export default defineConfig({
  source: './fixtures/sample-openapi.json',
  dest: './generated/sample-api.ts',
  importRequestStatement: "import request, { ReqOpts } from './request'",
  formatter: undefined,
});

