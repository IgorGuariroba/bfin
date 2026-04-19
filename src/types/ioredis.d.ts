declare module "ioredis" {
  export interface RedisOptions {
    retryStrategy?: (times: number) => number | void;
    maxRetriesPerRequest?: number;
  }

  export default class Redis {
    constructor(url: string, options?: RedisOptions);
    pipeline(): {
      set(key: string, value: string, ...args: (string | number)[]): Pipeline;
      sadd(key: string, member: string): Pipeline;
      del(key: string): Pipeline;
      srem(key: string, member: string): Pipeline;
      exec(): Promise<unknown[]>;
    };
    get(key: string): Promise<string | null>;
    expire(key: string, seconds: number): Promise<number>;
    exists(key: string): Promise<number>;
    quit(): Promise<void>;
  }

  interface Pipeline {
    set(key: string, value: string, ...args: (string | number)[]): Pipeline;
    sadd(key: string, member: string): Pipeline;
    del(key: string): Pipeline;
    srem(key: string, member: string): Pipeline;
  }
}
