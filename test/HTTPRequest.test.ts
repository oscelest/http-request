import HTTPRequest from "../src/HTTPRequest";
import HTTPRequestState from "../src/HTTPRequestState";
import HTTPMethod from "@noxy/http-utils/src/HTTPMethod";
import Puppeteer from "puppeteer";

const constants = {} as {browser: Puppeteer.Browser, page: Puppeteer.Page};

beforeAll(async () => {
  constants.browser = await Puppeteer.launch({
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins",
      "--disable-site-isolation-trials"
    ]
  });
  constants.page = await constants.browser.newPage();

  await constants.page.addScriptTag({path: "./dist/umd/index.js"});
});

afterAll(async () => {
  await constants.page.close();
  await constants.browser.close();
});

test("create", async () => {
  const result = await constants.page.evaluate(async () => {
    const HTTPRequest = window["http-request"].HTTPRequest;
    try {
      const request = new HTTPRequest({path: "https://httpstat.us/200", method: HTTPMethod.GET});
      return await request.init();
    }
    catch (exception) {
      return exception;
    }
  });

  expect(result).toBe("200 OK");
});

declare global {
  interface Window {
    "http-request": {
      HTTPRequest: typeof HTTPRequest
      HTTPRequestState: typeof HTTPRequestState
    };
  }
}
