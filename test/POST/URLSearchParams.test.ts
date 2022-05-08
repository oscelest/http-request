import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";
import HTTPRequestState from "../../src/HTTPRequestState";
import {HTTPStatusCode, HTTPMethod} from "@noxy/http-utility";

test("GET-URLSearchParams", async () => {

  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({
      path:   "http://localhost:7327",
      method: "POST",
      data:   {
        string:   constants.string,
        number:   constants.number,
        bigint:   BigInt(constants.bigint),
        boolean:  constants.boolean,
        date:     new Date(constants.date),
        file:     new File([constants.file.data], constants.file.name),
        json:     constants.json,
        multiple: constants.multiple
      }
    });

    return await request.send();
  }, Test.constants);

  expect(response.success).toBe(true);
  expect(response.status).toBe(HTTPStatusCode.OK);
  expect(response.state).toBe(HTTPRequestState.DONE);
  expect(response.data.method).toBe(HTTPMethod.POST);

  expect(response.data.body.string).toBe(Test.constants.string);
  expect(response.data.body.bigint).toBe(Test.constants.bigint);
  expect(response.data.body.boolean).toBe(Test.constants.boolean ? "1" : "0");
  expect(response.data.body.date).toBe(Test.constants.date);
  expect(response.data.body.file).toBeUndefined();
  expect(response.data.body.json).toBe(JSON.stringify(Test.constants.json));
  expect(response.data.body.multiple).toStrictEqual(Test.constants.multiple);
});
