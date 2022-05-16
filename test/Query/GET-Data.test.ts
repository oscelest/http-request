import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";
import {HTTPMethod} from "@noxy/http-utility";

test("Query-GET-Data-String", async () => {
  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({
      method: "GET",
      path:   constants.path,
      query:  {
        string: constants.string
      }
    });

    return await request.send();
  }, Test.constants);

  Test.VerifyRequest(response);
  expect(response.data.method).toBe(HTTPMethod.GET);
  expect(response.data.query.string).toBe(Test.constants.string);
});

test("Query-GET-Data-Number", async () => {
  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({
      path:   constants.path,
      method: "GET",
      query:  {
        number: constants.number
      }
    });

    return await request.send();
  }, Test.constants);

  Test.VerifyRequest(response);
  expect(response.data.method).toBe(HTTPMethod.GET);
  expect(JSON.parse(response.data.query.number)).toBe(Test.constants.number);
});

test("Query-GET-Data-Boolean", async () => {
  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({
      path:   constants.path,
      method: "GET",
      query:  {
        boolean: constants.boolean
      }
    });

    return await request.send();
  }, Test.constants);

  Test.VerifyRequest(response);
  expect(response.data.method).toBe(HTTPMethod.GET);
  expect(JSON.parse(response.data.query.boolean)).toBe(Test.constants.boolean);
});

test("Query-GET-Data-Multiple", async () => {
  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({
      path:   constants.path,
      method: "GET",
      query:  {
        multiple: constants.multiple
      }
    });

    return await request.send();
  }, Test.constants);

  Test.VerifyRequest(response);
  expect(response.data.method).toBe(HTTPMethod.GET);
  expect(response.data.query.multiple.at(0)).toBe(Test.constants.multiple.at(0));
  expect(JSON.parse(response.data.query.multiple.at(1))).toBe(Test.constants.multiple.at(1));
  expect(JSON.parse(response.data.query.multiple.at(2))).toBe(Test.constants.multiple.at(2));
});
