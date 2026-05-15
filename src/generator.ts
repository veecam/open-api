import lodash from 'lodash';
import ts from 'typescript';
import {
  addMultiLineComment,
  addMultiLineTinyComment,
  addSingleLineComment,
  concatNodes,
  createBlock,
  createCall,
  createFunctionDeclaration,
  createIndexSignature,
  createObjectBinding,
  createParameter,
  createPlainObjectLiteral,
  createPropertyAssignment,
  createPropertySignature,
  createTemplateString,
  createTypeAliasDeclaration,
  createVariableDeclaration,
  createVariableStatement,
  isValidIdentifier,
  keywordType,
  modifier,
  printFile,
} from './codegen';
import { OpenAPIPathObject, OpenAPISchemaOrReferenceObject, OpenApi } from './openapi';

const { camelCase } = lodash;

export type GeneratorOptions = {
  importRequestStatement?: string;
  useUriForRequestName?: boolean;
  requestFunctionName?: 'operationId' | 'uri' | ((value: OpenAPIPathObject) => string);
  useSnakeCaseForPropName?: boolean;
  parameterNameCase?: 'snakeCase' | ((value: string) => string);
  useEnums?: boolean;
  useInt64AsString?: boolean;
  useDataOfResponse?: boolean;
  uriPrefix?: string;
  boxingRefQuery?: {
    name?: string;
    cleanIfAlone?: boolean;
  };
};

type NormalizedGeneratorOptions = Omit<GeneratorOptions, 'useUriForRequestName' | 'useSnakeCaseForPropName'> & {
  useEnums: boolean;
  useDataOfResponse: boolean;
  uriPrefix: string;
  boxingRefQuery: {
    name?: string;
    cleanIfAlone: boolean;
  };
};

class CountedName {
  private namesCount: Record<string, number> = {};

  checkout = (name: string) => {
    const count = (this.namesCount[name] = (this.namesCount[name] || 0) + 1);
    return count > 1 ? name + count : name;
  };

  has = (name: string) => {
    return (this.namesCount[name] || 0) >= 1;
  };
}

export class Generator {
  static REQUEST_HANDLER = 'request';
  static REQUEST_OPTIONS = 'opts';
  static REQUEST_OPTIONS_TYPE = 'ReqOpts';
  static REQUEST_QUERY_PARAM = 'query';
  static REQUEST_PARAMS = 'params';
  static REQUEST_BODY = 'data';

  private opts: NormalizedGeneratorOptions;
  private defs: ts.Statement[] = [];
  private enumDatas: { name: string; template: string; description?: string }[] = [];
  private enumGather: ts.Statement | undefined;
  private requests: ts.Statement[] = [];
  private refs: Record<string, ts.TypeReferenceNode> = {};
  private refNames = new CountedName();
  private reqNames = new CountedName();
  private enumNames = new CountedName();
  private runtimeImportNames = new Set<string>();

  constructor(
    private openapi: OpenApi,
    opts: GeneratorOptions,
  ) {
    const {
      useUriForRequestName,
      requestFunctionName,
      useSnakeCaseForPropName,
      parameterNameCase,
      boxingRefQuery,
      uriPrefix,
      ...rest
    } = opts;

    this.opts = {
      requestFunctionName: useUriForRequestName ? 'uri' : requestFunctionName,
      parameterNameCase: useSnakeCaseForPropName ? 'snakeCase' : parameterNameCase,
      useEnums: true,
      useDataOfResponse: true,
      boxingRefQuery: { cleanIfAlone: true, ...boxingRefQuery },
      uriPrefix: uriPrefix ? `/${uriPrefix.replace(/(^\/|\/$)/g, '')}` : '',
      ...rest,
    };

    if (this.opts.useDataOfResponse) {
      this.runtimeImportNames.add('DataOfResponse');
    }
  }

  private createUnionTypeFromVariants = (variantsObject: {
    variants: OpenAPISchemaOrReferenceObject[];
    discriminator?: { propertyName?: string; mapping?: Record<string, string> };
  }) => {
    const { variants, discriminator } = variantsObject;
    if (!discriminator) {
      return ts.factory.createUnionTypeNode(variants.map(this.createTypeFromSchemaOrReference));
    }

    if (discriminator.propertyName === undefined) {
      throw new Error('Discriminators require a propertyName');
    }

    const mappedValues = new Set(
      Object.values(discriminator.mapping || {}).map((ref) => this.openapi.getReferenceName(ref)),
    );

    return ts.factory.createUnionTypeNode(
      [
        ...Object.entries(discriminator.mapping || {}).map(
          ([discriminatorValue, variantRef]) =>
            [discriminatorValue, { $ref: variantRef }] as [string, OpenAPISchemaOrReferenceObject],
        ),
        ...variants
          .filter((variant) => {
            if (!this.openapi.isReference(variant)) {
              throw new Error('Discriminators require references, not inline schemas');
            }

            return !mappedValues.has(this.openapi.getReferenceName(variant.$ref));
          })
          .map((schema) => {
            const reference = schema as { $ref: string };
            return [this.openapi.getReferenceName(reference.$ref), reference] as [string, OpenAPISchemaOrReferenceObject];
          }),
      ].map(([discriminatorValue, variant]) =>
        ts.factory.createIntersectionTypeNode([
          ts.factory.createTypeLiteralNode([
            createPropertySignature({
              name: discriminator.propertyName!,
              type: ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(discriminatorValue)),
            }),
          ]),
          this.createTypeFromSchemaOrReference(variant),
        ]),
      ),
    );
  };

  private createTypeFromProperties = (propsObject: {
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: unknown;
  }) => {
    const { properties, required, additionalProperties } = propsObject;
    const members: ts.TypeElement[] = Object.keys(properties).map((name) => {
      const schema = properties[name];
      const isRequired = required && required.includes(name);
      const type = this.createTypeFromSchemaOrReference(schema);
      return addMultiLineTinyComment(
        createPropertySignature({ name: this.getPropertyKeyName(name), questionToken: !isRequired, type }),
        schema.description,
      );
    });

    if (additionalProperties) {
      members.push(createIndexSignature({ type: keywordType.any }));
    }

    const objectType = ts.factory.createTypeLiteralNode(members);
    const shouldFormData = Object.keys(properties).some((name) => {
      const schema = this.openapi.resolve<any>(properties[name]);
      return schema.format === 'binary';
    });

    if (shouldFormData) {
      this.runtimeImportNames.add('GenericFormData');
      return ts.factory.createTypeReferenceNode('GenericFormData', [objectType]);
    }

    return objectType;
  };

  private createTypeFromEnum = (items: unknown[]) => {
    const types = items.map((item) => {
      if (item === null) {
        return keywordType.null;
      }

      if (typeof item === 'boolean') {
        return item
          ? ts.factory.createLiteralTypeNode(ts.factory.createToken(ts.SyntaxKind.TrueKeyword))
          : ts.factory.createLiteralTypeNode(ts.factory.createToken(ts.SyntaxKind.FalseKeyword));
      }

      if (typeof item === 'number') {
        return ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(item));
      }

      return ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(String(item)));
    });

    return types.length > 1 ? ts.factory.createUnionTypeNode(types) : types[0];
  };

  private createTypeFromSchema = (schema: any): ts.TypeNode => {
    if (!schema) {
      return keywordType.any;
    }

    if (schema.oneOf) {
      return this.createUnionTypeFromVariants({ variants: schema.oneOf, discriminator: schema.discriminator });
    }

    if (schema.anyOf) {
      return this.createUnionTypeFromVariants({ variants: schema.anyOf });
    }

    if (schema.allOf) {
      const types = schema.allOf.map(this.createTypeFromSchemaOrReference);
      if (schema.properties || schema.additionalProperties) {
        types.push(
          this.createTypeFromProperties({
            properties: schema.properties || {},
            required: schema.required,
            additionalProperties: schema.additionalProperties,
          }),
        );
      }

      return ts.factory.createIntersectionTypeNode(types);
    }

    if ('items' in schema) {
      return ts.factory.createArrayTypeNode(this.createTypeFromSchemaOrReference(schema.items));
    }

    if (schema.properties || schema.additionalProperties) {
      return this.createTypeFromProperties({
        properties: schema.properties || {},
        required: schema.required,
        additionalProperties: schema.additionalProperties,
      });
    }

    if (schema.enum) {
      return this.createTypeFromEnum(schema.enum);
    }

    if (schema.format === 'binary') {
      return ts.factory.createTypeReferenceNode('Blob');
    }

    if (schema.type) {
      if (schema.type in keywordType) {
        return keywordType[schema.type as keyof typeof keywordType];
      }

      if (schema.type === 'integer') {
        if (this.opts.useInt64AsString && schema.format === 'int64') {
          return keywordType.string;
        }

        return keywordType.number;
      }
    }

    return keywordType.any;
  };

  private createTypeFromResponse = (response: any) => {
    const { content } = response || {};
    if (!content) {
      return keywordType.unknown;
    }

    const schema = this.openapi.getSchemaFromContent(content);
    const responseType = this.createTypeFromSchemaOrReference(schema);

    if (this.opts.useDataOfResponse) {
      return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('DataOfResponse'), [responseType]);
    }

    return responseType;
  };

  private createTypeFromSchemaOrReference = (schema: any): ts.TypeNode => {
    const type = this.openapi.isReference(schema) ? this.createTypeFromReference(schema) : this.createTypeFromSchema(schema);
    return this.openapi.isNullable(schema) ? ts.factory.createUnionTypeNode([type, keywordType.null]) : type;
  };

  private createTypeFromReference = (reference: { $ref: string }) => {
    const ref = reference.$ref;
    if (!this.refs[ref]) {
      const name = this.refNames.checkout(this.openapi.getReferenceName(ref));
      this.refs[ref] = ts.factory.createTypeReferenceNode(name);
      this.collectTypeFromReference(name, reference);
    }

    return this.refs[ref];
  };

  private collectTypeFromReference = (name: string, reference: { $ref: string }) => {
    const schema = this.openapi.resolve<any>(reference);
    const type = this.createTypeFromSchema(schema);
    const declaration = createTypeAliasDeclaration({ modifiers: [modifier.export], name, type });
    this.defs.push(addMultiLineComment(declaration, schema.description));

    if (this.opts.useEnums && schema.enum && schema.format) {
      this.enumDatas.push({
        name: `${this.enumNames.checkout(name.replace(/Enum$/, ''))}Enum`,
        template: schema.format,
        description: schema.description,
      });
    }
  };

  private getNameIdentifier = (id?: string) => {
    if (!id) {
      return;
    }

    if (id.match(/[^\w\s-/]/)) {
      return;
    }

    const result = camelCase(id);
    if (isValidIdentifier(result)) {
      return result;
    }
  };

  private uri2name = (uri: string) => {
    const pathParamRegex = /\{(.+?)\}/;
    for (let i = 0; pathParamRegex.test(uri); i++) {
      uri = uri.replace(pathParamRegex, `${i === 0 ? 'by' : 'and'} $1`);
    }

    return camelCase(uri.replace(/^\/api/i, ''));
  };

  private getPropertyKeyName = (value: string) => {
    if (this.opts.parameterNameCase === 'snakeCase') {
      return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    }

    if (typeof this.opts.parameterNameCase === 'function') {
      return this.opts.parameterNameCase(value);
    }

    return value;
  };

  private isBoxingRefQueryParam = (paramObject: any) => {
    if (!this.openapi.isReference(paramObject)) {
      return false;
    }

    const schema = this.openapi.resolve<any>(paramObject);
    return schema.enum ? false : true;
  };

  private getRequestFunctionName = (pathObject: OpenAPIPathObject) => {
    const { uri, operationId, method } = pathObject;
    if (typeof this.opts.requestFunctionName === 'function') {
      return this.opts.requestFunctionName(pathObject);
    }

    let name =
      this.opts.requestFunctionName === 'uri'
        ? this.uri2name(uri)
        : this.getNameIdentifier(operationId) || this.uri2name(uri);
    this.reqNames.has(name) && (name = camelCase(`${name} using ${method} `));
    return this.reqNames.checkout(name);
  };

  private createRequestFunctionArguments = (pathObject: OpenAPIPathObject) => {
    const { parameters, requestBody } = pathObject;
    const args: ts.ParameterDeclaration[] = [];

    if (parameters.length) {
      const { name, cleanIfAlone } = this.opts.boxingRefQuery;
      if (cleanIfAlone && parameters.length === 1 && this.isBoxingRefQueryParam(parameters[0].schema)) {
        const type = this.createTypeFromSchemaOrReference(parameters[0].schema);
        args.push(createParameter({ name: Generator.REQUEST_PARAMS, type }));
      } else {
        const type = ts.factory.createTypeLiteralNode(
          parameters.map((param) =>
            createPropertySignature({
              name: name && this.isBoxingRefQueryParam(param.schema) ? name : this.getPropertyKeyName(param.name),
              questionToken: !param.required,
              type: this.createTypeFromSchemaOrReference(param.schema),
            }),
          ),
        );
        args.push(createParameter({ name: Generator.REQUEST_PARAMS, type }));
      }
    }

    if (requestBody) {
      const schema = this.openapi.getSchemaFromContent(requestBody.content);
      const type = this.createTypeFromSchemaOrReference(schema);
      args.push(createParameter({ name: Generator.REQUEST_BODY, type, questionToken: !requestBody.required }));
    }

    args.push(
      createParameter({
        name: Generator.REQUEST_OPTIONS,
        type: ts.factory.createTypeReferenceNode(Generator.REQUEST_OPTIONS_TYPE),
        questionToken: true,
      }),
    );

    return args;
  };

  private createRequestUri = (pathObject: OpenAPIPathObject) => {
    const { uri, parameters } = pathObject;
    const spans: { expression: ts.Expression; literal: string }[] = [];
    const head = uri.replace(/(.*?)\{(.+?)\}(.*?)(?=\{|$)/g, (_, headValue, name, literal) => {
      spans.push({
        expression: ts.factory.createIdentifier(this.getPropertyKeyName(camelCase(name))),
        literal,
      });
      return headValue;
    });
    const requestUri = createTemplateString(this.opts.uriPrefix + head, spans);

    if (!parameters.some((param) => param.in === 'query')) {
      return requestUri;
    }

    this.runtimeImportNames.add('createUri');
    return createCall({
      expression: 'createUri',
      args: [requestUri, ts.factory.createIdentifier(Generator.REQUEST_QUERY_PARAM)],
    });
  };

  private createRequestArguments = (pathObject: OpenAPIPathObject) => {
    const { method, requestBody } = pathObject;
    const args: ts.Expression[] = [this.createRequestUri(pathObject)];
    const init: ts.ObjectLiteralElementLike[] = [];

    if (method !== 'GET') {
      init.push(createPropertyAssignment('method', ts.factory.createStringLiteral(method)));
    }

    if (requestBody) {
      init.push(ts.factory.createShorthandPropertyAssignment(Generator.REQUEST_BODY));
    }

    init.push(ts.factory.createSpreadAssignment(ts.factory.createIdentifier(Generator.REQUEST_OPTIONS)));
    args.push(ts.factory.createObjectLiteralExpression(init));
    return args;
  };

  private createRequestFunctionBody = (pathObject: OpenAPIPathObject) => {
    const { parameters, response } = pathObject;
    const statements: ts.Statement[] = [];

    if (parameters.length) {
      const { name, cleanIfAlone } = this.opts.boxingRefQuery;
      const getQueryParamElements = () => {
        const refQuery = parameters.find((param) => this.isBoxingRefQueryParam(param.schema));
        if (refQuery && (!cleanIfAlone || (cleanIfAlone && parameters.length > 1))) {
          const queryName = name || refQuery.name;
          return queryName === Generator.REQUEST_QUERY_PARAM
            ? [{ name: queryName }]
            : [{ name: Generator.REQUEST_QUERY_PARAM, propertyName: queryName }];
        }

        return parameters.some((param) => param.in === 'query') ? [{ name: 'query', dotDotDotToken: true }] : [];
      };

      const paramsVariable = createVariableStatement({
        declarationList: createVariableDeclaration({
          name: createObjectBinding([
            ...parameters
              .filter((param) => param.in === 'path')
              .map((param) => ({ name: this.getPropertyKeyName(param.name) })),
            ...getQueryParamElements(),
          ]),
          initializer: ts.factory.createIdentifier(Generator.REQUEST_PARAMS),
        }),
      });

      statements.push(paramsVariable);
    }

    const requestCall = createCall({
      expression: ts.factory.createIdentifier(Generator.REQUEST_HANDLER),
      typeArgs: [this.createTypeFromResponse(response)],
      args: this.createRequestArguments(pathObject),
    });
    statements.push(ts.factory.createReturnStatement(requestCall));

    return createBlock(statements);
  };

  private reset = () => {
    this.defs = [];
    this.enumDatas = [];
    this.requests = [];
    this.refs = {};
    this.refNames = new CountedName();
    this.reqNames = new CountedName();
    return this;
  };

  build = () => {
    this.reset();
    const paths = this.openapi.getPaths();

    this.requests = paths.map((pathObject) => {
      const { uri, summary } = pathObject;
      pathObject.parameters = pathObject.parameters.map((param) => ({ ...param, name: camelCase(param.name) }));
      const fnName = this.getRequestFunctionName(pathObject);
      const fnArgs = this.createRequestFunctionArguments(pathObject);
      const fnBody = this.createRequestFunctionBody(pathObject);

      return addMultiLineComment(
        createFunctionDeclaration({
          modifiers: [modifier.export],
          name: fnName,
          parameters: fnArgs,
          body: fnBody,
        }),
        `${summary || 'unknown'} ${uri}`,
      );
    });

    const enumDeclarationList = createVariableDeclaration({
      name: 'enums',
      initializer: ts.factory.createObjectLiteralExpression(
        this.enumDatas.map((enumData) => {
          const template = JSON.parse(enumData.template);
          const args = [
            ts.factory.createAsExpression(
              ts.factory.createArrayLiteralExpression(
                template.map((item: any) => {
                  const enumItem = createPlainObjectLiteral([
                    ...Object.entries(item).slice(0, 2),
                    ['name', item.desc || 'unknown'],
                  ] as [string, string | number][]);
                  return addSingleLineComment(enumItem, item.desc);
                }),
              ),
              ts.factory.createTypeReferenceNode('const'),
            ),
          ];
          const enumObject = createPropertyAssignment(enumData.name, createCall({ expression: 'createEnum', args }));
          return addSingleLineComment(enumObject, enumData.description);
        }),
      ),
    });

    this.enumGather = addMultiLineComment(
      createVariableStatement({ modifiers: [modifier.export], declarationList: enumDeclarationList }),
      'Enum collection',
    );

    if (this.enumDatas.length) {
      this.runtimeImportNames.add('createEnum');
    }

    return this;
  };

  getRequestSum() {
    return this.requests.length;
  }

  bundle = () => {
    if (!this.defs.length || !this.requests.length) {
      this.build();
    }

    const runtimeImport = Array.from(this.runtimeImportNames).join(', ');
    const banner = `
${runtimeImport ? `import { ${runtimeImport} } from '@vvedo/openapi-ts'` : ''}
${this.opts.importRequestStatement}
`;
    const sourceFile = ts.createSourceFile('placeholder.ts', banner, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

    Object.assign(sourceFile, {
      statements: concatNodes(sourceFile.statements, this.defs, [this.enumGather].filter(Boolean) as ts.Statement[], this.requests),
    });

    return printFile(sourceFile);
  };
}
