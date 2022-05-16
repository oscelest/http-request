function createForm(constants) {
  const form = document.createElement("form");

  const string = document.createElement("input");
  string.setAttribute("type", "text");
  string.setAttribute("name", "string");
  string.setAttribute("value", constants.string);
  form.append(string);

  const number = document.createElement("input");
  number.setAttribute("type", "number");
  number.setAttribute("name", "number");
  number.setAttribute("value", constants.number);
  form.append(number);

  return form;
}
