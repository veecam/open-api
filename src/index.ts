import './polyfill';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { OpenApi, OpenApiOptions } from './openapi';
import { Generator, GeneratorOptions } from './generator';

export type OpenApiGeneratorOptions = {
  source: string | string[];
  dest: string | string[];
  prettierConfig?: object;
  formatter?: 'prettier' | 'biome';
  transformCode?: (code: string) => string;
} & Omit<OpenApiOptions, 'spec' | 'local'> &
  GeneratorOptions;

export class OpenApiGenerator {
  static initialize(opts: OpenApiGeneratorOptions | OpenApiGeneratorOptions[]) {
    return new OpenApiGenerator(Array.isArray(opts) ? opts : [opts]);
  }

  constructor(private opts: OpenApiGeneratorOptions[]) {}

  private normalizeOptions = (idx: number) => {
    const { source, dest, importRequestStatement, prettierConfig, formatter, ...rest } = this.opts[idx];

    const seekFormatter = () => {
      try {
        require.resolve('prettier');
        return 'prettier' as const;
      } catch {}

      try {
        require.resolve('@biomejs/biome');
        return 'biome' as const;
      } catch {}
    };

    return {
      source: Array.isArray(source) ? source : [source],
      dest: (Array.isArray(dest) ? dest : [dest]).map((value) => path.resolve(value)),
      importRequestStatement: importRequestStatement || "import request, { ReqOpts } from '@/shared/nxios'",
      formatter: prettierConfig ? ('prettier' as const) : formatter || seekFormatter(),
      ...rest,
    };
  };

  private output = (dest: string, code: string) => {
    if (!fs.existsSync(dest)) {
      const dir = path.dirname(dest);
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(dest, code);
  };

  private report = (_data: unknown) => {
    // Intentionally empty. Generation is fully local and does not send usage data.
  };

  generate = async (params?: { idx?: number | number[] }) => {
    const { idx = 0 } = params || {};

    if (Array.isArray(idx)) {
      for (let i = 0; i < idx.length; i++) {
        await this.generate({ idx: idx[i] });
      }

      return;
    }

    const { source, dest, formatter, transformCode, ...rest } = this.normalizeOptions(idx);
    const { transformDocument, useTagsForOperationId, transformRefName, includes, excludes, ...restGenerator } = rest;
    let requestSum = 0;

    for (let i = 0; i < source.length; i++) {
      const openapi = await OpenApi.initialize({
        spec: source[i],
        local: dest[i],
        transformDocument,
        useTagsForOperationId,
        transformRefName,
        includes,
        excludes,
      });
      const generator = new Generator(openapi, restGenerator);
      const code = generator.bundle();
      this.output(dest[i], transformCode ? transformCode(code) : code);

      if (formatter === 'prettier') {
        execSync(`npx prettier --parser=babel-ts --write ${dest[i]}`);
      } else if (formatter === 'biome') {
        execSync(`npx biome lint --write ${dest[i]}`);
      }

      requestSum += generator.getRequestSum();
    }

    this.report({ sum: requestSum, config: { source, formatter, ...rest } });
  };

  startMockServer = async (params: { idx: number; port?: number }) => {
    const { source, dest, transformDocument } = this.opts[params.idx];
    const openapi = await OpenApi.initialize({
      spec: Array.isArray(source) ? source[0] : source,
      local: Array.isArray(dest) ? dest[0] : dest,
      transformDocument,
    });

    try {
      const OpenApiMocker = require('open-api-mocker');
      const mocker = new OpenApiMocker({ schema: openapi.getDocument(), port: params.port });
      await mocker.validate();
      await mocker.mock();
    } catch (error: any) {
      if (
        error.code === 'MODULE_NOT_FOUND' &&
        error.message.startsWith("Cannot find module 'ajv/lib/refs/json-schema-draft-04.json'")
      ) {
        console.log(
          'OpenApiMocker failed: ajv dependency not found. With pnpm, add a package extension for ajv-openapi.',
        );
      } else {
        throw error;
      }
    }
  };
}

export const defineConfig = (config: OpenApiGeneratorOptions | OpenApiGeneratorOptions[]) => config;

