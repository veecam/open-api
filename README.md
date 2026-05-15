# @vvedo/openapi-ts

Generate TypeScript API methods and type definitions from OpenAPI documents.

## Usage

Create `.openapi-tsrc.ts`:

```ts
import { defineConfig } from '@vvedo/openapi-ts';

export default defineConfig({
  source: './openapi.json',
  dest: './src/api.ts',
  importRequestStatement: "import request, { ReqOpts } from './request'",
});
```

Run:

```bash
npx openapi-ts
```

## Publishing

This package is published from GitHub Actions when a GitHub Release is published.
The workflow uses the repository secret `NPM_TOKEN` and runs:

```bash
npm publish --provenance --access public
```

