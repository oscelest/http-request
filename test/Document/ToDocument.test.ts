import Test from "../Variables";

test("DocumentToDocument", async () => {
  await Test.page.addScriptTag({path: "./test/.scripts/createDocument.js"});

  const response = await Test.page.evaluate<(variable: typeof Test.constants) => Promise<Test.DocumentResponseType>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const doc = window.createDocument(constants);

    const response = await new HTTPRequest({
      path:   constants.path,
      method: "POST",
      body:   doc
    }).send();

    return {object: response, expect: response.data.documentElement.outerHTML, toBe: doc.documentElement.outerHTML};
  }, Test.constants);

  Test.VerifyRequest(response.object);
  expect(response.expect).toBe(response.toBe);
});
