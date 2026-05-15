# @vvedo/openapi-ts

Generate TypeScript API functions and type definitions from an OpenAPI document.

This package is useful when a frontend project already has a request wrapper, and you want to generate typed API methods from Swagger/OpenAPI instead of writing request functions and DTO types by hand.

## What It Generates

Given an OpenAPI document, it writes one TypeScript file containing:

- exported type aliases for referenced schemas
- exported request functions for matched operations
- typed request params, request body, and response data
- optional enum helper data when enum metadata is present

Example generated shape:

```ts
import { DataOfResponse, createUri } from '@vvedo/openapi-ts';
import request, { ReqOpts } from './request';

export type User = {
  id: string;
  name: string;
};

export function getUser(params: { id: string }, opts?: ReqOpts) {
  const { id } = params;
  return request<DataOfResponse<{ data: User }>>(`/api/users/${id}`, { ...opts });
}
```

## Requirements

- Node.js 18+ is recommended. Node.js 16 can work through the package fetch polyfill.
- Your project needs a request function that matches the generated calls.
- Your OpenAPI document should be OpenAPI 3.x. Swagger 2.0 documents are converted internally.

The generated code imports runtime helpers from `@vvedo/openapi-ts`, so the package should remain installed in the consuming project.

## Install

```bash
npm install -D @vvedo/openapi-ts
```

If generated API files are compiled as part of your app, keep the package available to that build. Using `dependencies` instead of `devDependencies` is also fine if your runtime/bundler needs it.

## Configure

Create `.openapi-tsrc.ts` in your project root:

```ts
import { defineConfig } from '@vvedo/openapi-ts';

export default defineConfig({
  source: './openapi.json',
  dest: './src/services/api.ts',
  importRequestStatement: "import request, { ReqOpts } from './request'",
});
```

Then run:

```bash
npx openapi-ts
```

The CLI also accepts the legacy `.genapirc.ts` filename as a fallback.

## Request Wrapper

The generated functions call a request function named `request` and pass a `ReqOpts` type by default. You provide both through `importRequestStatement`.

A minimal compatible wrapper looks like this:

```ts
export type ReqOpts = {
  method?: string;
  data?: unknown;
  headers?: Record<string, string>;
};

export default function request<T>(url: string, opts?: ReqOpts): Promise<T> {
  return fetch(url, {
    method: opts?.method || 'GET',
    body: opts?.data ? JSON.stringify(opts.data) : undefined,
    headers: opts?.headers,
  }).then((res) => res.json() as Promise<T>);
}
```

In real projects this is usually an Axios/fetch wrapper with interceptors, base URL handling, auth headers, error handling, and response normalization.

## Options

### `source`

OpenAPI document path or URL. Use an array when generating from multiple documents.

```ts
source: './openapi.json'
source: 'https://example.com/v3/api-docs'
source: ['./user.json', './order.json']
```

### `dest`

Output file path. If `source` is an array, `dest` should usually be an array with the same order.

```ts
dest: './src/services/api.ts'
dest: ['./src/api/user.ts', './src/api/order.ts']
```

### `importRequestStatement`

Import statement inserted at the top of the generated file.

```ts
importRequestStatement: "import request, { ReqOpts } from '@/shared/request'"
```

The generated code expects imported names `request` and `ReqOpts`.

### `requestFunctionName`

Controls generated function names.

```ts
requestFunctionName: 'operationId' // default behavior
requestFunctionName: 'uri'
requestFunctionName: (operation) => `api${operation.operationId}`
```

`useUriForRequestName` is still supported, but `requestFunctionName: 'uri'` is preferred.

### `includes` / `excludes`

Filter operations by URI.

```ts
includes: [/^\/api\//],
excludes: ['/api/internal']
```

### `useTagsForOperationId`

Build function names from tag names plus operation IDs. Useful when backend operation IDs are duplicated or too generic.

```ts
useTagsForOperationId: true
```

### `transformRefName`

Controls schema reference type names.

```ts
transformRefName: 'camelCase' // default, e.g. user_response -> UserResponse
transformRefName: 'keepIntact'
transformRefName: (name) => `Api${name}`
```

### `parameterNameCase`

Controls generated parameter property names.

```ts
parameterNameCase: 'snakeCase'
parameterNameCase: (name) => name
```

`useSnakeCaseForPropName` is still supported, but `parameterNameCase` is preferred.

### `useInt64AsString`

Generates OpenAPI `integer` + `int64` as `string`. Use this when backend serializes long integers as strings to avoid JavaScript number precision issues.

```ts
useInt64AsString: true
```

### `useDataOfResponse`

Defaults to `true`. When enabled, generated return types use `DataOfResponse<T>`, which extracts the `data` field from response wrapper types.

```ts
useDataOfResponse: false
```

Disable it if your request wrapper returns the whole response object.

### `uriPrefix`

Adds a prefix to generated request URLs.

```ts
uriPrefix: '/admin'
```

### `boxingRefQuery`

Controls query parameters represented by a referenced schema.

```ts
boxingRefQuery: {
  name: 'query',
  cleanIfAlone: true,
}
```

### `formatter`

Formats generated files with a local formatter.

```ts
formatter: 'prettier'
formatter: 'biome'
```

Install the selected formatter in your project. Omit the option to let the generator try to detect one.

### `transformDocument`

Mutates the bundled OpenAPI document before code generation.

```ts
transformDocument: (doc) => {
  // patch schemas, examples, formats, etc.
  return doc;
}
```

### `transformCode`

Mutates generated code before writing the output file.

```ts
transformCode: (code) => code.replaceAll('ReadonlyArray', 'Array')
```

## Multiple Configs

Export an array to generate multiple groups:

```ts
export default defineConfig([
  {
    source: './openapi/user.json',
    dest: './src/api/user.ts',
    importRequestStatement: "import request, { ReqOpts } from '@/shared/request'",
  },
  {
    source: './openapi/order.json',
    dest: './src/api/order.ts',
    importRequestStatement: "import request, { ReqOpts } from '@/shared/request'",
  },
]);
```

Generate one config item by index:

```bash
npx openapi-ts --idx 1
```

Generate multiple indexes:

```bash
npx openapi-ts --idx 0 --idx 1
```

## Using Generated APIs

After generation, import functions and types from the output file:

```ts
import { getUser, type User } from './services/api';

const user: User | undefined = await getUser({ id: '123' });
```

For query parameters, pass one `params` object:

```ts
await listUsers({ page: 1 });
```

For request bodies, pass the body as the first argument:

```ts
await createUser({ name: 'Ada', role: 'admin' });
```

For extra request options, pass the final `opts` argument:

```ts
await getUser({ id: '123' }, { headers: { Authorization: 'Bearer token' } });
```

## Notes

- Header parameters in OpenAPI are ignored by generation.
- `200` response is preferred; otherwise `default` response is used.
- For `multipart/form-data` with binary fields, generated object types use `GenericFormData`.
- Generated function names are de-duplicated when OpenAPI operation IDs collide.
- Swagger 2.0 conversion may create a `*-dict.json` file next to the destination path when Chinese schema names need patching.

