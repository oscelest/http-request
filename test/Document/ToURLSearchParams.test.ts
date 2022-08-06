import Test from "../Variables";
import HTTPResponse from "../../src/HTTPResponse";

test("DocumentToURLSearchParams", async () => {
  await Test.page.addScriptTag({path: "./test/.scripts/createDocument.js"});

  const response = await Test.page.evaluate<(typeof Test.constants)[],(variable: typeof Test.constants) => Promise<string | HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const doc = window.createDocument(constants);

    try {
      return await new HTTPRequest({
        path:    constants.path,
        method:  "POST",
        body:    doc,
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        }
      }).send();
    }
    catch (error) {
      return (error as Error).message;
    }
  }, Test.constants);

  expect(response).toBe("Cannot convert 'HTMLDocument' to URLSearchParams");
});
