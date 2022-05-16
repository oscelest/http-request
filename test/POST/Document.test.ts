import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";
import {HTTPMethod} from "@noxy/http-utility";

test("POST-Document", async () => {
  await Test.page.addScriptTag({path: "./test/browser-scripts/createForm.js"});

  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    document.body.append(window.createForm(constants));

    const request = new HTTPRequest({
      path:   "http://localhost:7327",
      method: "POST",
      // body:   document
    });

    return await request.send();
  }, Test.constants);

  Test.VerifyRequest(response);
  expect(response.data.method).toBe(HTTPMethod.POST);
  // expect(response.data.body.string).toBe(Test.constants.string);
  // expect(response.data.body.number).toBe(Test.constants.number);
});
