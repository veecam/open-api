import SwaggerParser from '@apidevtools/swagger-parser';
import swagger2openapi from 'swagger2openapi';
import lodash from 'lodash';
import { OpenAPIV3 } from 'openapi-types';
import path from 'path';
import { PatchDict, patchJsonStringForSwagger2 } from './patch';

const { camelCase, get, upperFirst } = lodash;

type OpenAPIContentObject = {
  [media: string]: OpenAPIV3.MediaTypeObject;
};

export type OpenAPISchemaOrReferenceObject = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
export type OpenAPIPathsObject = ReturnType<OpenApi['getPaths']>;
export type OpenAPIPathObject = OpenAPIPathsObject[number];

export type OpenApiOptions = {
  spec: string;
  local: string;
  transformDocument?: (value: OpenAPIV3.Document) => OpenAPIV3.Document;
  useTagsForOperationId?: boolean;
  transformRefName?: 'camelCase' | 'keepIntact' | ((value: string) => string);
  includes?: (string | RegExp)[];
  excludes?: (string | RegExp)[];
};

const CONTENT_TYPES = {
  '*/*': 'json',
  'application/json': 'json',
  'application/hal+json': 'json',
  'application/problem+json': 'json',
  'application/geo+json': 'json',
  'application/x-www-form-urlencoded': 'form',
  'multipart/form-data': 'multipart',
} as const;

export class OpenApi {
  private tagMap: Record<string, { name: string; description?: string }> = {};

  private constructor(
    private doc: OpenAPIV3.Document,
    private opts: Omit<OpenApiOptions, 'spec' | 'transformDocument'>,
  ) {
    (this.doc.tags || []).forEach((tag) => {
      if (/[\u4e00-\u9fa5]/.test(tag.name) && tag.description) {
        this.tagMap[tag.name] = { name: tag.description, description: tag.name };
      } else {
        this.tagMap[tag.name] = { name: tag.name, description: tag.description };
      }
    });
  }

  static initialize = async (opts: OpenApiOptions) => {
    const { spec, transformDocument, ...rest } = opts;
    let doc = (await SwaggerParser.bundle(spec)) as OpenAPIV3.Document;

    if (!('openapi' in doc && doc.openapi.startsWith('3'))) {
      try {
        const pathname = rest.local.replace(/\.[^.]+$/, '');
        const dict = new PatchDict(path.resolve(`${pathname}-dict.json`));
        const patchedJson = await patchJsonStringForSwagger2(JSON.stringify(doc), dict);
        doc = (await swagger2openapi.convertObj(JSON.parse(patchedJson), { patch: true })).openapi as OpenAPIV3.Document;
      } catch (error: any) {
        throw new Error(error.message);
      }
    }

    return new OpenApi(transformDocument ? transformDocument(doc) : doc, rest);
  };

  private parsePaths = () => {
    const { paths } = this.doc;
    if (!paths) {
      return [];
    }

    return Object.entries(paths)
      .map(([uri, item]) => this.parsePath(uri, item))
      .reduce<ReturnType<OpenApi['parseOperation']>[]>((acc, operations) => (acc.length ? [...acc, ...operations] : operations), [])
      .filter(Boolean) as NonNullable<ReturnType<OpenApi['parseOperation']>>[];
  };

  private parsePath = (uri: string, pathItem?: OpenAPIV3.PathItemObject) => {
    if (!pathItem) {
      return [];
    }

    return Object.entries(pathItem)
      .map(([method, operation]) =>
        this.parseOperation(uri, method.toLocaleUpperCase(), operation as OpenAPIV3.OperationObject, pathItem.parameters),
      )
      .filter(Boolean);
  };

  private parseOperation = (
    uri: string,
    method: string,
    operation: OpenAPIV3.OperationObject,
    pathLevelParameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[] = [],
  ) => {
    const { includes, excludes, useTagsForOperationId } = this.opts;
    const { tags, operationId: id, parameters: params = [], requestBody: body, responses, summary } = operation;

    if (includes && !includes.some((value) => (typeof value === 'string' ? value === uri : value.test(uri)))) {
      return;
    }

    if (excludes && excludes.some((value) => (typeof value === 'string' ? value === uri : value.test(uri)))) {
      return;
    }

    let operationId = id;
    if (useTagsForOperationId) {
      const tagName = (tags || [])
        .filter(Boolean)
        .map((value) => (this.tagMap[value]?.name || value).replace(/(c|C)ontroller$/, ''))
        .join(' ');
      const idName = (id || '').replace(/_\d+$/, '');
      operationId = camelCase(`${tagName} ${idName}`);
    }

    operationId = operationId?.replace(/Using.+$/, '');

    const parameters = [...params, ...pathLevelParameters]
      .map(this.resolve)
      .filter((value): value is OpenAPIV3.ParameterObject => value.in !== 'header');
    const requestBody = this.resolve(body) as OpenAPIV3.RequestBodyObject | undefined;
    const response = this.resolve(responses['200'] || responses.default) as OpenAPIV3.ResponseObject;

    return {
      uri,
      operationId,
      method,
      parameters,
      requestBody,
      response,
      summary,
    };
  };

  getDocument = () => this.doc;
  getPaths = () => this.parsePaths();
  getSchemas = () => this.doc.components?.schemas || [];

  isReference = (obj: any): obj is OpenAPIV3.ReferenceObject => obj && '$ref' in obj;
  isNullable = (obj: any) => !!(obj && obj.nullable);

  getReferenceName = (ref: string) => {
    const { transformRefName = 'camelCase' } = this.opts;
    const refName = ref.replace(/.+\//, '');

    if (transformRefName === 'camelCase') {
      return upperFirst(camelCase(refName));
    }

    if (transformRefName === 'keepIntact') {
      return refName;
    }

    return transformRefName(refName);
  };

  resolve = <T>(reference: OpenAPIV3.ReferenceObject | T): T => {
    if (!this.isReference(reference)) {
      return reference;
    }

    const refPath = reference.$ref
      .slice(2)
      .split('/')
      .map((segment) => decodeURI(segment.replace(/~1/g, '/').replace(/~0/g, '~')));
    const result = get(this.doc, refPath);

    if (!result) {
      throw new Error(`Can't find ${refPath}`);
    }

    return this.resolve(result);
  };

  getSchemaFromContent = (content: OpenAPIContentObject): OpenAPISchemaOrReferenceObject => {
    const media = Object.keys(content)[0];
    if (!media || media.startsWith('text/')) {
      return { type: 'string' };
    }

    const contentType = Object.keys(CONTENT_TYPES).find((value) => media.startsWith(value));
    const schema = contentType && get(content, [media, 'schema']);
    return schema || { type: 'string', format: 'binary' };
  };
}
