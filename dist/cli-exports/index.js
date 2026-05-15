"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  OpenApiGenerator: () => OpenApiGenerator,
  defineConfig: () => defineConfig
});
module.exports = __toCommonJS(src_exports);

// src/polyfill.ts
var import_semver = __toESM(require("semver"));
if (import_semver.default.lt(process.version, "18.0.0")) {
  global.fetch = require("node-fetch");
}

// src/index.ts
var import_fs2 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));
var import_child_process = require("child_process");

// src/openapi.ts
var import_swagger_parser = __toESM(require("@apidevtools/swagger-parser"));
var import_swagger2openapi = __toESM(require("swagger2openapi"));
var import_lodash2 = __toESM(require("lodash"));
var import_path2 = __toESM(require("path"));

// src/patch.ts
var import_axios = __toESM(require("axios"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_query_string = require("query-string");
var import_lodash = __toESM(require("lodash"));
var import_pinyin_pro = require("pinyin-pro");
var { startCase, uniq } = import_lodash.default;
var visitArrayItems = (arr, visitor) => {
  arr.forEach((item) => {
    if (Array.isArray(item)) {
      visitArrayItems(item, visitor);
    } else {
      visitor(item);
    }
  });
};
var translate = async (text) => {
  if (text.length === 0) {
    return [];
  }
  const uri = "https://translate.googleapis.com/translate_a/t";
  const query = { client: "gtx", sl: "zh-CN", tl: "en", q: text };
  return (0, import_axios.default)({
    url: `${uri}?${(0, import_query_string.stringify)(query)}`,
    method: "GET",
    withCredentials: false,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
  }).then((response) => response.data).then((rawResponse) => {
    try {
      if (!Array.isArray(rawResponse)) {
        throw new Error("Unexpected response");
      }
      const intermediateTexts = [];
      visitArrayItems(rawResponse, (item) => {
        if (typeof item === "string") {
          intermediateTexts.push(item);
        }
      });
      const result = [];
      const isSingleResponseMode = text.length === 1;
      const isOneToOneMappingMode = intermediateTexts.length === text.length;
      for (const idx in intermediateTexts) {
        const translated = intermediateTexts[idx];
        if (isSingleResponseMode) {
          result.push(translated);
          break;
        }
        const isTranslation = isOneToOneMappingMode || Number(idx) % 2 === 0;
        if (isTranslation) {
          result.push(translated);
        }
      }
      if (result.length !== text.length) {
        console.warn("Translation result", result);
        throw new Error("Mismatching lengths of original and translated arrays");
      }
      return result;
    } catch (error) {
      console.warn("Got response", rawResponse);
      throw error;
    }
  });
};
var startCaseClassName = (name) => {
  const words = startCase(name).split(" ");
  return words.join("");
};
var toLatinWords = async (values) => {
  try {
    return await translate(values);
  } catch {
    return values.map((value) => (0, import_pinyin_pro.pinyin)(value, { toneType: "none", type: "array" }).join(" "));
  }
};
var PatchDict = class {
  constructor(filePath) {
    this.filePath = filePath;
    if (!import_fs.default.existsSync(this.filePath)) {
      import_fs.default.mkdirSync(import_path.default.dirname(this.filePath), { recursive: true });
    }
  }
  get() {
    if (!import_fs.default.existsSync(this.filePath)) {
      return {};
    }
    return JSON.parse(import_fs.default.readFileSync(this.filePath, "utf-8"));
  }
  set(data) {
    import_fs.default.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
};
var patchJsonStringForSwagger2 = async (jsonString, patchDict) => {
  let resultString = jsonString;
  const matched = jsonString.match(/"[a-z0-9\s\-/]*[\u4e00-\u9fa5]+[a-z0-9\s\-/«»()\u4e00-\u9fa5\uFF0C]*":/gi);
  if (!matched) {
    return resultString;
  }
  let sourceNames = matched.map((value) => value.replace(/["":]/g, ""));
  sourceNames = uniq(sourceNames.map((value) => value.includes("\xAB") ? value.split("\xAB")[0] : value));
  sourceNames.sort((a, b) => b.length - a.length);
  const dict = patchDict.get();
  const chunks = [];
  let chunk = [];
  for (let i = 0, size = 0, value = ""; i < sourceNames.length; i++) {
    value = dict[sourceNames[i]] || sourceNames[i];
    size += value.length;
    if (size <= 2e3) {
      chunk.push(value);
    } else {
      chunks.push(chunk);
      size = value.length;
      chunk = [value];
    }
  }
  chunks.push(chunk);
  const patched = await Promise.all(chunks.map((items) => toLatinWords(items))).then((values) => values.flat());
  const nextDict = {};
  const encodeSpaces = (str) => str.replace(/\u0020/g, "%20");
  patched.forEach((translated, idx) => {
    const sourceName = sourceNames[idx];
    if (sourceName) {
      const pattern = /\u0020/.test(sourceName) ? `(${sourceName}|${encodeSpaces(sourceName)})` : sourceName;
      resultString = resultString.replace(new RegExp(pattern, "g"), startCaseClassName(translated));
      nextDict[sourceName] = translated;
    }
  });
  patchDict.set(nextDict);
  return resultString;
};

// src/openapi.ts
var { camelCase, get, upperFirst } = import_lodash2.default;
var CONTENT_TYPES = {
  "*/*": "json",
  "application/json": "json",
  "application/hal+json": "json",
  "application/problem+json": "json",
  "application/geo+json": "json",
  "application/x-www-form-urlencoded": "form",
  "multipart/form-data": "multipart"
};
var _OpenApi = class _OpenApi {
  constructor(doc, opts) {
    this.doc = doc;
    this.opts = opts;
    this.tagMap = {};
    this.parsePaths = () => {
      const { paths } = this.doc;
      if (!paths) {
        return [];
      }
      return Object.entries(paths).map(([uri, item]) => this.parsePath(uri, item)).reduce((acc, operations) => acc.length ? [...acc, ...operations] : operations, []).filter(Boolean);
    };
    this.parsePath = (uri, pathItem) => {
      if (!pathItem) {
        return [];
      }
      return Object.entries(pathItem).map(
        ([method, operation]) => this.parseOperation(uri, method.toLocaleUpperCase(), operation, pathItem.parameters)
      ).filter(Boolean);
    };
    this.parseOperation = (uri, method, operation, pathLevelParameters = []) => {
      const { includes, excludes, useTagsForOperationId } = this.opts;
      const { tags, operationId: id, parameters: params = [], requestBody: body, responses, summary } = operation;
      if (includes && !includes.some((value) => typeof value === "string" ? value === uri : value.test(uri))) {
        return;
      }
      if (excludes && excludes.some((value) => typeof value === "string" ? value === uri : value.test(uri))) {
        return;
      }
      let operationId = id;
      if (useTagsForOperationId) {
        const tagName = (tags || []).filter(Boolean).map((value) => {
          var _a;
          return (((_a = this.tagMap[value]) == null ? void 0 : _a.name) || value).replace(/(c|C)ontroller$/, "");
        }).join(" ");
        const idName = (id || "").replace(/_\d+$/, "");
        operationId = camelCase(`${tagName} ${idName}`);
      }
      operationId = operationId == null ? void 0 : operationId.replace(/Using.+$/, "");
      const parameters = [...params, ...pathLevelParameters].map(this.resolve).filter((value) => value.in !== "header");
      const requestBody = this.resolve(body);
      const response = this.resolve(responses["200"] || responses.default);
      return {
        uri,
        operationId,
        method,
        parameters,
        requestBody,
        response,
        summary
      };
    };
    this.getDocument = () => this.doc;
    this.getPaths = () => this.parsePaths();
    this.getSchemas = () => {
      var _a;
      return ((_a = this.doc.components) == null ? void 0 : _a.schemas) || [];
    };
    this.isReference = (obj) => obj && "$ref" in obj;
    this.isNullable = (obj) => !!(obj && obj.nullable);
    this.getReferenceName = (ref) => {
      const { transformRefName = "camelCase" } = this.opts;
      const refName = ref.replace(/.+\//, "");
      if (transformRefName === "camelCase") {
        return upperFirst(camelCase(refName));
      }
      if (transformRefName === "keepIntact") {
        return refName;
      }
      return transformRefName(refName);
    };
    this.resolve = (reference) => {
      if (!this.isReference(reference)) {
        return reference;
      }
      const refPath = reference.$ref.slice(2).split("/").map((segment) => decodeURI(segment.replace(/~1/g, "/").replace(/~0/g, "~")));
      const result = get(this.doc, refPath);
      if (!result) {
        throw new Error(`Can't find ${refPath}`);
      }
      return this.resolve(result);
    };
    this.getSchemaFromContent = (content) => {
      const media = Object.keys(content)[0];
      if (!media || media.startsWith("text/")) {
        return { type: "string" };
      }
      const contentType = Object.keys(CONTENT_TYPES).find((value) => media.startsWith(value));
      const schema = contentType && get(content, [media, "schema"]);
      return schema || { type: "string", format: "binary" };
    };
    (this.doc.tags || []).forEach((tag) => {
      if (/[\u4e00-\u9fa5]/.test(tag.name) && tag.description) {
        this.tagMap[tag.name] = { name: tag.description, description: tag.name };
      } else {
        this.tagMap[tag.name] = { name: tag.name, description: tag.description };
      }
    });
  }
};
_OpenApi.initialize = async (opts) => {
  const { spec, transformDocument, ...rest } = opts;
  let doc = await import_swagger_parser.default.bundle(spec);
  if (!("openapi" in doc && doc.openapi.startsWith("3"))) {
    try {
      const pathname = rest.local.replace(/\.[^.]+$/, "");
      const dict = new PatchDict(import_path2.default.resolve(`${pathname}-dict.json`));
      const patchedJson = await patchJsonStringForSwagger2(JSON.stringify(doc), dict);
      doc = (await import_swagger2openapi.default.convertObj(JSON.parse(patchedJson), { patch: true })).openapi;
    } catch (error) {
      throw new Error(error.message);
    }
  }
  return new _OpenApi(transformDocument ? transformDocument(doc) : doc, rest);
};
var OpenApi = _OpenApi;

// src/generator.ts
var import_lodash3 = __toESM(require("lodash"));
var import_typescript2 = __toESM(require("typescript"));

// src/codegen.ts
var import_typescript = __toESM(require("typescript"));
var SyntaxToken = {
  question: import_typescript.default.factory.createToken(import_typescript.default.SyntaxKind.QuestionToken),
  dotdotdot: import_typescript.default.factory.createToken(import_typescript.default.SyntaxKind.DotDotDotToken)
};
var createSyntaxToken = (name, token) => {
  if (!token) {
    return void 0;
  }
  if (token === true) {
    return SyntaxToken[name];
  }
  return token;
};
var createQuestionToken = (token) => createSyntaxToken("question", token);
var createDotDotDotToken = (token) => createSyntaxToken("dotdotdot", token);
var createKeywordType = (type) => {
  switch (type) {
    case "unknown":
      return import_typescript.default.factory.createKeywordTypeNode(import_typescript.default.SyntaxKind.UnknownKeyword);
    case "any":
      return import_typescript.default.factory.createKeywordTypeNode(import_typescript.default.SyntaxKind.AnyKeyword);
    case "number":
      return import_typescript.default.factory.createKeywordTypeNode(import_typescript.default.SyntaxKind.NumberKeyword);
    case "object":
      return import_typescript.default.factory.createKeywordTypeNode(import_typescript.default.SyntaxKind.ObjectKeyword);
    case "string":
      return import_typescript.default.factory.createKeywordTypeNode(import_typescript.default.SyntaxKind.StringKeyword);
    case "boolean":
      return import_typescript.default.factory.createKeywordTypeNode(import_typescript.default.SyntaxKind.BooleanKeyword);
    case "undefined":
      return import_typescript.default.factory.createKeywordTypeNode(import_typescript.default.SyntaxKind.UndefinedKeyword);
    case "null":
      return import_typescript.default.factory.createLiteralTypeNode(import_typescript.default.factory.createNull());
  }
};
var keywordType = {
  unknown: void 0,
  any: void 0,
  number: void 0,
  object: void 0,
  string: void 0,
  boolean: void 0,
  undefined: void 0,
  null: void 0
};
Object.assign(keywordType, {
  unknown: createKeywordType("unknown"),
  any: createKeywordType("any"),
  number: createKeywordType("number"),
  object: createKeywordType("object"),
  string: createKeywordType("string"),
  boolean: createKeywordType("boolean"),
  undefined: createKeywordType("undefined"),
  null: createKeywordType("null")
});
var modifier = {
  async: import_typescript.default.factory.createModifier(import_typescript.default.SyntaxKind.AsyncKeyword),
  declare: import_typescript.default.factory.createModifier(import_typescript.default.SyntaxKind.DeclareKeyword),
  export: import_typescript.default.factory.createModifier(import_typescript.default.SyntaxKind.ExportKeyword)
};
var createTypeAliasDeclaration = (opts) => import_typescript.default.factory.createTypeAliasDeclaration(opts.modifiers, opts.name, opts.typeParameters, opts.type);
var createExpression = (expression) => typeof expression === "string" ? import_typescript.default.factory.createIdentifier(expression) : expression;
var createCall = (opts) => import_typescript.default.factory.createCallExpression(createExpression(opts.expression), opts.typeArgs, opts.args);
var isValidIdentifier = (str) => {
  if (!str.length || str.trim() !== str) {
    return false;
  }
  const node = import_typescript.default.parseIsolatedEntityName(str, import_typescript.default.ScriptTarget.Latest);
  return !!node && node.kind === import_typescript.default.SyntaxKind.Identifier && node.originalKeywordKind === void 0;
};
var propertyName = (name) => {
  if (typeof name === "string") {
    return isValidIdentifier(name) ? import_typescript.default.factory.createIdentifier(name) : import_typescript.default.factory.createStringLiteral(name);
  }
  return name;
};
var createPropertyAssignment = (name, expression) => {
  if (import_typescript.default.isIdentifier(expression) && expression.text === name) {
    return import_typescript.default.factory.createShorthandPropertyAssignment(name);
  }
  return import_typescript.default.factory.createPropertyAssignment(propertyName(name), expression);
};
var createPlainObjectLiteral = (props) => import_typescript.default.factory.createObjectLiteralExpression(
  props.map(
    ([key, value]) => createPropertyAssignment(
      key,
      typeof value === "number" ? import_typescript.default.factory.createNumericLiteral(value) : import_typescript.default.factory.createStringLiteral(value)
    )
  ),
  true
);
var createBlock = (statements) => import_typescript.default.factory.createBlock(statements, true);
var createVariableDeclaration = (opts) => import_typescript.default.factory.createVariableDeclarationList(
  [import_typescript.default.factory.createVariableDeclaration(opts.name, opts.exclamationToken, opts.type, opts.initializer)],
  opts.flags || import_typescript.default.NodeFlags.Const
);
var createVariableStatement = (opts) => import_typescript.default.factory.createVariableStatement(opts.modifiers, opts.declarationList);
var createFunctionDeclaration = (opts) => import_typescript.default.factory.createFunctionDeclaration(
  opts.modifiers,
  opts.asteriskToken,
  opts.name,
  opts.typeParameters,
  opts.parameters || [],
  opts.type,
  opts.body
);
var createParameter = (opts) => import_typescript.default.factory.createParameterDeclaration(
  opts.modifiers,
  createDotDotDotToken(opts.dotDotDotToken),
  opts.name,
  createQuestionToken(opts.questionToken),
  opts.type,
  opts.initializer
);
var createPropertySignature = (opts) => import_typescript.default.factory.createPropertySignature(
  opts.modifiers,
  propertyName(opts.name),
  createQuestionToken(opts.questionToken),
  opts.type
);
var createIndexSignature = (opts) => import_typescript.default.factory.createIndexSignature(
  opts.modifiers,
  [createParameter({ name: opts.indexName || "key", type: opts.indexType || keywordType.string })],
  opts.type
);
var createObjectBinding = (elements) => import_typescript.default.factory.createObjectBindingPattern(
  elements.map(
    ({ dotDotDotToken, propertyName: propName, name, initializer }) => import_typescript.default.factory.createBindingElement(createDotDotDotToken(dotDotDotToken), propName, name, initializer)
  )
);
var createTemplateString = (head, spans) => {
  if (!spans.length) {
    return import_typescript.default.factory.createStringLiteral(head);
  }
  return import_typescript.default.factory.createTemplateExpression(
    import_typescript.default.factory.createTemplateHead(head),
    spans.map(
      ({ expression, literal }, i) => import_typescript.default.factory.createTemplateSpan(
        expression,
        i === spans.length - 1 ? import_typescript.default.factory.createTemplateTail(literal) : import_typescript.default.factory.createTemplateMiddle(literal)
      )
    )
  );
};
var concatNodes = (nodes, ...rest) => import_typescript.default.factory.createNodeArray(nodes.concat(...rest));
var addMultiLineComment = (node, comment) => {
  if (!comment) {
    return node;
  }
  return import_typescript.default.addSyntheticLeadingComment(
    node,
    import_typescript.default.SyntaxKind.MultiLineCommentTrivia,
    `*
 * ${comment.replace(/\n/g, "\n * ")}
 `,
    true
  );
};
var addMultiLineTinyComment = (node, comment) => {
  if (!comment) {
    return node;
  }
  return import_typescript.default.addSyntheticLeadingComment(
    node,
    import_typescript.default.SyntaxKind.MultiLineCommentTrivia,
    `* ${comment.replace(/\n/g, ", ")} `,
    true
  );
};
var addSingleLineComment = (node, comment) => {
  if (!comment) {
    return node;
  }
  return import_typescript.default.addSyntheticLeadingComment(
    node,
    import_typescript.default.SyntaxKind.SingleLineCommentTrivia,
    `${comment.replace(/^\s*/, " ")}`,
    true
  );
};
var printer = import_typescript.default.createPrinter({
  newLine: import_typescript.default.NewLineKind.LineFeed,
  omitTrailingSemicolon: false
});
var decodeUnicodeEscapes = (value) => {
  return globalThis.unescape(value.replace(/\\u/g, "%u"));
};
var printFile = (sourceFile) => {
  return decodeUnicodeEscapes(printer.printFile(sourceFile));
};

// src/generator.ts
var { camelCase: camelCase2 } = import_lodash3.default;
var CountedName = class {
  constructor() {
    this.namesCount = {};
    this.checkout = (name) => {
      const count = this.namesCount[name] = (this.namesCount[name] || 0) + 1;
      return count > 1 ? name + count : name;
    };
    this.has = (name) => {
      return (this.namesCount[name] || 0) >= 1;
    };
  }
};
var _Generator = class _Generator {
  constructor(openapi, opts) {
    this.openapi = openapi;
    this.defs = [];
    this.enumDatas = [];
    this.requests = [];
    this.refs = {};
    this.refNames = new CountedName();
    this.reqNames = new CountedName();
    this.enumNames = new CountedName();
    this.runtimeImportNames = /* @__PURE__ */ new Set();
    this.createUnionTypeFromVariants = (variantsObject) => {
      const { variants, discriminator } = variantsObject;
      if (!discriminator) {
        return import_typescript2.default.factory.createUnionTypeNode(variants.map(this.createTypeFromSchemaOrReference));
      }
      if (discriminator.propertyName === void 0) {
        throw new Error("Discriminators require a propertyName");
      }
      const mappedValues = new Set(
        Object.values(discriminator.mapping || {}).map((ref) => this.openapi.getReferenceName(ref))
      );
      return import_typescript2.default.factory.createUnionTypeNode(
        [
          ...Object.entries(discriminator.mapping || {}).map(
            ([discriminatorValue, variantRef]) => [discriminatorValue, { $ref: variantRef }]
          ),
          ...variants.filter((variant) => {
            if (!this.openapi.isReference(variant)) {
              throw new Error("Discriminators require references, not inline schemas");
            }
            return !mappedValues.has(this.openapi.getReferenceName(variant.$ref));
          }).map((schema) => {
            const reference = schema;
            return [this.openapi.getReferenceName(reference.$ref), reference];
          })
        ].map(
          ([discriminatorValue, variant]) => import_typescript2.default.factory.createIntersectionTypeNode([
            import_typescript2.default.factory.createTypeLiteralNode([
              createPropertySignature({
                name: discriminator.propertyName,
                type: import_typescript2.default.factory.createLiteralTypeNode(import_typescript2.default.factory.createStringLiteral(discriminatorValue))
              })
            ]),
            this.createTypeFromSchemaOrReference(variant)
          ])
        )
      );
    };
    this.createTypeFromProperties = (propsObject) => {
      const { properties, required, additionalProperties } = propsObject;
      const members = Object.keys(properties).map((name) => {
        const schema = properties[name];
        const isRequired = required && required.includes(name);
        const type = this.createTypeFromSchemaOrReference(schema);
        return addMultiLineTinyComment(
          createPropertySignature({ name: this.getPropertyKeyName(name), questionToken: !isRequired, type }),
          schema.description
        );
      });
      if (additionalProperties) {
        members.push(createIndexSignature({ type: keywordType.any }));
      }
      const objectType = import_typescript2.default.factory.createTypeLiteralNode(members);
      const shouldFormData = Object.keys(properties).some((name) => {
        const schema = this.openapi.resolve(properties[name]);
        return schema.format === "binary";
      });
      if (shouldFormData) {
        this.runtimeImportNames.add("GenericFormData");
        return import_typescript2.default.factory.createTypeReferenceNode("GenericFormData", [objectType]);
      }
      return objectType;
    };
    this.createTypeFromEnum = (items) => {
      const types = items.map((item) => {
        if (item === null) {
          return keywordType.null;
        }
        if (typeof item === "boolean") {
          return item ? import_typescript2.default.factory.createLiteralTypeNode(import_typescript2.default.factory.createToken(import_typescript2.default.SyntaxKind.TrueKeyword)) : import_typescript2.default.factory.createLiteralTypeNode(import_typescript2.default.factory.createToken(import_typescript2.default.SyntaxKind.FalseKeyword));
        }
        if (typeof item === "number") {
          return import_typescript2.default.factory.createLiteralTypeNode(import_typescript2.default.factory.createNumericLiteral(item));
        }
        return import_typescript2.default.factory.createLiteralTypeNode(import_typescript2.default.factory.createStringLiteral(String(item)));
      });
      return types.length > 1 ? import_typescript2.default.factory.createUnionTypeNode(types) : types[0];
    };
    this.createTypeFromSchema = (schema) => {
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
              additionalProperties: schema.additionalProperties
            })
          );
        }
        return import_typescript2.default.factory.createIntersectionTypeNode(types);
      }
      if ("items" in schema) {
        return import_typescript2.default.factory.createArrayTypeNode(this.createTypeFromSchemaOrReference(schema.items));
      }
      if (schema.properties || schema.additionalProperties) {
        return this.createTypeFromProperties({
          properties: schema.properties || {},
          required: schema.required,
          additionalProperties: schema.additionalProperties
        });
      }
      if (schema.enum) {
        return this.createTypeFromEnum(schema.enum);
      }
      if (schema.format === "binary") {
        return import_typescript2.default.factory.createTypeReferenceNode("Blob");
      }
      if (schema.type) {
        if (schema.type in keywordType) {
          return keywordType[schema.type];
        }
        if (schema.type === "integer") {
          if (this.opts.useInt64AsString && schema.format === "int64") {
            return keywordType.string;
          }
          return keywordType.number;
        }
      }
      return keywordType.any;
    };
    this.createTypeFromResponse = (response) => {
      const { content } = response || {};
      if (!content) {
        return keywordType.unknown;
      }
      const schema = this.openapi.getSchemaFromContent(content);
      const responseType = this.createTypeFromSchemaOrReference(schema);
      if (this.opts.useDataOfResponse) {
        return import_typescript2.default.factory.createTypeReferenceNode(import_typescript2.default.factory.createIdentifier("DataOfResponse"), [responseType]);
      }
      return responseType;
    };
    this.createTypeFromSchemaOrReference = (schema) => {
      const type = this.openapi.isReference(schema) ? this.createTypeFromReference(schema) : this.createTypeFromSchema(schema);
      return this.openapi.isNullable(schema) ? import_typescript2.default.factory.createUnionTypeNode([type, keywordType.null]) : type;
    };
    this.createTypeFromReference = (reference) => {
      const ref = reference.$ref;
      if (!this.refs[ref]) {
        const name = this.refNames.checkout(this.openapi.getReferenceName(ref));
        this.refs[ref] = import_typescript2.default.factory.createTypeReferenceNode(name);
        this.collectTypeFromReference(name, reference);
      }
      return this.refs[ref];
    };
    this.collectTypeFromReference = (name, reference) => {
      const schema = this.openapi.resolve(reference);
      const type = this.createTypeFromSchema(schema);
      const declaration = createTypeAliasDeclaration({ modifiers: [modifier.export], name, type });
      this.defs.push(addMultiLineComment(declaration, schema.description));
      if (this.opts.useEnums && schema.enum && schema.format) {
        this.enumDatas.push({
          name: `${this.enumNames.checkout(name.replace(/Enum$/, ""))}Enum`,
          template: schema.format,
          description: schema.description
        });
      }
    };
    this.getNameIdentifier = (id) => {
      if (!id) {
        return;
      }
      if (id.match(/[^\w\s-/]/)) {
        return;
      }
      const result = camelCase2(id);
      if (isValidIdentifier(result)) {
        return result;
      }
    };
    this.uri2name = (uri) => {
      const pathParamRegex = /\{(.+?)\}/;
      for (let i = 0; pathParamRegex.test(uri); i++) {
        uri = uri.replace(pathParamRegex, `${i === 0 ? "by" : "and"} $1`);
      }
      return camelCase2(uri.replace(/^\/api/i, ""));
    };
    this.getPropertyKeyName = (value) => {
      if (this.opts.parameterNameCase === "snakeCase") {
        return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
      }
      if (typeof this.opts.parameterNameCase === "function") {
        return this.opts.parameterNameCase(value);
      }
      return value;
    };
    this.isBoxingRefQueryParam = (paramObject) => {
      if (!this.openapi.isReference(paramObject)) {
        return false;
      }
      const schema = this.openapi.resolve(paramObject);
      return schema.enum ? false : true;
    };
    this.getRequestFunctionName = (pathObject) => {
      const { uri, operationId, method } = pathObject;
      if (typeof this.opts.requestFunctionName === "function") {
        return this.opts.requestFunctionName(pathObject);
      }
      let name = this.opts.requestFunctionName === "uri" ? this.uri2name(uri) : this.getNameIdentifier(operationId) || this.uri2name(uri);
      this.reqNames.has(name) && (name = camelCase2(`${name} using ${method} `));
      return this.reqNames.checkout(name);
    };
    this.createRequestFunctionArguments = (pathObject) => {
      const { parameters, requestBody } = pathObject;
      const args = [];
      if (parameters.length) {
        const { name, cleanIfAlone } = this.opts.boxingRefQuery;
        if (cleanIfAlone && parameters.length === 1 && this.isBoxingRefQueryParam(parameters[0].schema)) {
          const type = this.createTypeFromSchemaOrReference(parameters[0].schema);
          args.push(createParameter({ name: _Generator.REQUEST_PARAMS, type }));
        } else {
          const type = import_typescript2.default.factory.createTypeLiteralNode(
            parameters.map(
              (param) => createPropertySignature({
                name: name && this.isBoxingRefQueryParam(param.schema) ? name : this.getPropertyKeyName(param.name),
                questionToken: !param.required,
                type: this.createTypeFromSchemaOrReference(param.schema)
              })
            )
          );
          args.push(createParameter({ name: _Generator.REQUEST_PARAMS, type }));
        }
      }
      if (requestBody) {
        const schema = this.openapi.getSchemaFromContent(requestBody.content);
        const type = this.createTypeFromSchemaOrReference(schema);
        args.push(createParameter({ name: _Generator.REQUEST_BODY, type, questionToken: !requestBody.required }));
      }
      args.push(
        createParameter({
          name: _Generator.REQUEST_OPTIONS,
          type: import_typescript2.default.factory.createTypeReferenceNode(_Generator.REQUEST_OPTIONS_TYPE),
          questionToken: true
        })
      );
      return args;
    };
    this.createRequestUri = (pathObject) => {
      const { uri, parameters } = pathObject;
      const spans = [];
      const head = uri.replace(/(.*?)\{(.+?)\}(.*?)(?=\{|$)/g, (_, headValue, name, literal) => {
        spans.push({
          expression: import_typescript2.default.factory.createIdentifier(this.getPropertyKeyName(camelCase2(name))),
          literal
        });
        return headValue;
      });
      const requestUri = createTemplateString(this.opts.uriPrefix + head, spans);
      if (!parameters.some((param) => param.in === "query")) {
        return requestUri;
      }
      this.runtimeImportNames.add("createUri");
      return createCall({
        expression: "createUri",
        args: [requestUri, import_typescript2.default.factory.createIdentifier(_Generator.REQUEST_QUERY_PARAM)]
      });
    };
    this.createRequestArguments = (pathObject) => {
      const { method, requestBody } = pathObject;
      const args = [this.createRequestUri(pathObject)];
      const init = [];
      if (method !== "GET") {
        init.push(createPropertyAssignment("method", import_typescript2.default.factory.createStringLiteral(method)));
      }
      if (requestBody) {
        init.push(import_typescript2.default.factory.createShorthandPropertyAssignment(_Generator.REQUEST_BODY));
      }
      init.push(import_typescript2.default.factory.createSpreadAssignment(import_typescript2.default.factory.createIdentifier(_Generator.REQUEST_OPTIONS)));
      args.push(import_typescript2.default.factory.createObjectLiteralExpression(init));
      return args;
    };
    this.createRequestFunctionBody = (pathObject) => {
      const { parameters, response } = pathObject;
      const statements = [];
      if (parameters.length) {
        const { name, cleanIfAlone } = this.opts.boxingRefQuery;
        const getQueryParamElements = () => {
          const refQuery = parameters.find((param) => this.isBoxingRefQueryParam(param.schema));
          if (refQuery && (!cleanIfAlone || cleanIfAlone && parameters.length > 1)) {
            const queryName = name || refQuery.name;
            return queryName === _Generator.REQUEST_QUERY_PARAM ? [{ name: queryName }] : [{ name: _Generator.REQUEST_QUERY_PARAM, propertyName: queryName }];
          }
          return parameters.some((param) => param.in === "query") ? [{ name: "query", dotDotDotToken: true }] : [];
        };
        const paramsVariable = createVariableStatement({
          declarationList: createVariableDeclaration({
            name: createObjectBinding([
              ...parameters.filter((param) => param.in === "path").map((param) => ({ name: this.getPropertyKeyName(param.name) })),
              ...getQueryParamElements()
            ]),
            initializer: import_typescript2.default.factory.createIdentifier(_Generator.REQUEST_PARAMS)
          })
        });
        statements.push(paramsVariable);
      }
      const requestCall = createCall({
        expression: import_typescript2.default.factory.createIdentifier(_Generator.REQUEST_HANDLER),
        typeArgs: [this.createTypeFromResponse(response)],
        args: this.createRequestArguments(pathObject)
      });
      statements.push(import_typescript2.default.factory.createReturnStatement(requestCall));
      return createBlock(statements);
    };
    this.reset = () => {
      this.defs = [];
      this.enumDatas = [];
      this.requests = [];
      this.refs = {};
      this.refNames = new CountedName();
      this.reqNames = new CountedName();
      return this;
    };
    this.build = () => {
      this.reset();
      const paths = this.openapi.getPaths();
      this.requests = paths.map((pathObject) => {
        const { uri, summary } = pathObject;
        pathObject.parameters = pathObject.parameters.map((param) => ({ ...param, name: camelCase2(param.name) }));
        const fnName = this.getRequestFunctionName(pathObject);
        const fnArgs = this.createRequestFunctionArguments(pathObject);
        const fnBody = this.createRequestFunctionBody(pathObject);
        return addMultiLineComment(
          createFunctionDeclaration({
            modifiers: [modifier.export],
            name: fnName,
            parameters: fnArgs,
            body: fnBody
          }),
          `${summary || "unknown"} ${uri}`
        );
      });
      const enumDeclarationList = createVariableDeclaration({
        name: "enums",
        initializer: import_typescript2.default.factory.createObjectLiteralExpression(
          this.enumDatas.map((enumData) => {
            const template = JSON.parse(enumData.template);
            const args = [
              import_typescript2.default.factory.createAsExpression(
                import_typescript2.default.factory.createArrayLiteralExpression(
                  template.map((item) => {
                    const enumItem = createPlainObjectLiteral([
                      ...Object.entries(item).slice(0, 2),
                      ["name", item.desc || "unknown"]
                    ]);
                    return addSingleLineComment(enumItem, item.desc);
                  })
                ),
                import_typescript2.default.factory.createTypeReferenceNode("const")
              )
            ];
            const enumObject = createPropertyAssignment(enumData.name, createCall({ expression: "createEnum", args }));
            return addSingleLineComment(enumObject, enumData.description);
          })
        )
      });
      this.enumGather = addMultiLineComment(
        createVariableStatement({ modifiers: [modifier.export], declarationList: enumDeclarationList }),
        "Enum collection"
      );
      if (this.enumDatas.length) {
        this.runtimeImportNames.add("createEnum");
      }
      return this;
    };
    this.bundle = () => {
      if (!this.defs.length || !this.requests.length) {
        this.build();
      }
      const runtimeImport = Array.from(this.runtimeImportNames).join(", ");
      const banner = `
${runtimeImport ? `import { ${runtimeImport} } from '@vvedo/openapi-ts'` : ""}
${this.opts.importRequestStatement}
`;
      const sourceFile = import_typescript2.default.createSourceFile("placeholder.ts", banner, import_typescript2.default.ScriptTarget.ESNext, true, import_typescript2.default.ScriptKind.TS);
      Object.assign(sourceFile, {
        statements: concatNodes(sourceFile.statements, this.defs, [this.enumGather].filter(Boolean), this.requests)
      });
      return printFile(sourceFile);
    };
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
      requestFunctionName: useUriForRequestName ? "uri" : requestFunctionName,
      parameterNameCase: useSnakeCaseForPropName ? "snakeCase" : parameterNameCase,
      useEnums: true,
      useDataOfResponse: true,
      boxingRefQuery: { cleanIfAlone: true, ...boxingRefQuery },
      uriPrefix: uriPrefix ? `/${uriPrefix.replace(/(^\/|\/$)/g, "")}` : "",
      ...rest
    };
    if (this.opts.useDataOfResponse) {
      this.runtimeImportNames.add("DataOfResponse");
    }
  }
  getRequestSum() {
    return this.requests.length;
  }
};
_Generator.REQUEST_HANDLER = "request";
_Generator.REQUEST_OPTIONS = "opts";
_Generator.REQUEST_OPTIONS_TYPE = "ReqOpts";
_Generator.REQUEST_QUERY_PARAM = "query";
_Generator.REQUEST_PARAMS = "params";
_Generator.REQUEST_BODY = "data";
var Generator = _Generator;

// src/index.ts
var OpenApiGenerator = class _OpenApiGenerator {
  constructor(opts) {
    this.opts = opts;
    this.normalizeOptions = (idx) => {
      const { source, dest, importRequestStatement, prettierConfig, formatter, ...rest } = this.opts[idx];
      const seekFormatter = () => {
        try {
          require.resolve("prettier");
          return "prettier";
        } catch {
        }
        try {
          require.resolve("@biomejs/biome");
          return "biome";
        } catch {
        }
      };
      return {
        source: Array.isArray(source) ? source : [source],
        dest: (Array.isArray(dest) ? dest : [dest]).map((value) => import_path3.default.resolve(value)),
        importRequestStatement: importRequestStatement || "import request, { ReqOpts } from '@/shared/nxios'",
        formatter: prettierConfig ? "prettier" : formatter || seekFormatter(),
        ...rest
      };
    };
    this.output = (dest, code) => {
      if (!import_fs2.default.existsSync(dest)) {
        const dir = import_path3.default.dirname(dest);
        import_fs2.default.mkdirSync(dir, { recursive: true });
      }
      import_fs2.default.writeFileSync(dest, code);
    };
    this.report = (_data) => {
    };
    this.generate = async (params) => {
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
          excludes
        });
        const generator = new Generator(openapi, restGenerator);
        const code = generator.bundle();
        this.output(dest[i], transformCode ? transformCode(code) : code);
        if (formatter === "prettier") {
          (0, import_child_process.execSync)(`npx prettier --parser=babel-ts --write ${dest[i]}`);
        } else if (formatter === "biome") {
          (0, import_child_process.execSync)(`npx biome lint --write ${dest[i]}`);
        }
        requestSum += generator.getRequestSum();
      }
      this.report({ sum: requestSum, config: { source, formatter, ...rest } });
    };
    this.startMockServer = async (params) => {
      const { source, dest, transformDocument } = this.opts[params.idx];
      const openapi = await OpenApi.initialize({
        spec: Array.isArray(source) ? source[0] : source,
        local: Array.isArray(dest) ? dest[0] : dest,
        transformDocument
      });
      try {
        const OpenApiMocker = require("open-api-mocker");
        const mocker = new OpenApiMocker({ schema: openapi.getDocument(), port: params.port });
        await mocker.validate();
        await mocker.mock();
      } catch (error) {
        if (error.code === "MODULE_NOT_FOUND" && error.message.startsWith("Cannot find module 'ajv/lib/refs/json-schema-draft-04.json'")) {
          console.log(
            "OpenApiMocker failed: ajv dependency not found. With pnpm, add a package extension for ajv-openapi."
          );
        } else {
          throw error;
        }
      }
    };
  }
  static initialize(opts) {
    return new _OpenApiGenerator(Array.isArray(opts) ? opts : [opts]);
  }
};
var defineConfig = (config) => config;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OpenApiGenerator,
  defineConfig
});
