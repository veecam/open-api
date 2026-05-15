import qs from 'query-string';

export const createUri = (pathname: string, query?: Record<string, any>) => {
  return [pathname, query && qs.stringify(query)].filter(Boolean).join('?');
};

export type DataOfResponse<R> = R extends { data?: infer T } ? T | undefined : unknown;

export interface GenericFormData<T extends Record<string, string | Blob>> extends FormData {
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

type WritableEnumItem<T extends EnumTemplate> = T[number] extends infer I
  ? { -readonly [P in keyof I]: T[number][P] }
  : never;

export const createEnum = <T extends EnumTemplate>(template: T) => {
  const map = template.reduce<Record<string, string | number>>((result, item) => {
    Object.defineProperty(result, item.key, { value: item.value, enumerable: true });
    return result;
  }, Object.create(null));

  const get = (key: T[number]['key']) => template.find((item) => item.key === key);
  const pick = (value: string | number) => template.find((item) => item.value == value);
  const equal = (key: T[number]['key'], value: string | number) => map[key] == value;
  const values = () => template as unknown as WritableEnumItem<T>[];
  const changeNames = (names: Partial<Record<T[number]['key'], string>>) => {
    return createEnum(
      template.map((item) => ({
        key: item.key,
        value: item.value,
        name: names[item.key as T[number]['key']] || item.name,
      })) as unknown as T,
    );
  };

  Object.defineProperty(map, 'get', { value: get });
  Object.defineProperty(map, 'pick', { value: pick });
  Object.defineProperty(map, 'equal', { value: equal });
  Object.defineProperty(map, 'values', { value: values });
  Object.defineProperty(map, 'changeNames', { value: changeNames });
  Object.freeze(map);

  return map as Record<T[number]['key'], T[number]['value']> & {
    get: typeof get;
    pick: typeof pick;
    equal: typeof equal;
    values: typeof values;
    changeNames: typeof changeNames;
  };
};
