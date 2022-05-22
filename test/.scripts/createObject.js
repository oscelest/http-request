function createObject(constants) {
  return {
    string:   constants.string,
    number:   constants.number,
    boolean:  constants.boolean,
    date:     new Date(constants.date),
    json:     constants.json,
    multiple: constants.multiple,
  };
}
