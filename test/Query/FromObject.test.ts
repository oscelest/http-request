import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";

test("QueryFromObject", async () => {
  const response = await Test.page.evaluate<(typeof Test.constants)[], (variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const object = {
      string: constants.string,
      number: constants.number,
      boolean: constants.boolean,
      date: new Date(constants.date),
      multiple: constants.multiple
    };

    return await new HTTPRequest({
      method: "GET",
      path: constants.path,
      query: object
    }).send();
  }, Test.constants);

  Test.VerifyRequest(response);
  Test.CompareURLSearchParams(response.data.query);
});
