declare const createUri: (pathname: string, query?: Record<string, any>) => string;
type DataOfResponse<R> = R extends {
    data?: infer T;
} ? T | undefined : unknown;
interface GenericFormData<T extends Record<string, string | Blob>> extends FormData {
    append<K extends keyof T>(name: K, value: string): void;
    append<K extends keyof T>(name: K, value: string | Blob): void;
    append<K extends keyof T>(name: K, value: Blob, fileName?: string): void;
    delete(name: keyof T): void;
    get(name: keyof T): FormDataEntryValue | null;
    getAll(name: keyof T): FormDataEntryValue[];
    has(name: keyof T): boolean;
    set<K extends keyof T>(name: K, value: string): void;
    set<K extends keyof T>(name: K, value: string | Blob): void;
    set<K extends keyof T>(name: K, value: Blob, fileName?: string): void;
}
type EnumTemplate = readonly {
    readonly key: string;
    readonly value: string | number;
    readonly name: string;
    readonly desc?: string;
}[];
type WritableEnumItem<T extends EnumTemplate> = T[number] extends infer I ? {
    -readonly [P in keyof I]: T[number][P];
} : never;
declare const createEnum: <T extends EnumTemplate>(template: T) => Record<T[number]["key"], T[number]["value"]> & {
    get: (key: T[number]["key"]) => {
        readonly key: string;
        readonly value: string | number;
        readonly name: string;
        readonly desc?: string | undefined;
    } | undefined;
    pick: (value: string | number) => {
        readonly key: string;
        readonly value: string | number;
        readonly name: string;
        readonly desc?: string | undefined;
    } | undefined;
    equal: (key: T[number]["key"], value: string | number) => boolean;
    values: () => WritableEnumItem<T>[];
    changeNames: (names: Partial<Record<T[number]["key"], string>>) => Record<T[number]["key"], T[number]["value"]> & any;
};

export { type DataOfResponse, type GenericFormData, createEnum, createUri };
