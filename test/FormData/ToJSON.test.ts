import Test from "../Variables";
import HTTPResponse from "../../src/HTTPResponse";

test("FormDataToJSON", async () => {
  await Test.page.addScriptTag({path: "./test/.scripts/createFormData.js"});

  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const params = window.createFormData(constants);

    return await new HTTPRequest({
      path:    constants.path,
      method:  "POST",
      body:    params,
      headers: {
        "content-type": "application/json"
      }
    }).send();
  }, Test.constants);

  Test.VerifyRequest(response);
  Test.CompareURLSearchParams(response.data.body);
});
