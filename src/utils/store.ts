import Store from 'electron-store';

const store = new Store() as unknown as {
  get: (key?: string | undefined) => string | undefined | any
  set: (key: string, value: any) => void,
  delete: (key: string) => void,
  clear: () => void,
  keys: () => string[],
  values: () => any[],
  size: () => number,
  has: (key: string) => boolean,
}

export default store;