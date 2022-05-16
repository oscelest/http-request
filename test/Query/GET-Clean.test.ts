import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";
import {HTTPMethod} from "@noxy/http-utility";

test("Query-GET-Clean", async () => {
  const response = await Test.page.evaluate<(constants: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({path: constants.path, method: "GET"});
    return await request.send();
  }, Test.constants);

  Test.VerifyRequest(response);
  expect(response.data.method).toBe(HTTPMethod.GET);

  expect(response.data.query).toStrictEqual({});
  expect(response.data.body).toStrictEqual({});
});
