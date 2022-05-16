import {HTTPRequestState} from "./HTTPRequestState";
import {HTTPStatusCode, HTTPStatusMessage, HTTPMethod} from "@noxy/http-utility";
import HTTPRequest from "./HTTPRequest";

export class HTTPResponse<Response = any> {

  success: boolean;
  status: HTTPStatusCode;
  state: HTTPRequestState;
  message: string;
  data: Response | null;
  path: string;
  method: keyof typeof HTTPMethod | HTTPMethod;

  constructor(request: HTTPRequest, status: HTTPStatusCode, data?: Response, type?: string | null) {
    this.method = request.method;
    this.path = request.URL;
    this.state = request.state;

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

    this.data = this.parseData(type, data);
  }

  private parseData(type?: string | null, data?: Response) {
    if (data === undefined || data === null) return null;
    if (type?.includes("application/json")) {
      return JSON.parse(String(data));
    }
    else if (type?.includes("text/plain")) {
      return data;
    }
    else {
      return null;
    }
  }
}

export default HTTPResponse;
