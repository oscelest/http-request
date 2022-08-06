import {HTTPRequestState} from "./HTTPRequestState";
import {HTTPMethod, HTTPHeader, HTTPStatusCode} from "@noxy/http-utility";
import HTTPResponse from "./HTTPResponse";
import {Many} from "@noxy/utility-types";

export class HTTPRequest<Response = any, Query extends QueryData = QueryData, Body extends BodyData = BodyData> {

  // Modifiable properties
  readonly #body?: Body;
  readonly #query?: Query;
  #path: string;
  #method: keyof typeof HTTPMethod | HTTPMethod;
  #headers!: HeaderCollection;
  #timeout?: number;

  // Internal properties
  #state: HTTPRequestState;
  #request: XMLHttpRequest;
  #aborted: boolean;
  #progress: number;
  #promise?: Promise<HTTPResponse<Response>>;

  public onStart?: ProgressEventHandler;
  public onProgress?: ProgressEventHandler;
  public onComplete?: ProgressEventHandler;

  public get URL() {
    const params = this.getQueryString();
    return params.length ? `${this.#path}?${params}` : this.path;
  }

  public get aborted() {
    return this.#aborted;
  }

  public get state() {
    return this.#state;
  }

  public get progress() {
    return this.#progress;
  }

  public get path() {
    return this.#path;
  }

  public set path(path: string) {
    if (this.#state !== HTTPRequestState.READY) throw new Error("Cannot change 'path' of request that has already been opened.");
    this.#path = path;
  }

  public get method() {
    return this.#method;
  }

  public set method(method: keyof typeof HTTPMethod | HTTPMethod) {
    if (this.#state !== HTTPRequestState.READY) throw new Error("Cannot change 'method' of request that has already been opened.");
    this.#method = method;
  }

  public get headers() {
    return {...this.#headers};
  }

  public set headers(headers: Partial<{ [K in HTTPHeader]: string }>) {
    if (this.#state !== HTTPRequestState.READY) throw new Error("Cannot change 'headers' of request that has already been opened.");

    const collection = {} as Partial<{ [K in HTTPHeader]: string }>;
    for (let [key, value] of Object.entries(headers)) {
      collection[key.toLowerCase() as HTTPHeader] = value;
    }
    this.#headers = collection;
  }

  public get timeout() {
    return this.#timeout ?? 60000;
  }

  public set timeout(ms: number) {
    if (this.#state !== HTTPRequestState.READY) throw new Error("Cannot change 'timeout' of request that has already been opened.");
    this.#timeout = ms;
  }

  constructor(initializer: HTTPRequestInitializer<Query, Body>) {
    this.#state = HTTPRequestState.READY;
    this.#aborted = false;
    this.#progress = 0;
    this.#request = new XMLHttpRequest();

    this.#path = initializer.path;
    this.#method = initializer.method;

    this.#query = initializer.query;
    this.#body = initializer.body;
    this.#timeout = initializer.timeout;
    this.headers = initializer.headers ?? {};

    this.onStart = initializer.onStart;
    this.onProgress = initializer.onProgress;
    this.onComplete = initializer.onComplete;
  }

  public setQuery(query: QueryData) {
    if (this.#state !== HTTPRequestState.READY) {
      console.warn("You're updating the 'query' of a request that has already been opened. This has created a new request. The previous has not been aborted.");
    }

    return new HTTPRequest({
      query,
      path:       this.#path,
      method:     this.#method,
      body:       this.#body,
      headers:    this.#headers,
      timeout:    this.#timeout,
      onStart:    this.onStart,
      onProgress: this.onProgress,
      onComplete: this.onComplete
    });
  }

  public setBody(body: BodyData) {
    if (this.#state !== HTTPRequestState.READY) {
      console.warn("You're updating the 'body' of a request that has already been opened. This has created a new request. The previous has not been aborted.");
    }

    return new HTTPRequest({
      body,
      path:       this.#path,
      method:     this.#method,
      query:      this.#query,
      headers:    this.#headers,
      timeout:    this.#timeout,
      onStart:    this.onStart,
      onProgress: this.onProgress,
      onComplete: this.onComplete
    });
  }

  public abort() {
    this.#aborted = true;
    this.#request.abort();
  }

  public async send(): Promise<HTTPResponse<Response>> {
    if (this.#promise) return this.#promise;
    return this.#promise = new Promise<HTTPResponse<Response>>(async (resolve, reject) => {
      this.#request.timeout = this.timeout;
      this.#state = HTTPRequestState.OPENED;

      this.#request.onloadstart = event => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.LOADING;
        this.onStart?.(event);
      };

      this.#request.onprogress = event => {
        if (this.#aborted) return this.#request.abort();
        this.#progress = event.loaded / event.total * 100;
        this.onProgress?.(event);
      };

      this.#request.onload = event => {
        if (this.#aborted) return;
        if (this.#request.status === HTTPStatusCode.OK) {
          try {
            this.#state = HTTPRequestState.DONE;
            const response = new HTTPResponse(this, HTTPStatusCode.OK, this.#request.response);
            this.onComplete?.(event);
            resolve(response);
          }
          catch (error) {
            this.#state = HTTPRequestState.ERROR;
            reject(new HTTPResponse(this, HTTPStatusCode.Unknown, error));
          }
        }
        else {
          this.#state = HTTPRequestState.ERROR;
          reject(new HTTPResponse(this, this.#request.status));
        }
      };

      this.#request.onerror = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.ERROR;
        reject(new HTTPResponse(this, HTTPStatusCode.Unknown, this.#request.response));
      };

      this.#request.ontimeout = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.TIMEOUT;
        reject(new HTTPResponse(this, HTTPStatusCode.RequestTimeout));
      };

      this.#request.onabort = () => {
        this.#state = HTTPRequestState.ABORTED;
        reject(new HTTPResponse(this, HTTPStatusCode.Unknown));
      };

      this.#state = HTTPRequestState.READY;
      this.#request.open(this.#method, this.URL);

      const content_type = this.getContentType();
      if (content_type && !content_type?.includes("multipart/form-data")) {
        this.#headers[HTTPHeader.ContentType] = content_type;
      }
      this.attachHeaders();

      try {
        this.#request.send(this.getBody(content_type));
      }
      catch (error) {
        reject(error);
      }
    });
  }

  private attachHeaders() {
    const header_list = Object.getOwnPropertyNames(this.#headers) as HTTPHeader[];
    for (let key of header_list) {
      const header = key.toLowerCase()
      const value = this.#headers[key]?.toLowerCase();
      if (!value || header === HTTPHeader.ContentType && value.includes("multipart/form-data")) continue;
      this.#request.setRequestHeader(header, value);
    }
  }

  public getBody(content_type = this.getContentType()) {
    if (!content_type) return null;
    if (this.#body === undefined || this.#body === null) return null;

    switch (content_type) {
      case "application/json":
        return this.getBodyAsJSON();
      case "text/html":
        return this.getBodyAsDocument();
      case "multipart/form-data":
        return this.getBodyAsFormData();
      case "application/octet-stream":
        return this.getBodyAsArrayBuffer();
      case "application/x-www-form-urlencoded":
        return this.getBodyAsURLSearchParams();
      default:
        return this.getBodyAsText();
    }
  }

  public getContentType() {
    if (this.#body === null || this.#body === undefined || !this.method.localeCompare(HTTPMethod.TRACE, undefined, {sensitivity: "base"})) return null;

    if (this.#headers[HTTPHeader.ContentType]) return this.#headers[HTTPHeader.ContentType]?.match(/^(?:application|audio|image|message|multipart|text|video|x-[\w-])\/[\w-]+/i)?.at(0)?.toLowerCase();
    if (this.#body instanceof ArrayBuffer) return "application/octet-stream";
    if (this.#body instanceof Blob) return this.#body.type;
    if (this.#body instanceof Document) return "text/html";
    if (this.#body instanceof FormData) return "multipart/form-data";
    if (this.#body instanceof URLSearchParams) return "application/x-www-form-urlencoded";
    if (typeof this.#body === "object") return "application/json";
    return "text/plain";
  }

  public getQueryString() {
    if (this.#query === undefined || this.#query === null) return "";
    if (this.#query instanceof URLSearchParams) return this.#query.toString();

    const query = new URLSearchParams();
    for (let [key, item] of Object.entries(this.#query)) {
      if (item === undefined || item === null) continue;
      if (Array.isArray(item)) {
        for (let value of item) {
          if (value === undefined || value === null) continue;
          query.append(key, HTTPRequest.parseQueryPrimitive(value));
        }
      }
      else {
        query.append(key, HTTPRequest.parseQueryPrimitive(item));
      }
    }

    return query.toString();
  }

  public getResponseHeaders() {
    if (this.#state !== HTTPRequestState.DONE) return {};

    return this.#request.getAllResponseHeaders().split(/\r?\n/g).reduce(
      (result, line) => {
        const [key, value] = line.split(/\s*:\s*/g);
        result[key.toLowerCase() as HTTPHeader] = value;
        return result;
      },
      {} as { [K in HTTPHeader]: string }
    );
  }

  private getBodyAsArrayBuffer() {
    if (this.#body instanceof ArrayBuffer || this.#body instanceof Blob || typeof this.#body === "string") return this.#body;
    if (this.#body instanceof Document) return this.#body.documentElement.outerHTML;
    if (typeof this.#body !== "object" || Object.getPrototypeOf(this.#body) === Object.prototype) return JSON.stringify(this.#body);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to ArrayBuffer`);
  }

  private getBodyAsJSON() {
    if (typeof this.#body === "string" || this.#body instanceof Blob) return this.#body;
    if (this.#body instanceof Document) return this.#body.documentElement.outerHTML;
    if (this.#body instanceof FormData) return JSON.stringify(HTTPRequest.toObjectFromFormData(this.#body));
    if (this.#body instanceof URLSearchParams) return JSON.stringify(HTTPRequest.toObjectFromURLSearchParams(this.#body));
    if (typeof this.#body !== "object" || Object.getPrototypeOf(this.#body) === Object.prototype) return JSON.stringify(this.#body);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to JSON`);
  }

  private getBodyAsDocument() {
    if (this.#body instanceof Document || this.#body instanceof Blob) return this.#body;
    if (typeof this.#body !== "object") return String(this.#body);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to Document`);
  }

  private getBodyAsFormData() {
    if (this.#body instanceof FormData || this.#body instanceof Blob) return this.#body;
    if (this.#body instanceof URLSearchParams) return HTTPRequest.toFormDataFromURLSearchParams(this.#body);
    if (Object.getPrototypeOf(this.#body) === Object.prototype) return HTTPRequest.toFormDataFromObject(this.#body as BodyObject);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to FormData`);
  }

  private getBodyAsURLSearchParams() {
    if (this.#body instanceof URLSearchParams || this.#body instanceof Blob) return this.#body;
    if (this.#body instanceof FormData) return HTTPRequest.toURLSearchParamsFromFormData(this.#body);
    if (Object.getPrototypeOf(this.#body) === Object.prototype) return HTTPRequest.toURLSearchParamFromObject(this.#body as BodyObject);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to URLSearchParams`);
  }

  private getBodyAsText() {
    if (typeof this.#body === "string" || this.#body instanceof ArrayBuffer || this.#body instanceof Blob || this.#body instanceof Document) return this.#body;
    if (typeof this.#body !== "object" || Object.getPrototypeOf(this.#body) === Object.prototype) return JSON.stringify(this.#body);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to Text`);
  }

  private static parseQueryPrimitive(value: string | boolean | number | Date) {
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "1" : "0";
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private static parseBodyPrimitive(value: BodyPrimitive | BodyObject) {
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "1" : "0";
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private static toFormDataFromURLSearchParams(source: URLSearchParams) {
    const target = new FormData();
    for (let [key, item] of source.entries()) {
      target.append(key, item);
    }
    return target;
  }

  private static toFormDataFromObject(source: BodyObject) {
    const target = new FormData();
    for (let [key, item] of Object.entries(source)) {
      this.appendObjectValue(target, key, item);
    }
    return target;
  }

  private static toURLSearchParamsFromFormData(source: FormData) {
    const target = new URLSearchParams();
    for (let [key, item] of source.entries()) {
      if (!(item instanceof File)) target.append(key, item);
    }
    return target;
  }

  private static toURLSearchParamFromObject(source: BodyObject) {
    const target = new URLSearchParams();
    for (let [key, item] of Object.entries(source)) {
      this.appendObjectValue(target, key, item);
    }
    return target;
  }

  private static appendObjectValue(target: FormData | URLSearchParams, key: string, source: Many<BodyPrimitive | BodyObject>) {
    if (source === undefined || source === null) return;
    if (Array.isArray(source)) {
      return source.forEach(value => target.append(key, HTTPRequest.parseBodyPrimitive(value)));
    }
    target.append(key, HTTPRequest.parseBodyPrimitive(source));
  }

  private static toObjectFromFormData(params: FormData) {
    const object = {} as {[key: string]: string | string[]};
    const entries = params.entries();

    for (let [key, item] of entries) {
      if (item === undefined || item === null || item instanceof File) continue;
      const current = object[key];
      object[key] = current === undefined ? item : Array.isArray(current) ? [...current, item] : [current, item];
    }

    return object;
  }

  private static toObjectFromURLSearchParams(params: URLSearchParams) {
    const object = {} as {[key: string]: string | string[]};
    const entries = params.entries();

    for (let [key, item] of entries) {
      if (item === undefined || item === null) continue;
      const current = object[key];
      object[key] = current === undefined ? item : Array.isArray(current) ? [...current, item] : [current, item];
    }

    return object;
  }

}

export type HeaderCollection = Partial<{ [K in HTTPHeader]: string }>

export type QueryData = undefined | null | string | URLSearchParams | {[key: string]: Many<string | number | boolean | null | undefined | Date>}

export type BodyData = BodyNative | BodyPrimitive | BodyObject
export type BodyObject = {[key: string]: Many<BodyObject | BodyPrimitive>}
export type BodyNative = FormData | URLSearchParams | Document | Blob | ArrayBuffer | File
export type BodyPrimitive = Date | string | boolean | number | null | undefined

export type ProgressEventHandler = (event: ProgressEvent) => void

export interface HTTPRequestInitializer<Query extends QueryData = QueryData, Body extends BodyData = BodyData> {
  path: string;
  method: keyof typeof HTTPMethod | HTTPMethod;
  query?: Query;
  body?: Body;
  headers?: HeaderCollection;
  timeout?: number;
  onStart?: ProgressEventHandler;
  onProgress?: ProgressEventHandler;
  onComplete?: ProgressEventHandler;
}

export default HTTPRequest;
