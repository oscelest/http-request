import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";
import {HTTPStatusCode, HTTPMethod} from "@noxy/http-utility";
import HTTPRequestState from "../../src/HTTPRequestState";

test("GET-Clean", async () => {
  const response = await Test.page.evaluate<() => Promise<HTTPResponse>>(async () => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({path: "http://localhost:7327", method: "GET"});
    return await request.send();
  });

  expect(response.success).toBe(true);
  expect(response.status).toBe(HTTPStatusCode.OK);
  expect(response.state).toBe(HTTPRequestState.DONE);
  expect(response.data.method).toBe(HTTPMethod.GET);

  expect(response.data.query).toStrictEqual({});
  expect(response.data.body).toStrictEqual({});
});
