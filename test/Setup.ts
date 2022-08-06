import Puppeteer from "puppeteer";
import Test from "./Variables";
import Express from "express";
import BodyParser from "body-parser";
import Multer from "multer";
import FS from "fs";

beforeAll(async () => {
  Test.application = Express();
  Test.application.use(BodyParser.urlencoded({extended: false}));
  Test.application.use(BodyParser.json());
  Test.application.use(BodyParser.text({type: "text/plain"}));
  Test.application.use(BodyParser.text({type: "text/html"}));
  Test.application.use(BodyParser.text({type: "application/octet-stream"}));

  function uploadMW(request: Express.Request, response: Express.Response, next: Express.NextFunction) {
    Multer({dest: "./files"}).any()(request, response, (error) => {
      if (error) {
        console.log(error);
      }
    });
    next();
  }

  Test.application.all("*", uploadMW, async (request: Express.Request, response: Express.Response) => {
    response.status(200);

    setTimeout(() => {
      const type = request.headers["content-type"]?.toLowerCase() ?? "";
      if (type.includes("text/plain") || type.includes("text/html") || type.includes("application/octet-stream")) {
        response.type(type);
        response.send(request.body);
      }
      else {
        const files = [] as {name: string, data: string}[];
        if (Array.isArray(request.files) && request.files.length) {
          for (let file of request.files) {
            files.push({name: file.originalname, data: FS.readFileSync(file.path).toString()});
          }
        }

        response.json({
          header: type,
          method: request.method,
          query:  request.query,
          body:   request.body,
          files:  files
        });
      }
    }, 10);
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
  Test.page.on("console", message => console.log(message.text())); // Uncomment for debugging
  await Test.page.addScriptTag({path: "./dist/umd/index.js"});
});

afterEach(async () => {
  await Test.page.close();
});

afterAll(async () => {
  FS.rmSync("./files", {recursive: true, force: true});
  Test.server.close();
  await Test.browser.close();
});
