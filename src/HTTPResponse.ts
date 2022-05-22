import {HTTPRequestState} from "./HTTPRequestState";
import {HTTPStatusCode, HTTPStatusMessage, HTTPMethod, HTTPHeader} from "@noxy/http-utility";
import HTTPRequest, {HeaderCollection} from "./HTTPRequest";

export class HTTPResponse<Response = any> {

  public success: boolean;
  public status: HTTPStatusCode;
  public state: HTTPRequestState;
  public message: string;
  public data: Response | null;
  public path: string;
  public method: keyof typeof HTTPMethod | HTTPMethod;
  public headers: HeaderCollection;

  constructor(request: HTTPRequest, status: HTTPStatusCode, data?: Response) {
    this.method = request.method;
    this.path = request.URL;
    this.state = request.state;
    this.headers = request.getResponseHeaders();

    this.success = status === HTTPStatusCode.OK;
    this.status = status;

    if (this.status > 0) {
      this.message = HTTPStatusMessage[status];
    }
    else if (request.state === HTTPRequestState.ERROR) {
      this.message = "Error";
    }
    else if (request.state === HTTPRequestState.ABORTED) {
      this.message = "Aborted";
    }
    else {
      this.message = "No message could be provided.";
    }

    try {
      this.data = this.parseData(data);
    }
    catch (error) {
      this.data = (error as Error).message as unknown as Response;
    }
  }

  private parseData(data?: Response) {
    if (typeof data !== "string") return null;

    const type = this.headers[HTTPHeader.ContentType]?.toLowerCase() ?? "";
    if (type.includes("application/json")) {
      return JSON.parse(data);
    }

    if (type.includes("text/html")) {
      const doc = document.implementation.createHTMLDocument();
      doc.documentElement.innerHTML = data;
      return doc;
    }

    return data;
  }
}

export default HTTPResponse;
