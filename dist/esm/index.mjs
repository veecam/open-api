// src/runtime/index.ts
import qs from "query-string";
var createUri = (pathname, query) => {
  return [pathname, query && qs.stringify(query)].filter(Boolean).join("?");
};
var createEnum = (template) => {
  const map = template.reduce((result, item) => {
    Object.defineProperty(result, item.key, { value: item.value, enumerable: true });
    return result;
  }, /* @__PURE__ */ Object.create(null));
  const get = (key) => template.find((item) => item.key === key);
  const pick = (value) => template.find((item) => item.value == value);
  const equal = (key, value) => map[key] == value;
  const values = () => template;
  const changeNames = (names) => {
    return createEnum(
      template.map((item) => ({
        key: item.key,
        value: item.value,
        name: names[item.key] || item.name
      }))
    );
  };
  Object.defineProperty(map, "get", { value: get });
  Object.defineProperty(map, "pick", { value: pick });
  Object.defineProperty(map, "equal", { value: equal });
  Object.defineProperty(map, "values", { value: values });
  Object.defineProperty(map, "changeNames", { value: changeNames });
  Object.freeze(map);
  return map;
};
export {
  createEnum,
  createUri
};
