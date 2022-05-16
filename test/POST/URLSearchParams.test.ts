import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";
import { HTTPMethod} from "@noxy/http-utility";

test("POST-URLSearchParams", async () => {
  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const request = new HTTPRequest({
      path:   constants.path,
      method: "POST",
      body:   {
        string:   constants.string,
      }
    });

    return await request.send();
  }, Test.constants);

  Test.VerifyRequest(response);
  expect(response.data.method).toBe(HTTPMethod.POST);

  expect(response.data.body.string).toBe(String(Test.constants.string));
});
