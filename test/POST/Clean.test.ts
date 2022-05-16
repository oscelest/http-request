import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";
import {HTTPMethod} from "@noxy/http-utility";

test("POST-Clean", async () => {
  const response = await Test.page.evaluate<(constants: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({path: constants.path, method: "POST"});
    return await request.send();
  }, Test.constants);

  Test.VerifyRequest(response);
  expect(response.data.method).toBe(HTTPMethod.POST);

  expect(response.data.query).toStrictEqual({});
  expect(response.data.body).toStrictEqual({});
});
