import Test from "../Variables";
import HTTPResponse from "../../src/HTTPResponse";

test("ObjectToDocument", async () => {
  await Test.page.addScriptTag({path: "./test/.scripts/createObject.js"});

  const response = await Test.page.evaluate<(typeof Test.constants)[], (variable: typeof Test.constants) => Promise<string | HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const params = window.createObject(constants);

    try {
      return await new HTTPRequest({
        path: constants.path,
        method: "POST",
        body: params,
        headers: {
          "content-type": "text/html"
        }
      }).send();
    }
    catch (error) {
      return (error as Error).message;
    }
  }, Test.constants);

  expect(response).toBe("Cannot convert 'Object' to Document");
});
