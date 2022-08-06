import Test from "../Variables";
import HTTPResponse from "../../src/HTTPResponse";

test("FormDataToDocument", async () => {
  await Test.page.addScriptTag({path: "./test/.scripts/createFormData.js"});

  const response = await Test.page.evaluate<(typeof Test.constants)[],(variable: typeof Test.constants) => Promise<string | HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const params = window.createFormData(constants);

    try {
      return await new HTTPRequest({
        path:    constants.path,
        method:  "POST",
        body:    params,
        headers: {
          "content-type": "text/plain"
        }
      }).send();
    }
    catch (error) {
      return (error as Error).message;
    }
  }, Test.constants);

  expect(response).toBe("Cannot convert 'FormData' to Text");
});
