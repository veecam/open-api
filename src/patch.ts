import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { stringify } from 'query-string';
import lodash from 'lodash';
import { pinyin } from 'pinyin-pro';

const { startCase, uniq } = lodash;

const visitArrayItems = (arr: unknown[], visitor: (item: unknown) => void) => {
  arr.forEach((item) => {
    if (Array.isArray(item)) {
      visitArrayItems(item, visitor);
    } else {
      visitor(item);
    }
  });
};

const translate = async (text: string[]) => {
  if (text.length === 0) {
    return [];
  }

  const uri = 'https://translate.googleapis.com/translate_a/t';
  const query = { client: 'gtx', sl: 'zh-CN', tl: 'en', q: text };

  return axios({
    url: `${uri}?${stringify(query)}`,
    method: 'GET',
    withCredentials: false,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  })
    .then((response) => response.data)
    .then((rawResponse) => {
      try {
        if (!Array.isArray(rawResponse)) {
          throw new Error('Unexpected response');
        }

        const intermediateTexts: string[] = [];
        visitArrayItems(rawResponse, (item) => {
          if (typeof item === 'string') {
            intermediateTexts.push(item);
          }
        });

        const result: string[] = [];
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
          console.warn('Translation result', result);
          throw new Error('Mismatching lengths of original and translated arrays');
        }

        return result;
      } catch (error) {
        console.warn('Got response', rawResponse);
        throw error;
      }
    });
};

const startCaseClassName = (name: string) => {
  const words = startCase(name).split(' ');
  return words.join('');
};

const toLatinWords = async (values: string[]) => {
  try {
    return await translate(values);
  } catch {
    return values.map((value) => pinyin(value, { toneType: 'none', type: 'array' }).join(' '));
  }
};

export class PatchDict {
  constructor(private filePath: string) {
    if (!fs.existsSync(this.filePath)) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    }
  }

  get() {
    if (!fs.existsSync(this.filePath)) {
      return {} as Record<string, string>;
    }

    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Record<string, string>;
  }

  set(data: Record<string, string>) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
}

export const patchJsonStringForSwagger2 = async (jsonString: string, patchDict: PatchDict) => {
  let resultString = jsonString;
  const matched = jsonString.match(/"[a-z0-9\s\-/]*[\u4e00-\u9fa5]+[a-z0-9\s\-/«»()\u4e00-\u9fa5\uFF0C]*":/gi);

  if (!matched) {
    return resultString;
  }

  let sourceNames = matched.map((value) => value.replace(/["":]/g, ''));
  sourceNames = uniq(sourceNames.map((value) => (value.includes('«') ? value.split('«')[0] : value)));
  sourceNames.sort((a, b) => b.length - a.length);

  const dict = patchDict.get();
  const chunks: string[][] = [];
  let chunk: string[] = [];

  for (let i = 0, size = 0, value = ''; i < sourceNames.length; i++) {
    value = dict[sourceNames[i]] || sourceNames[i];
    size += value.length;

    if (size <= 2000) {
      chunk.push(value);
    } else {
      chunks.push(chunk);
      size = value.length;
      chunk = [value];
    }
  }

  chunks.push(chunk);

  const patched = await Promise.all(chunks.map((items) => toLatinWords(items))).then((values) => values.flat());
  const nextDict: Record<string, string> = {};
  const encodeSpaces = (str: string) => str.replace(/\u0020/g, '%20');

  patched.forEach((translated, idx) => {
    const sourceName = sourceNames[idx];
    if (sourceName) {
      const pattern = /\u0020/.test(sourceName)
        ? `(${sourceName}|${encodeSpaces(sourceName)})`
        : sourceName;
      resultString = resultString.replace(new RegExp(pattern, 'g'), startCaseClassName(translated));
      nextDict[sourceName] = translated;
    }
  });

  patchDict.set(nextDict);
  return resultString;
};
