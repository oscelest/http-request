import Test from "../Variables";
import HTTPResponse from "../../src/HTTPResponse";

test("ObjectToURLSearchParams", async () => {
  await Test.page.addScriptTag({path: "./test/.scripts/createObject.js"});

  const response = await Test.page.evaluate<(typeof Test.constants)[],(variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const params = window.createObject(constants);

    return await new HTTPRequest({
      path:    constants.path,
      method:  "POST",
      body:    params,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      }
    }).send();
  }, Test.constants);

  Test.VerifyRequest(response);
  Test.CompareURLSearchParams(response.data.body);
});
