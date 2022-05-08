import Puppeteer, {HTTPResponse} from "puppeteer";
import Express from "express";
import HTTPRequest from "../src/HTTPRequest";
import HTTPRequestState from "../src/HTTPRequestState";
import HTTP from "http";

export module Test {
  export let port: number;
  export let host: string;
  export let server: HTTP.Server;
  export let application: Express.Application;
  export let browser: Puppeteer.Browser;
  export let page: Puppeteer.Page;

  export const constants = {
    string:   "string",
    number:   123456,
    bigint:   BigInt("876543212345678").toString(),
    boolean:  true,
    json:     {"string": "string", "number": 123456, "boolean": true, object: {"key": "value"}, array: ["value1", "value2"]},
    multiple: ["value1", "value2"],
    date:     new Date(1650000000000).toISOString(),
    file: {
      name: "test-file.txt",
      data: "This is a test file."
    }
  };
}

declare global {
  interface Window {
    "http-request": {
      HTTPRequest: typeof HTTPRequest
      HTTPResponse: typeof HTTPResponse
      HTTPRequestState: typeof HTTPRequestState
    };
  }
}

export default Test;
