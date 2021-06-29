var expect = require('chai').expect,
  SchemaUtils = require('../../lib/schemaUtils');
describe('Validator function tests', function () {
  describe('checkRequestBody function', function () {
    var requestBody = {
        mode: 'raw',
        raw: JSON.stringify({
          status: 200,
          result: true
        })
      },
      schemaPath = {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  status: {
                    type: 'integer'
                  },
                  result: {
                    type: 'boolean'
                  },
                  message: {
                    type: 'string'
                  }
                },
                required: ['status', 'result', 'message']
              }
            }
          }
        }
      };

    it('should return empty mismatch array if validationPropertiesToIgnore option includes BODY', function () {
      SchemaUtils.checkRequestBody({}, '$.request.body', '$.paths[/path1].get', {}, {}, {
        validationPropertiesToIgnore: ['BODY']
      }, (err, mismatches) => {
        expect(err).to.be.null;
        expect(mismatches).to.be.an('array').that.is.empty;
      });
    });

    it('should return empty mismatch array for empty/invalid/non-application/json bodies', function () {
      SchemaUtils.checkRequestBody({}, '$.request.body', '$.paths[/path1].get',
        {}, {}, {
          validationPropertiesToIgnore: []
        }, (err, mismatches) => {
          expect(err).to.be.null;
          expect(mismatches).to.be.an('array').that.is.empty;
        });
      SchemaUtils.checkRequestBody('invalid body', '$.request.body', '$.paths[/path1].get',
        {}, {}, {
          validationPropertiesToIgnore: []
        }, (err, mismatches) => {
          expect(err).to.be.null;
          expect(mismatches).to.be.an('array').that.is.empty;
        });
      SchemaUtils.checkRequestBody({
        mode: 'form-data',
        'form-data': []
      }, '$.request.body', '$.paths[/path1].get',
      {}, {}, {
        validationPropertiesToIgnore: []
      }, (err, mismatches) => {
        expect(err).to.be.null;
        expect(mismatches).to.be.an('array').that.is.empty;
      });
    });

    it('should return mismatch if body does not follow schema specified', function () {
      SchemaUtils.checkRequestBody(requestBody, '$.request.body', '$.paths[/path1].post', schemaPath, {}, {
        validationPropertiesToIgnore: []
      }, (err, mismatches) => {
        expect(err).to.be.null;
        expect(mismatches).to.deep.equal([
          {
            property: 'BODY',
            reason: 'The request body didn\'t match the specified schema',
            reasonCode: 'INVALID_BODY',
            schemaJsonPath: '$.paths[/path1].postrequestBody.content.application.json.schema',
            transactionJsonPath: '$.request.body'
          }
        ]);
      });
    });

    it('should return empty mismatch array when body conforms to the schema specified', function () {
      // remove the `message` property from required array
      schemaPath.requestBody.content['application/json'].schema.required.pop();
      SchemaUtils.checkRequestBody(requestBody, '$.request.body', '$.paths[/path1].post', schemaPath, {}, {
        validationPropertiesToIgnore: []
      }, (err, mismatches) => {
        expect(err).to.be.null;
        expect(mismatches).to.be.an('array').that.is.empty;
      });
    });
  });
});
