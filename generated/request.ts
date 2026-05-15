export type ReqOpts = {
  method?: string;
  data?: unknown;
};

export default function request<T>(_url: string, _opts?: ReqOpts): Promise<T> {
  return Promise.resolve(undefined as T);
}

