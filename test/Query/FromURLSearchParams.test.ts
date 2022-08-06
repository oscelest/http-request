import HTTPResponse from "../../src/HTTPResponse";
import Test from "../Variables";

test("FromURLSearchParams", async () => {
  const response = await Test.page.evaluate<(typeof Test.constants)[], (variable: typeof Test.constants) => Promise<HTTPResponse>>(async constants => {
    const {HTTPRequest} = window["http-request"];
    const params = new URLSearchParams();
    params.append("string", constants.string);
    params.append("number", JSON.stringify(constants.number));
    params.append("boolean", JSON.stringify(constants.boolean));
    params.append("date", constants.date);
    params.append("multiple", String(constants.multiple.at(0)));
    params.append("multiple", String(constants.multiple.at(1)));
    params.append("multiple", String(constants.multiple.at(2)));

    return await new HTTPRequest({
      method: "GET",
      path:   constants.path,
      query:  params
    }).send();
  }, Test.constants);

  Test.VerifyRequest(response);
  Test.CompareURLSearchParams(response.data.query);
});
