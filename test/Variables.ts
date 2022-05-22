import Puppeteer from "puppeteer";
import Express from "express";
import HTTPRequest, {BodyObject} from "../src/HTTPRequest";
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
    port: 7327,
    path: "http://localhost:7327",

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

  export function CompareURLSearchParams(params: any) {
    expect(params.string).toBe(Test.constants.string);
    expect(Number(JSON.parse(params.number))).toBe(Test.constants.number);
    expect(Boolean(JSON.parse(params.boolean))).toBe(Test.constants.boolean);
    expect(params.multiple.at(0)).toBe(Test.constants.multiple.at(0));
    expect(Number(JSON.parse(params.multiple.at(1)))).toBe(Test.constants.multiple.at(1));
    expect(Boolean(JSON.parse(params.multiple.at(2)))).toBe(Test.constants.multiple.at(2));
  }

  export function CompareFormData(params: any, file: [{name: string, data: string}]) {
    expect(file.at(0)?.name).toBe(Test.constants.file.name);
    expect(file.at(0)?.data).toBe(Test.constants.file.data);
    CompareURLSearchParams(params);
  }

  export function CompareObject(params: any) {
    expect(params.string).toBe(Test.constants.string);
    expect(params.number).toBe(Test.constants.number);
    expect(params.boolean).toBe(Test.constants.boolean);
    expect(params.date).toBe(Test.constants.date);
    expect(params.json).toStrictEqual(Test.constants.json);
    expect(params.multiple.at(0)).toBe(Test.constants.multiple.at(0));
    expect(params.multiple.at(1)).toBe(Test.constants.multiple.at(1));
    expect(params.multiple.at(2)).toBe(Test.constants.multiple.at(2));
  }

  export interface DocumentResponseType {
    object: HTTPResponse;
    expect: string;
    toBe: string;
  }
}

declare global {
  interface Window {
    createDocument: (constants: typeof Test.constants) => Document;
    createObject: (constants: typeof Test.constants) => BodyObject;
    createFormData: (constants: typeof Test.constants) => FormData;
    createURLSearchParams: (constants: typeof Test.constants) => URLSearchParams;

    "http-request": {
      HTTPRequest: typeof HTTPRequest
      HTTPResponse: typeof HTTPResponse
      HTTPRequestState: typeof HTTPRequestState
    };
  }
}

export default Test;
