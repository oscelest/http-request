import HTTPResponse from "src/HTTPResponse";
import Test from "../Variables";

test("DocumentToFormData", async () => {
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
          "content-type": "multipart/form-data"
        }
      }).send();
    }
    catch (error) {
      return (error as Error).message;
    }
  }, Test.constants);
  
  expect(response).toBe("Cannot convert 'HTMLDocument' to FormData");
});
