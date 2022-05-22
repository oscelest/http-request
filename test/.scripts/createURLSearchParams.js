function createURLSearchParams(constants) {
  const params = new URLSearchParams();
  params.append("string", constants.string);
  params.append("number", String(constants.number));
  params.append("boolean", String(constants.boolean));
  params.append("date", constants.date);
  params.append("multiple", String(constants.multiple.at(0)));
  params.append("multiple", String(constants.multiple.at(1)));
  params.append("multiple", String(constants.multiple.at(2)));

  return params;
}
