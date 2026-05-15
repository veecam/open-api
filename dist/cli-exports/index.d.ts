import { OpenAPIV3 } from 'openapi-types';

type OpenAPIContentObject = {
    [media: string]: OpenAPIV3.MediaTypeObject;
};
type OpenAPISchemaOrReferenceObject = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
type OpenAPIPathsObject = ReturnType<OpenApi['getPaths']>;
type OpenAPIPathObject = OpenAPIPathsObject[number];
type OpenApiOptions = {
    spec: string;
    local: string;
    transformDocument?: (value: OpenAPIV3.Document) => OpenAPIV3.Document;
    useTagsForOperationId?: boolean;
    transformRefName?: 'camelCase' | 'keepIntact' | ((value: string) => string);
    includes?: (string | RegExp)[];
    excludes?: (string | RegExp)[];
};
declare class OpenApi {
    private doc;
    private opts;
    private tagMap;
    private constructor();
    static initialize: (opts: OpenApiOptions) => Promise<OpenApi>;
    private parsePaths;
    private parsePath;
    private parseOperation;
    getDocument: () => OpenAPIV3.Document<{}>;
    getPaths: () => {
        uri: string;
        operationId: string | undefined;
        method: string;
        parameters: OpenAPIV3.ParameterObject[];
        requestBody: OpenAPIV3.RequestBodyObject | undefined;
        response: OpenAPIV3.ResponseObject;
        summary: string | undefined;
    }[];
    getSchemas: () => never[] | {
        [key: string]: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
    };
    isReference: (obj: any) => obj is OpenAPIV3.ReferenceObject;
    isNullable: (obj: any) => boolean;
    getReferenceName: (ref: string) => string;
    resolve: <T>(reference: OpenAPIV3.ReferenceObject | T) => T;
    getSchemaFromContent: (content: OpenAPIContentObject) => OpenAPISchemaOrReferenceObject;
}

type GeneratorOptions = {
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

type OpenApiGeneratorOptions = {
    source: string | string[];
    dest: string | string[];
    prettierConfig?: object;
    formatter?: 'prettier' | 'biome';
    transformCode?: (code: string) => string;
} & Omit<OpenApiOptions, 'spec' | 'local'> & GeneratorOptions;
declare class OpenApiGenerator {
    private opts;
    static initialize(opts: OpenApiGeneratorOptions | OpenApiGeneratorOptions[]): OpenApiGenerator;
    constructor(opts: OpenApiGeneratorOptions[]);
    private normalizeOptions;
    private output;
    private report;
    generate: (params?: {
        idx?: number | number[];
    }) => Promise<void>;
    startMockServer: (params: {
        idx: number;
        port?: number;
    }) => Promise<void>;
}
declare const defineConfig: (config: OpenApiGeneratorOptions | OpenApiGeneratorOptions[]) => OpenApiGeneratorOptions | OpenApiGeneratorOptions[];

export { OpenApiGenerator, type OpenApiGeneratorOptions, defineConfig };
