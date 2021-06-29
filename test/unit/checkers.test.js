var expect = require('chai').expect,
  Converter = require('../../index.js'),
  fs = require('fs'),
  path = require('path'),
  sdk = require('postman-collection'),
  schemaUtils = require('../../lib/schemaUtils.js'),
  VALID_OPENAPI_PATH = '../data/validationData/spec-to-validate-against.json',
  HISTORY_PATH = '../data/validationData/history_obj.json';

describe('Method: checkPathVariables()', function () {
  var openapi = JSON.parse(fs.readFileSync(path.join(__dirname, VALID_OPENAPI_PATH), 'utf8')),
    historyRequest = JSON.parse(fs.readFileSync(path.join(__dirname, HISTORY_PATH), 'utf8'));

  it('should check for correct path varibales', function (done) {
    let schemaPack = new Converter.SchemaPack({ type: 'json', data: openapi }, {});
    var schema = schemaPack.openapi,
      componentsAndPaths = {
        components: schema.components,
        paths: schema.paths
      },
      options = schemaPack.computedOptions,
      schemaResolutionCache = schemaPack.schemaResolutionCache;

    historyRequest.map((transaction) => {
      let requestUrl = transaction.request.url,
        matchedPaths;
      if (typeof requestUrl === 'object') {
        requestUrl = (new sdk.Url(requestUrl)).toString();
      }
      matchedPaths = schemaUtils.findMatchingRequestFromSchema(
        transaction.request.method,
        requestUrl,
        schema
      );
      matchedPaths.map((matchedPath) => {
        schemaUtils.checkPathVariables(matchedPath.pathVariables, '$.request.url', matchedPath.path,
          componentsAndPaths, options, schemaResolutionCache, (err, result) => {
            expect(err).to.be.null;
            // eslint-disable-next-line no-console
            console.log(result);
          });
      });
    });
    done();
  });
});
