import Puppeteer from "puppeteer";
import Express from "express";
import HTTPRequest from "../src/HTTPRequest";
import HTTPResponse from "../src/HTTPResponse";
import HTTPRequestState from "../src/HTTPRequestState";
import HTTP from "http";
import {HTTPStatusCode} from "@noxy/http-utility";

export module Test {

  export let server: HTTP.Server;
  export let application: Express.Application;
  export let browser: Puppeteer.Browser;
  export let page: Puppeteer.Page;

  export const constants = {
    port:     7327,
    path:     "http://localhost:7327",

    string:   "string",
    number:   123456,
    boolean:  true,
    json:     {"string": "string", "number": 123456, "boolean": true, object: {"key": "value"}, array: ["value1", "value2"]},
    multiple: ["string", 123456, true],
    date:     new Date(1650000000000).toISOString(),
    file:     {
      name: "test-file.txt",
      data: "This is a test file."
    }
  };

  export function VerifyRequest(response: HTTPResponse, code: HTTPStatusCode = HTTPStatusCode.OK, state: HTTPRequestState = HTTPRequestState.DONE) {
    expect(response.success).toBe(code === HTTPStatusCode.OK);
    expect(response.status).toBe(code);
    expect(response.state).toBe(state);
  }
}

declare global {
  interface Window {
    createForm: (constants: typeof Test.constants) => HTMLFormElement,
    "http-request": {
      HTTPRequest: typeof HTTPRequest
      HTTPResponse: typeof HTTPResponse
      HTTPRequestState: typeof HTTPRequestState
    };
  }
}

export default Test;
