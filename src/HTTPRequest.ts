import {HTTPRequestState} from "./HTTPRequestState";
import {NonArray} from "@noxy/utility-types";
import {HTTPMethod, HTTPStatusCode, HTTPStatusMessage} from "@noxy/http-utils";

export class HTTPRequest<Response = any, Request extends HTTPRequestObject = {}> {

  #data: Request;
  #path: string;
  #state: HTTPRequestState;
  #method: HTTPMethod;
  #aborted: boolean;
  #request: XMLHttpRequest;
  #timeout?: number;
  #promise?: Promise<Response>;
  #progress: number;

  public onStart?: ProgressEventHandler;
  public onProgress?: ProgressEventHandler;
  public onComplete?: ProgressEventHandler;

  public get path() {
    return this.#path;
  }

  public get state() {
    return this.#state;
  }

  public get method() {
    return this.#method;
  }

  public get progress() {
    return this.#progress;
  }

  public set path(path: string) {
    this.#path = path;
  }

  public set method(method: HTTPMethod) {
    this.#method = method;
  }

  public set timeout(ms: number) {
    this.#timeout = ms;
  }

  constructor(initializer: HTTPRequestInitializer<Request>) {
    this.#path = initializer.path;
    this.#method = initializer.method;
    this.#timeout = initializer.timeout;

    this.#data = initializer.data ?? {} as Request;
    this.#request = new XMLHttpRequest();
    this.#aborted = false;

    this.#state = HTTPRequestState.READY;
    this.#progress = 0;

    this.onStart = initializer.onStart;
    this.onProgress = initializer.onProgress;
    this.onComplete = initializer.onComplete;
  }

  private __append<K extends keyof Request>(key: K, value: Request[K]) {
    const param = this.#data[key];
    if (param === undefined) {
      this.#data[key] = value;
    }
    else if (Array.isArray(param)) {
      this.#data[key] = [...param, value] as Request[K];
    }
    else {
      this.#data[key] = [param, value] as Request[K];
    }
  }

  public append<K extends keyof Request>(key: K, ...values: Request[K][]) {
    for (let i = 0; i < values.length; i++) {
      const value = values.at(i);
      if (!value) continue;
      this.__append(key, value);
    }

    return this;
  }

  init() {
    if (this.#promise) return this.#promise;
    return this.#promise = new Promise<Response>((resolve, reject) => {
      this.#request.open(this.#method, this.#path);
      this.#request.timeout = this.#timeout ?? 60000;
      this.#state = HTTPRequestState.OPENED;

      this.#request.onloadstart = event => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.LOADING;
        this.onStart?.(event);
      };

      this.#request.onprogress = event => {
        if (this.#aborted) return this.#request.abort();
        this.onProgress?.(event);
      };

      this.#request.onload = event => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.DONE;
        this.onComplete?.(event);
        console.log("resolving");
        resolve(this.#request.response);
      };

      this.#request.onerror = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.ERROR;
        reject({"error": true});
      };

      this.#request.ontimeout = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.TIMEOUT;
        reject({"timeout": true});
      };

      this.#request.onabort = () => {
        this.#state = HTTPRequestState.ABORTED;
        reject({"aborted": true});
      };

      this.#request.send({} as FormData);
      this.#state = HTTPRequestState.READY;
    });
  }

  public abort() {
    this.#aborted = true;
  }
}

export type HTTPRequestValue = NonArray<string | number | boolean | File | object>
export type HTTPRequestObject = {[key: string]: HTTPRequestValue | HTTPRequestValue[]}

export type ProgressEventHandler = (event: ProgressEvent) => void

export interface HTTPRequestInitializer<Request extends HTTPRequestObject = {}> {
  path: string;
  method: HTTPMethod;
  data?: Request;
  timeout?: number;
  onStart?: ProgressEventHandler;
  onProgress?: ProgressEventHandler;
  onComplete?: ProgressEventHandler;
}

export interface HTTPRequestResponse<Code extends HTTPStatusCode> {
  success: Code extends HTTPStatusCode.OK ? true : false
  code: Code
  message: typeof HTTPStatusMessage[Code]

}

export default HTTPRequest;
