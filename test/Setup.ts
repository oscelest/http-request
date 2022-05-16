import Puppeteer from "puppeteer";
import Test from "./Variables";
import Express from "express";
import BodyParser from "body-parser";

beforeAll(async () => {
  Test.application = Express();
  Test.application.use(BodyParser.urlencoded({extended: false}));
  Test.application.use(BodyParser.json());
  Test.application.use(BodyParser.text({type: "text/html"}));

  Test.application.all("*", async (request: Express.Request, response: Express.Response) => {
    const response_value = {
      method: request.method,
      query:  request.query,
      body:   request.body
    };

    setTimeout(() => response.status(200).json(response_value), 10);
  });

  Test.server = Test.application.listen(Test.constants.port);

  Test.browser = await Puppeteer.launch({
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins",
      "--disable-site-isolation-trials"
    ]
  });
});

beforeEach(async () => {
  Test.page = await Test.browser.newPage();
  Test.page.on("console", message => console.log(message.text()));
  await Test.page.addScriptTag({path: "./dist/umd/index.js"});
});

afterEach(async () => {
  await Test.page.close();
});

afterAll(async () => {
  Test.server.close();
  await Test.browser.close();
});
