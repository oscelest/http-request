import Test from "../Variables";
import HTTPResponse from "../../src/HTTPResponse";

test("URLSearchParamsToFormData", async () => {
  await Test.page.addScriptTag({path: "./test/.scripts/createURLSearchParams.js"});

  const response = await Test.page.evaluate<(typeof Test.constants)[], (variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const params = window.createURLSearchParams(constants);

    return await new HTTPRequest({
      path: constants.path,
      method: "POST",
      body: params,
      headers: {
        "content-type": "multipart/form-data"
      }
    }).send();
  }, Test.constants);

  Test.VerifyRequest(response);
  Test.CompareURLSearchParams(response.data.body);
});
