import {HTTPRequestState} from "./HTTPRequestState";
import {HTTPMethod, HTTPHeader, HTTPStatusCode} from "@noxy/http-utility";
import HTTPResponse from "./HTTPResponse";
import {Many} from "@noxy/utility-types";

export class HTTPRequest<Response = any, Query extends QueryData = QueryData, Body extends BodyData = BodyData> {

  // Modifiable properties
  #body?: Body;
  #query?: Query;
  #path: string;
  #method: keyof typeof HTTPMethod | HTTPMethod;
  #headers: HeaderCollection;
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
    this.#headers = headers;
  }

  public get timeout() {
    return this.#timeout ?? 60000;
  }

  public set timeout(ms: number) {
    if (this.#state !== HTTPRequestState.READY) throw new Error("Cannot change 'timeout' of request that has already been opened.");
    this.#timeout = ms;
  }

  constructor(initializer: HTTPRequestInitializer<Query, Body>) {
    this.#path = initializer.path;
    this.#method = initializer.method;

    this.#query = initializer.query;
    this.#body = initializer.body;
    this.#headers = initializer.headers ?? {};
    this.#timeout = initializer.timeout;

    this.#state = HTTPRequestState.READY;
    this.#aborted = false;
    this.#progress = 0;
    this.#request = new XMLHttpRequest();

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
        this.#state = HTTPRequestState.DONE;
        this.onComplete?.(event);
        resolve(new HTTPResponse(this, HTTPStatusCode.OK, this.#request.response, HTTPRequest.getContentType(this.#request.getResponseHeader(HTTPHeader.ContentType))));
      };

      this.#request.onerror = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.ERROR;
        reject(new HTTPResponse(this, HTTPStatusCode.Unknown));
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
      this.attachHeaders();

      if (this.canHaveBody()) {
        const content_type = this.getContentType();
        this.#request.setRequestHeader(HTTPHeader.ContentType, content_type);
        this.#request.send(await this.getBody(content_type));
      }
      else {
        this.#request.send();
      }
    });
  }

  private attachHeaders() {
    const method = this.#method.toLowerCase();
    const header_list = Object.getOwnPropertyNames(this.#headers) as HTTPHeader[];
    for (let i = 0; i < header_list.length; i++) {
      const header = header_list.at(i);
      if (!header) continue;

      const value = this.#headers[header];
      if (!value || method === HTTPMethod.get || method === HTTPMethod.head) continue;

      this.#request.setRequestHeader(header, value);
    }
  }

  public async getBody(content_type: string = this.getContentType()) {
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
    const content_type = this.#headers[HTTPHeader.ContentType]?.match(/^(?:application|audio|image|message|multipart|text|video|x-[\w-])\/[\w-]+/)?.at(0)?.toLowerCase() ?? "";
    if (content_type) return content_type;
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
          query.append(key, String(value));
        }
      }
      else {
        query.append(key, String(item));
      }
    }

    return query.toString();
  }

  private canHaveBody() {
    switch (this.#method) {
      case HTTPMethod.TRACE:
      case HTTPMethod.trace:
        return false;
      default:
        return true;
    }
  }

  private async getBodyAsArrayBuffer() {
    if (this.#body === undefined || this.#body === null) return null;
    if (this.#body instanceof ArrayBuffer) return this.#body;
    if (this.#body instanceof Blob) return await this.#body.arrayBuffer();
    if (this.#body instanceof Document) return new TextEncoder().encode(this.#body.documentElement.outerHTML);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to ArrayBuffer`);
  }

  private getBodyAsJSON() {
    if (this.#body === undefined || this.#body === null) return null;
    if (typeof this.#body !== "object" || Object.getPrototypeOf(this.#body) === Object.prototype) return JSON.stringify(this.#body);
    if (this.#body instanceof Document) return JSON.stringify(this.#body.documentElement.outerHTML);
    if (this.#body instanceof FormData || this.#body instanceof URLSearchParams) return HTTPRequest.toJSONFromParams(this.#body);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to ArrayBuffer`);
  }

  private async getBodyAsDocument() {
    if (this.#body === undefined || this.#body === null) return null;
    if (this.#body instanceof Document) return this.#body;
    if (this.#body instanceof Blob && this.#body.type.toLowerCase().includes("text/html")) return await this.#body.text();
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to Document`);
  }

  private getBodyAsFormData() {
    if (this.#body === undefined || this.#body === null) return null;
    if (this.#body instanceof FormData) return this.#body;
    if (this.#body instanceof URLSearchParams) HTTPRequest.transferData(new FormData(), this.#body);
    if (Object.getPrototypeOf(this.#body) === Object.prototype) HTTPRequest.transferData(new FormData(), this.#body as BodyObject);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to FormData`);
  }

  private getBodyAsURLSearchParams() {
    if (this.#body === undefined || this.#body === null) return null;
    if (this.#body instanceof URLSearchParams) return this.#body;
    if (this.#body instanceof FormData) HTTPRequest.transferData(new URLSearchParams(), this.#body);
    if (Object.getPrototypeOf(this.#body) === Object.prototype) HTTPRequest.transferData(new FormData(), this.#body as BodyObject);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to URLSearchParams`);
  }

  private async getBodyAsText() {
    if (this.#body === undefined || this.#body === null) return null;
    if (this.#body instanceof ArrayBuffer) return new TextDecoder().decode(this.#body);
    if (this.#body instanceof Blob) return await this.#body.text();
    if (this.#body instanceof Document) return this.#body.documentElement.outerHTML;
    if (Object.getPrototypeOf(this.#body) === Object.prototype) return JSON.stringify(this.#body);
    if (typeof this.#body !== "object") return String(this.#body);
    throw new Error(`Cannot convert '${typeof this.#body === "object" ? this.#body?.constructor.name : typeof this.#body}' to Text`);
  }

  private static transferData(target: URLSearchParams | FormData, source: URLSearchParams | FormData | BodyObject) {
    if (target instanceof URLSearchParams) {
      if (source instanceof URLSearchParams || source instanceof FormData) {
        for (let [key, item] of source.entries()) {
          if (item instanceof File) continue;
          target.append(key, item);
        }
      }
      else {
        for (let [key, item] of Object.entries(source)) {
          if (item === undefined || item === null || item instanceof File) continue;
          if (Array.isArray(item)) {
            for (let i = 0; i < item.length; i++) {
              const value = item.at(i);
              if (value === undefined || value === null || value instanceof File) continue;
              target.append(key, JSON.stringify(value));
            }
          }
          else {
            target.append(key, JSON.stringify(item));
          }
        }
      }
    }
    else if (target instanceof FormData) {
      if (source instanceof URLSearchParams || source instanceof FormData) {
        for (let [key, item] of source.entries()) {
          target.append(key, item);
        }
      }
      else {
        for (let [key, item] of Object.entries(source)) {
          if (item === undefined || item === null) continue;
          if (Array.isArray(item)) {
            for (let i = 0; i < item.length; i++) {
              const value = item.at(i);
              if (value === undefined || value === null) continue;
              target.append(key, JSON.stringify(value));
            }
          }
          else {
            target.append(key, JSON.stringify(item));
          }
        }
      }
    }

    return target;
  }

  private static toJSONFromParams(params: URLSearchParams | FormData) {
    const object = {} as {[key: string]: string | string[]};
    const entries = params.entries();

    for (let [key, item] of entries) {
      if (item === undefined || item === null || item instanceof File) continue;
      const value = object[key];
      if (value === undefined) {
        object[key] = item;
      }
      else if (!Array.isArray(value)) {
        object[key] = [value, item];
      }
      if (Array.isArray(value)) {
        value.push(item);
      }
    }

    return JSON.stringify(object);
  }

  private static getContentType(content_type?: string | null) {
    return content_type?.match(/^(?:application|audio|image|message|multipart|text|video|x-[\w-])\/[\w-]+/)?.at(0)?.toLowerCase();
  }
}

export type HeaderCollection = Partial<{ [K in HTTPHeader]: string }>

export type QueryData = undefined | null | URLSearchParams | {[key: string]: Many<string | number | boolean | null | undefined>}

export type BodyData = BodyNative | BodyPrimitive | BodyObject
export type BodyObject = {[key: string]: Many<BodyObject | File | Date | string | boolean | number | null | undefined>}
export type BodyNative = FormData | URLSearchParams | Document | Blob | ArrayBuffer
export type BodyPrimitive = string | boolean | number | null | undefined

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
