import {HTTPRequestState} from "./HTTPRequestState";
import {HTTPStatusCode, HTTPStatusMessage} from "@noxy/http-utility";

export class HTTPResponse<Response = any> {

  success: boolean;
  status: HTTPStatusCode;
  state: HTTPRequestState;
  message: string;
  data: Response | null;

  constructor(status: HTTPStatusCode, state: HTTPRequestState, type?: string | null, data?: Response) {
    this.success = status === HTTPStatusCode.OK;
    this.status = status;
    this.state = state;

    if (this.status > 0) {
      this.message = HTTPStatusMessage[status];
    }
    else if (state === HTTPRequestState.ERROR) {
      this.message = "Error";
    }
    else if (state === HTTPRequestState.ABORTED) {
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
