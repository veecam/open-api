import ts from 'typescript';

export const SyntaxToken = {
  question: ts.factory.createToken(ts.SyntaxKind.QuestionToken),
  dotdotdot: ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
};

const createSyntaxToken = <K extends keyof typeof SyntaxToken>(
  name: K,
  token?: boolean | (typeof SyntaxToken)[K],
) => {
  if (!token) {
    return undefined;
  }

  if (token === true) {
    return SyntaxToken[name];
  }

  return token;
};

export const createQuestionToken = (token?: boolean | ts.QuestionToken) => createSyntaxToken('question', token);
export const createDotDotDotToken = (token?: boolean | ts.DotDotDotToken) => createSyntaxToken('dotdotdot', token);

const createKeywordType = (type: keyof typeof keywordType) => {
  switch (type) {
    case 'unknown':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    case 'any':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    case 'number':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    case 'object':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword);
    case 'string':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    case 'boolean':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    case 'undefined':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
    case 'null':
      return ts.factory.createLiteralTypeNode(ts.factory.createNull());
  }
};

export const keywordType = {
  unknown: undefined as unknown as ts.TypeNode,
  any: undefined as unknown as ts.TypeNode,
  number: undefined as unknown as ts.TypeNode,
  object: undefined as unknown as ts.TypeNode,
  string: undefined as unknown as ts.TypeNode,
  boolean: undefined as unknown as ts.TypeNode,
  undefined: undefined as unknown as ts.TypeNode,
  null: undefined as unknown as ts.TypeNode,
};

Object.assign(keywordType, {
  unknown: createKeywordType('unknown'),
  any: createKeywordType('any'),
  number: createKeywordType('number'),
  object: createKeywordType('object'),
  string: createKeywordType('string'),
  boolean: createKeywordType('boolean'),
  undefined: createKeywordType('undefined'),
  null: createKeywordType('null'),
});

export const modifier = {
  async: ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword),
  declare: ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
  export: ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
};

export const createTypeAliasDeclaration = (opts: {
  modifiers?: ts.Modifier[];
  name: string | ts.Identifier;
  typeParameters?: ts.TypeParameterDeclaration[];
  type: ts.TypeNode;
}) => ts.factory.createTypeAliasDeclaration(opts.modifiers, opts.name, opts.typeParameters, opts.type);

export const createExpression = (expression: string | ts.Expression) =>
  typeof expression === 'string' ? ts.factory.createIdentifier(expression) : expression;

export const createCall = (opts: {
  expression: string | ts.Expression;
  typeArgs?: ts.TypeNode[];
  args?: ts.Expression[];
}) => ts.factory.createCallExpression(createExpression(opts.expression), opts.typeArgs, opts.args);

export const isValidIdentifier = (str: string) => {
  if (!str.length || str.trim() !== str) {
    return false;
  }

  const node = ts.parseIsolatedEntityName(str, ts.ScriptTarget.Latest);
  return !!node && node.kind === ts.SyntaxKind.Identifier && node.originalKeywordKind === undefined;
};

export const propertyName = (name: string | ts.PropertyName) => {
  if (typeof name === 'string') {
    return isValidIdentifier(name) ? ts.factory.createIdentifier(name) : ts.factory.createStringLiteral(name);
  }

  return name;
};

export const createPropertyAssignment = (name: string, expression: ts.Expression) => {
  if (ts.isIdentifier(expression) && expression.text === name) {
    return ts.factory.createShorthandPropertyAssignment(name);
  }

  return ts.factory.createPropertyAssignment(propertyName(name), expression);
};

export const createPlainObjectLiteral = (props: [string, string | number][]) =>
  ts.factory.createObjectLiteralExpression(
    props.map(([key, value]) =>
      createPropertyAssignment(
        key,
        typeof value === 'number' ? ts.factory.createNumericLiteral(value) : ts.factory.createStringLiteral(value),
      ),
    ),
    true,
  );

export const createBlock = (statements: ts.Statement[]) => ts.factory.createBlock(statements, true);

export const createVariableDeclaration = (opts: {
  name: string | ts.BindingName;
  exclamationToken?: ts.ExclamationToken;
  type?: ts.TypeNode;
  initializer?: ts.Expression;
  flags?: ts.NodeFlags;
}) =>
  ts.factory.createVariableDeclarationList(
    [ts.factory.createVariableDeclaration(opts.name, opts.exclamationToken, opts.type, opts.initializer)],
    opts.flags || ts.NodeFlags.Const,
  );

export const createVariableStatement = (opts: {
  modifiers?: ts.Modifier[];
  declarationList: ts.VariableDeclarationList;
}) => ts.factory.createVariableStatement(opts.modifiers, opts.declarationList);

export const createFunctionDeclaration = (opts: {
  modifiers?: ts.Modifier[];
  asteriskToken?: ts.AsteriskToken;
  name?: string | ts.Identifier;
  typeParameters?: ts.TypeParameterDeclaration[];
  parameters?: ts.ParameterDeclaration[];
  type?: ts.TypeNode;
  body?: ts.Block;
}) =>
  ts.factory.createFunctionDeclaration(
    opts.modifiers,
    opts.asteriskToken,
    opts.name,
    opts.typeParameters,
    opts.parameters || [],
    opts.type,
    opts.body,
  );

export const createParameter = (opts: {
  modifiers?: ts.Modifier[];
  dotDotDotToken?: boolean | ts.DotDotDotToken;
  name: string | ts.BindingName;
  questionToken?: boolean | ts.QuestionToken;
  type?: ts.TypeNode;
  initializer?: ts.Expression;
}) =>
  ts.factory.createParameterDeclaration(
    opts.modifiers,
    createDotDotDotToken(opts.dotDotDotToken),
    opts.name,
    createQuestionToken(opts.questionToken),
    opts.type,
    opts.initializer,
  );

export const createPropertySignature = (opts: {
  modifiers?: ts.Modifier[];
  name: string | ts.PropertyName;
  questionToken?: boolean | ts.QuestionToken;
  type?: ts.TypeNode;
}) =>
  ts.factory.createPropertySignature(
    opts.modifiers,
    propertyName(opts.name),
    createQuestionToken(opts.questionToken),
    opts.type,
  );

export const createIndexSignature = (opts: {
  modifiers?: ts.Modifier[];
  indexName?: string;
  indexType?: ts.TypeNode;
  type: ts.TypeNode;
}) =>
  ts.factory.createIndexSignature(
    opts.modifiers,
    [createParameter({ name: opts.indexName || 'key', type: opts.indexType || keywordType.string })],
    opts.type,
  );

export const createObjectBinding = (
  elements: {
    dotDotDotToken?: boolean | ts.DotDotDotToken;
    propertyName?: string | ts.PropertyName;
    name: string | ts.BindingName;
    initializer?: ts.Expression;
  }[],
) =>
  ts.factory.createObjectBindingPattern(
    elements.map(({ dotDotDotToken, propertyName: propName, name, initializer }) =>
      ts.factory.createBindingElement(createDotDotDotToken(dotDotDotToken), propName, name, initializer),
    ),
  );

export const createTemplateString = (
  head: string,
  spans: { expression: ts.Expression; literal: string }[],
) => {
  if (!spans.length) {
    return ts.factory.createStringLiteral(head);
  }

  return ts.factory.createTemplateExpression(
    ts.factory.createTemplateHead(head),
    spans.map(({ expression, literal }, i) =>
      ts.factory.createTemplateSpan(
        expression,
        i === spans.length - 1 ? ts.factory.createTemplateTail(literal) : ts.factory.createTemplateMiddle(literal),
      ),
    ),
  );
};

export const concatNodes = <T extends ts.Node>(nodes: readonly T[], ...rest: readonly T[][]) =>
  ts.factory.createNodeArray(nodes.concat(...rest));

export const addMultiLineComment = <T extends ts.Node>(node: T, comment?: string) => {
  if (!comment) {
    return node;
  }

  return ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `*
 * ${comment.replace(/\n/g, '\n * ')}
 `,
    true,
  );
};

export const addMultiLineTinyComment = <T extends ts.Node>(node: T, comment?: string) => {
  if (!comment) {
    return node;
  }

  return ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `* ${comment.replace(/\n/g, ', ')} `,
    true,
  );
};

export const addSingleLineComment = <T extends ts.Node>(node: T, comment?: string) => {
  if (!comment) {
    return node;
  }

  return ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.SingleLineCommentTrivia,
    `${comment.replace(/^\s*/, ' ')}`,
    true,
  );
};

const printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed,
  omitTrailingSemicolon: false,
});

const decodeUnicodeEscapes = (value: string) => {
  return globalThis.unescape(value.replace(/\\u/g, '%u'));
};

export const printFile = (sourceFile: ts.SourceFile) => {
  return decodeUnicodeEscapes(printer.printFile(sourceFile));
};
