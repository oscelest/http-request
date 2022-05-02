import {HTTPRequestState} from "./HTTPRequestState";
import {HTTPMethod, HTTPHeader, HTTPStatusMessage} from "@noxy/http-utility";

export class HTTPRequest<Response = any, Request extends HTTPRequestData = HTTPRequestData> {

  #data?: Request;
  #path: string;
  #state: HTTPRequestState;
  #method: HTTPMethod;
  #aborted: boolean;
  #headers: Partial<{ [K in HTTPHeader]: string }>;
  #request: XMLHttpRequest;
  #timeout?: number;
  #promise?: Promise<HTTPRequestResponse<Response | null>>;
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

  public async send() {
    if (this.#promise) return this.#promise;
    return this.#promise = new Promise<HTTPRequestResponse<Response | null>>(async (resolve, reject) => {
      this.#request.timeout = this.timeout;
      this.#state = HTTPRequestState.OPENED;

      const header_list = Object.getOwnPropertyNames(this.#headers) as HTTPHeader[];
      for (let i = 0; i < header_list.length; i++) {
        const header = header_list.at(i);
        if (!header) continue;

        const value = this.#headers[header];
        if (!value) continue;

        this.#request.setRequestHeader(header, value);
      }

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
        resolve({
          success: this.#request.status === 200,
          status:  this.#request.status,
          message: this.#request.statusText,
          state:   this.#state,
          data:    this.#request.response
        });
      };

      this.#request.ontimeout = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.TIMEOUT;
        resolve({
          success: false,
          status:  408,
          message: HTTPStatusMessage["408"],
          state:   this.#state,
          data:    null
        });
      };

      this.#request.onabort = () => {
        this.#state = HTTPRequestState.ABORTED;
        reject({
          success: false,
          status:  0,
          message: "Aborted",
          state:   this.#state,
          data:    null
        });
      };

      this.#request.onerror = () => {
        if (this.#aborted) return;
        this.#state = HTTPRequestState.ERROR;
        reject({
          success: false,
          status:  0,
          message: "Error",
          state:   this.#state,
          data:    null
        });
      };

      this.#state = HTTPRequestState.READY;
      const method = this.#method.toLowerCase();
      if (method !== HTTPMethod.get && method !== HTTPMethod.head) {
        this.#request.open(this.#method, this.#path);
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
          this.#request.send(this.#data);
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
          const content_type = this.getContentType();
          this.#request.setRequestHeader(HTTPHeader.ContentType, content_type);
          switch (content_type.toLowerCase()) {
            case "text/plain":
            case "application/json":
              return this.#request.send(JSON.stringify(this.#data));
            case "application/x-www-form-urlencoded":
              return this.#request.send(await this.toSearchParamData());
            case "multipart/form-data":
              return this.#request.send(await this.toFormData());
            default:
              throw new Error(`Could not convert data of type '${this.#data?.constructor.name}' to ContentType '${content_type}'`);
          }
        }
      }
      else {
        const params = await this.toSearchParamData()?.toString();
        this.#request.setRequestHeader(HTTPHeader.ContentType, "");
        this.#request.open(this.#method, params ? `${new URL(this.#path).origin}?${params}` : this.#path);
        this.#request.send();
      }
    });
  }

  public abort() {
    this.#aborted = true;
  }

  private async toSearchParamData(): Promise<null | URLSearchParams> {
    if (this.#data === undefined || this.#data === null) return null;
    if (this.#data instanceof URLSearchParams) return this.#data as URLSearchParams;
    if (this.#data instanceof ArrayBuffer) return new URLSearchParams(new TextDecoder("utf-8").decode(this.#data));
    if (this.#data instanceof Blob) return new URLSearchParams(await this.#data.text());
    if (this.#data instanceof Document) return null;
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
    if (this.#data instanceof FormData) return this.#data as FormData;
    if (this.#data instanceof ArrayBuffer) return null;
    if (this.#data instanceof Blob) return null;
    if (this.#data instanceof Document) return new FormData(this.#data.forms[0]);
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

  private static parseFormDataPrimitive(value?: HTTPRequestDataObjectPrimitive) {
    if (value instanceof File) return value;
    return this.parseSearchParamPrimitive(value);
  }

  private static parseSearchParamPrimitive(value?: HTTPRequestDataObjectPrimitive) {
    if (value instanceof File) return null;
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "1" : "0";
    if (typeof value === "bigint") return value.toString();
    return JSON.stringify(value);
  }
}

export type HTTPRequestDataObjectPrimitive = string | boolean | number | bigint | File
export type HTTPRequestDataPrimitive = string | boolean | number | bigint | null | undefined
export type HTTPRequestDataNative = FormData | URLSearchParams | Document | Blob | ArrayBuffer
export type HTTPRequestData = HTTPRequestDataPrimitive | HTTPRequestDataNative | {[key: string]: HTTPRequestDataObjectPrimitive}

export type ProgressEventHandler = (event: ProgressEvent) => void

export interface HTTPRequestInitializer<Request extends HTTPRequestData = HTTPRequestData> {
  path: string;
  method: HTTPMethod;
  data?: Request;
  timeout?: number;
  onStart?: ProgressEventHandler;
  onProgress?: ProgressEventHandler;
  onComplete?: ProgressEventHandler;
}

export interface HTTPRequestResponse<Response> {
  success: boolean;
  status: number;
  state: HTTPRequestState;
  message: string;
  data: Response;
}

export default HTTPRequest;
