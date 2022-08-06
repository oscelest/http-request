import Test from "../Variables";

test("DocumentToArrayBuffer", async () => {
  await Test.page.addScriptTag({path: "./test/.scripts/createDocument.js"});

   await Test.page.evaluate<(typeof Test.constants)[],(variable: typeof Test.constants) => Promise<any>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const doc = window.createDocument(constants);

    const response = await new HTTPRequest({
      path:    constants.path,
      method:  "POST",
      body:    doc,
      headers: {
        "content-type": "application/octet-stream"
      }
    }).send();

    return {object: response, expect: response.data, toBe: doc.documentElement.outerHTML};
  }, Test.constants);

  // Test.VerifyRequest(response.object);
  // expect(response.expect).toBe(response.toBe);
});
