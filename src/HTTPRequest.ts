import {HTTPRequestState} from "./HTTPRequestState";
import {HTTPMethod, HTTPHeader, HTTPStatusCode} from "@noxy/http-utility";
import HTTPResponse from "./HTTPResponse";
import {Many, Collection} from "@noxy/utility-types";

export class HTTPRequest<Response = any, Request extends HTTPRequestData = HTTPRequestData> {

  #data?: Request;
  #path: string;
  #state: HTTPRequestState;
  #method: keyof typeof HTTPMethod | HTTPMethod;
  #aborted: boolean;
  #headers: Partial<{ [K in HTTPHeader]: string }>;
  #request: XMLHttpRequest;
  #timeout?: number;
  #promise?: Promise<HTTPResponse<Response>>;
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

  public get timeout() {
    return this.#timeout ?? 60000;
  }

  public set path(path: string) {
    this.#path = path;
  }

  public set method(method: keyof typeof HTTPMethod | HTTPMethod) {
    this.#method = method;
  }

  public set timeout(ms: number) {
    this.#timeout = ms;
  }

  constructor(initializer: HTTPRequestInitializer<Request>) {
    this.#path = initializer.path;
    this.#method = initializer.method;
    this.#timeout = initializer.timeout;

    this.#data = initializer.data;
    this.#request = new XMLHttpRequest();
    this.#headers = {};

    this.#state = HTTPRequestState.READY;
    this.#aborted = false;
    this.#progress = 0;

    this.onStart = initializer.onStart;
    this.onProgress = initializer.onProgress;
    this.onComplete = initializer.onComplete;
  }

  public getContentType() {
    if (this.#headers[HTTPHeader.ContentType]) return this.#headers[HTTPHeader.ContentType]!;
    if (this.#data instanceof FormData) return "multipart/form-data";
    if (this.#data instanceof Blob) return this.#data.type;
    if (this.#data instanceof ArrayBuffer) return "application/octet-stream";
    if (this.#data instanceof Document) return "text/html";
    if (typeof this.#data === "object") return "application/x-www-form-urlencoded";
    return "application/json";
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
        this.onProgress?.(event);
      };

      this.#request.onload = event => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.DONE;
        this.onComplete?.(event);
        resolve(new HTTPResponse(this.#request.status, this.#state, this.#request.getResponseHeader(HTTPHeader.ContentType), this.#request.response));
      };

      this.#request.ontimeout = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.TIMEOUT;
        reject(new HTTPResponse(HTTPStatusCode.RequestTimeout, this.#state));
      };

      this.#request.onabort = () => {
        this.#state = HTTPRequestState.ABORTED;
        reject(new HTTPResponse(HTTPStatusCode.Unknown, this.#state));
      };

      this.#request.onerror = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.ERROR;
        reject(new HTTPResponse(HTTPStatusCode.Unknown, this.#state));
      };

      this.#state = HTTPRequestState.READY;
      const method = this.#method.toLowerCase();
      if (method !== HTTPMethod.get && method !== HTTPMethod.head) {
        this.#request.open(this.#method, this.#path);
        this.attachHeaders();

        if (this.#data instanceof ArrayBuffer) {
          this.#request.setRequestHeader(HTTPHeader.ContentType, "application/octet-stream");
          this.#request.send(this.#data);
        }
        else if (this.#data instanceof Blob) {
          this.#request.setRequestHeader(HTTPHeader.ContentType, this.#data.type);
          this.#request.send(this.#data);
        }
        else if (this.#data instanceof Document) {
          this.#request.setRequestHeader(HTTPHeader.ContentType, "text/html");
          this.#request.send(this.toBlob());
        }
        else if (this.#data instanceof FormData) {
          this.#request.setRequestHeader(HTTPHeader.ContentType, "multipart/form-data");
          this.#request.send(await this.toFormData());
        }
        else if (this.#data instanceof URLSearchParams) {
          this.#request.setRequestHeader(HTTPHeader.ContentType, "application/x-www-form-urlencoded");
          this.#request.send(await this.toSearchParamData());
        }
        else {
          const content_type = this.getContentType().toLowerCase();
          this.#request.setRequestHeader(HTTPHeader.ContentType, content_type);
          if (content_type.includes("text/plain") || content_type.includes("application/json")) {
            return this.#request.send(JSON.stringify(this.#data));
          }
          if (content_type.includes("application/x-www-form-urlencoded")) {
            return this.#request.send(await this.toSearchParamData());
          }
          if (content_type.includes("multipart/form-data")) {
            return this.#request.send(await this.toFormData());
          }
          if (content_type.includes("text/html")) {
            return this.#request.send(await this.toDocument());
          }
          if (content_type.includes("application/octet-stream")) {
            return this.#request.send(await this.toArrayBuffer());
          }
          throw new Error(`Could not convert data of type '${this.#data?.constructor.name}' to ContentType '${content_type}'`);
        }
      }
      else {
        const params = await this.toSearchParamData()?.toString();
        this.#request.open(this.#method, params ? `${new URL(this.#path).origin}?${params}` : this.#path);
        this.attachHeaders();
        this.#request.setRequestHeader(HTTPHeader.ContentType, "");
        this.#request.send();
      }
    });
  }

  public abort() {
    this.#aborted = true;
    this.#request.abort();
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

  private toDocument(): null | string | Document {
    if (this.#data === undefined || this.#data === null) return null;
    if (this.#data instanceof Document) return this.#data;
    if (this.#data instanceof ArrayBuffer) throw new Error("Cannot convert ArrayBuffer to Document");
    if (this.#data instanceof Blob) throw new Error("Cannot convert Blob to Document");
    if (this.#data instanceof FormData) throw new Error("Cannot convert FormData to Document");
    if (this.#data instanceof URLSearchParams) throw new Error("Cannot convert URLSearchParams to Document");
    if (typeof this.#data === "object") throw new Error("Cannot convert object to Document");
    return String(this.#data);
  }

  private async toArrayBuffer(): Promise<null | ArrayBuffer> {
    if (this.#data === undefined || this.#data === null) return null;
    if (this.#data instanceof ArrayBuffer) return this.#data;
    if (this.#data instanceof Blob) return await this.#data.arrayBuffer();
    if (this.#data instanceof Document) return new TextEncoder().encode(this.#data.documentElement.outerHTML).buffer;
    if (this.#data instanceof FormData) throw new Error("Cannot convert FormData to ArrayBuffer");
    if (this.#data instanceof URLSearchParams) throw new Error("Cannot convert URLSearchParams to ArrayBuffer");
    if (typeof this.#data === "object") throw new Error("Cannot convert object to ArrayBuffer");
    return new TextEncoder().encode(String(this.#data));
  }

  private toBlob(): null | Blob {
    if (this.#data === undefined || this.#data === null) return null;
    if (this.#data instanceof Blob) return this.#data;
    if (this.#data instanceof ArrayBuffer) return new Blob([this.#data]);
    if (this.#data instanceof Document) return new Blob([this.#data.documentElement.outerHTML], {type: this.#data.contentType});
    if (this.#data instanceof FormData) throw new Error("Cannot convert FormData to Blob");
    if (this.#data instanceof URLSearchParams) throw new Error("Cannot convert URLSearchParams to Blob");
    if (typeof this.#data === "object") return new Blob([JSON.stringify(this.#data)], {type: "application/json"});
    return new Blob([String(this.#data)], {type: "text/plain"});
  }

  private toSearchParamData(): null | URLSearchParams {
    if (this.#data === undefined || this.#data === null) return null;
    if (this.#data instanceof URLSearchParams) return this.#data;
    if (this.#data instanceof ArrayBuffer) throw new Error("Cannot convert ArrayBuffer to URLSearchParams.");
    if (this.#data instanceof Blob) throw new Error("Cannot convert Blob to URLSearchParams.");
    if (this.#data instanceof Document) return HTTPRequest.documentToURLSearchParams(this.#data);
    if (this.#data instanceof FormData) {
      const data = new URLSearchParams();
      for (let key in this.#data) {
        const item_list = this.#data.getAll(key);
        for (let i = 0; i < item_list.length; i++) {
          const item = HTTPRequest.parseSearchParamPrimitive(item_list.at(i));
          if (item !== null && item !== undefined) data.append(key, item);
        }
      }
      return data;
    }

    if (typeof this.#data === "object" && !Array.isArray(this.#data)) {
      const data = new URLSearchParams();
      for (let key in this.#data) {
        const item_list = this.#data[key];
        if (Array.isArray(item_list)) {
          for (let i = 0; i < item_list.length; i++) {
            const item = HTTPRequest.parseSearchParamPrimitive(item_list.at(i));
            if (item !== null && item !== undefined) data.append(key, item);
          }
        }
        else {
          const item = HTTPRequest.parseSearchParamPrimitive(item_list);
          if (item !== null && item !== undefined) data.append(key, item);
        }
      }
      return data;
    }
    return null;
  }

  private toFormData(): null | FormData {
    if (this.#data === undefined || this.#data === null) return null;
    if (this.#data instanceof FormData) return this.#data;
    if (this.#data instanceof ArrayBuffer) throw new Error("Cannot convert ArrayBuffer to FormData.");
    if (this.#data instanceof Blob) throw new Error("Cannot convert Blob to FormData.");
    if (this.#data instanceof Document) return HTTPRequest.documentToFormData(this.#data);
    if (this.#data instanceof URLSearchParams) {
      const data = new FormData();
      for (let key in this.#data) {
        const item_list = this.#data.getAll(key);
        for (let i = 0; i < item_list.length; i++) {
          const item = HTTPRequest.parseFormDataPrimitive(item_list.at(i));
          if (item !== null && item !== undefined) data.append(key, item);
        }
      }
      return data;
    }
    if (typeof this.#data === "object" && !Array.isArray(this.#data)) {
      const data = new FormData();
      for (let key in this.#data) {
        const item_list = this.#data[key];
        if (Array.isArray(item_list)) {
          for (let i = 0; i < item_list.length; i++) {
            const item = HTTPRequest.parseFormDataPrimitive(item_list.at(i));
            if (item !== null && item !== undefined) data.append(key, item);
          }
        }
        else {
          const item = HTTPRequest.parseFormDataPrimitive(item_list);
          if (item !== null && item !== undefined) data.append(key, item);
        }
      }
      return data;
    }
    return null;
  }

  private static documentToURLSearchParams(document: Document) {
    const form_data = this.documentToFormData(document);
    if (!form_data) return null;

    const params = new URLSearchParams();

    for (let key of form_data.keys()) {
      const item_list = form_data.getAll(key);
      for (let j = 0; j < item_list.length; j++) {
        const item = item_list.at(j);
        if (item === undefined || item === null || item instanceof File) continue;
        params.append(key, item);
      }
    }

    return params;
  }

  private static documentToFormData(document: Document) {
    for (let i = 0; i < document.forms.length; i++) {
      const form = document.forms.item(i);
      if (form) return new FormData(form);
    }

    return null;
  }

  private static parseFormDataPrimitive(value?: HTTPRequestDataObjectPrimitive) {
    if (value instanceof File) return value;
    return this.parseSearchParamPrimitive(value);
  }

  private static parseSearchParamPrimitive(value?: HTTPRequestDataObjectPrimitive) {
    if (value instanceof File) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "1" : "0";
    if (typeof value === "bigint") return value.toString();
    return JSON.stringify(value);
  }
}

export declare interface JSONObject {
  [key: string]: HTTPRequestDataObjectPrimitive;
}

export type HTTPRequestDataObjectPrimitive = Many<HTTPRequestDataPrimitive | Date | File | JSONObject>
export type HTTPRequestDataPrimitive = string | boolean | number | bigint | null | undefined
export type HTTPRequestDataNative = FormData | URLSearchParams | Document | Blob | ArrayBuffer
export type HTTPRequestData = HTTPRequestDataNative | HTTPRequestDataPrimitive | Collection<Many<HTTPRequestDataObjectPrimitive>>

export type ProgressEventHandler = (event: ProgressEvent) => void

export interface HTTPRequestInitializer<Request extends HTTPRequestData = HTTPRequestData> {
  path: string;
  method: keyof typeof HTTPMethod | HTTPMethod;
  data?: Request;
  timeout?: number;
  onStart?: ProgressEventHandler;
  onProgress?: ProgressEventHandler;
  onComplete?: ProgressEventHandler;
}

export default HTTPRequest;
