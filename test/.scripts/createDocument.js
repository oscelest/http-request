function createDocument(constants) {
  const element = document.implementation.createHTMLDocument();

  const form = element.createElement("form");
  element.body.append(form);

  const string = element.createElement("input");
  string.setAttribute("type", "text");
  string.setAttribute("name", "string");
  string.setAttribute("value", constants.string);
  form.append(string);

  const number = element.createElement("input");
  number.setAttribute("type", "number");
  number.setAttribute("name", "number");
  number.setAttribute("value", constants.number);
  form.append(number);

  return element;
}
