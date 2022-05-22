function createFormData(constants) {
  const params = new FormData();
  params.append("string", constants.string);
  params.append("number", String(constants.number));
  params.append("boolean", String(constants.boolean));
  params.append("date", constants.date);
  params.append("file", new File([constants.file.data], constants.file.name));
  params.append("multiple", String(constants.multiple.at(0)));
  params.append("multiple", String(constants.multiple.at(1)));
  params.append("multiple", String(constants.multiple.at(2)));

  return params;
}
