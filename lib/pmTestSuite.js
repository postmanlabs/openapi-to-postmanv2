const _ = require('lodash'),
  deref = require('./deref.js'),
  defaultOptions = require('../lib/options.js').getOptions('use'),
  APP_JSON = 'application/json',
  // These are the methods supported in the PathItem schema
  // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#pathItemObject
  METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];


module.exports = {
  /**
   * function to convert an openapi reponse object to object of postman tests
   * @param {*} operation openapi operation object
   * @param {*} operationItem - The operation item to get relevant information for the test generation
   * @param {object} components - components defined in the OAS spec. These are used to
   * resolve references while generating params.
   * @param {object} options - a standard list of options that's globally passed around. Check options.js for more.
   * @param {object} schemaCache - object storing schemaFaker and schemeResolution caches
   * @returns {*} array of all tests
   */
  convertResponsesToPmTest: function (operation, operationItem, components, options, schemaCache) {
    options = _.merge({}, defaultOptions, options);
    let testSuite = {},
      testSuiteSettings = {},
      testSuiteLimits = [],
      testSuiteExtensions = [],
      pmTests = [],
      swagResponse = {};

    // Check for test suite flag, abort early
    if (!options.testSuite) {
      return pmTests;
    }

    // Check test suite for later usage, potentially convert object
    if (options.testSuite && options.testSuiteSettings) {
      testSuite = options.testSuiteSettings;
      if (testSuite.generateTests) {
        testSuiteSettings = options.testSuiteSettings.generateTests;
      }

      // Limit the test generation to the following operations
      if (testSuiteSettings.limitOperations) {
        testSuiteLimits = testSuiteSettings.limitOperations;
      }

      // Extend the generated test with additional operations
      if (testSuite.extendTests) {
        testSuiteExtensions = options.testSuiteSettings.extendTests;

        testSuiteExtensions.forEach((testExtension) => {
          if (operation.operationId && testExtension.openApiOperationId &&
            operation.operationId === testExtension.openApiOperationId &&
            testExtension && testExtension.responseChecks) {
            // Extend testSuiteSettings with testExtension settings
            testSuiteSettings.responseChecks = _.merge(
              {}, testSuiteSettings.responseChecks, testExtension.responseChecks
            );
          }
        });
      }

    }

    _.forOwn(operation.responses, (response, code) => {
      // Skip the operations, if there are limits defined
      if (operation.operationId && testSuiteLimits.length > 0 &&
        testSuiteLimits.indexOf(operation.operationId) === -1) {
        return; // skip this response
      }

      // Only support 2xx response checks
      // TODO Investigate how to support other response codes like validation response 4xx or 5xx
      if (!_.inRange(code, 200, 299)) {
        return; // skip this response
      }

      // Format response
      swagResponse = response;
      if (response.$ref) {
        swagResponse = this.getRefObject(response.$ref, components, options);
      }

      // Add status code check
      // TODO Validate other request codes
      // if (operationItem.method.toUpperCase() === 'GET') {
      //   pmTests.push(
      //     '// Validate status code \n'+
      //     'pm.test("Status code should be '+code+'", function () {\n' +
      //     '    pm.response.to.have.status('+code+');\n' +
      //     '});\n'
      //   )
      // }

      // Add status success check
      if (_.get(testSuiteSettings, 'responseChecks.StatusSuccess.enabled')) {
        pmTests.push(
          '// Validate status 2xx \n' +
          'pm.test("[' + operationItem.method.toUpperCase() + '] /' + operationItem.path +
          ' - Status code is 2xx", function () {\n' +
          '   pm.response.to.be.success;\n' +
          '});\n'
        );
      }

      // Add response timer check
      if (_.get(testSuiteSettings, 'responseChecks.responseTime.enabled')) {
        let maxMs = _.get(testSuiteSettings, 'responseChecks.responseTime.maxMs');
        pmTests.push(
          '// Validate response time \n' +
          'pm.test("[' + operationItem.method.toUpperCase() + '] /' + operationItem.path +
          ' - Response time is less than ' + maxMs + 'ms", function () {\n' +
          '    pm.expect(pm.response.responseTime).to.be.below(' + maxMs + ');\n' +
          '});\n'
        );
      }

      // Process the response content
      _.forOwn(swagResponse.content, (content, contentType) => {
        if (contentType) {
          // Add content-type check
          if (_.get(testSuiteSettings, 'responseChecks.contentType.enabled')) {
            pmTests.push(
              '// Validate content-type \n' +
              'pm.test("[' + operationItem.method.toUpperCase() + '] /' + operationItem.path +
              ' - Content-Type is ' + contentType + '", function () {\n' +
              '   pm.expect(pm.response.headers.get("Content-Type")).to.include("' + contentType + '");\n' +
              '});\n'
            );
          }

          if (contentType === APP_JSON) {
            let resolvedSchema,
              pmVariablesCounter = 0;

            // Add JSON body check
            if (_.get(testSuiteSettings, 'responseChecks.jsonBody.enabled')) {
              pmTests.push(
                '// Response should have JSON Body\n' +
                'pm.test("[' + operationItem.method.toUpperCase() + '] /' + operationItem.path +
                ' - Response has JSON Body", function () {\n' +
                '    pm.response.to.have.jsonBody();\n' +
                '});\n');
            }

            // Add JSON schema check
            if (_.get(testSuiteSettings, 'responseChecks.schemaValidation.enabled') && content.schema) {
              let schemaContent = content.schema;
              // if (content.schema.$ref) {
              //   schemaContent = this.getRefObject(content.schema.$ref, components, options);
              // }

              try {
                // When processing a reference, schema.type could also be undefined
                resolvedSchema = deref.resolveRefs(_.cloneDeep(schemaContent), 'response', components,
                  schemaCache, 'VALIDATION', 'example', 0, {}, 999);

                // deletes nullable and adds "null" to type array if nullable is true
                let jsonSchema = this.convertUnsupportedJsonSchemaProperties(resolvedSchema);

                pmTests.push(
                  '// Response Validation\n' +
                  'const schema = ' + JSON.stringify(jsonSchema) + '\n' +
                  '\n' +
                  '// Test whether the response matches the schema\n' +
                  'pm.test("[' + operationItem.method.toUpperCase() + '] /' + operationItem.path +
                  ' - Schema is valid", function() {\n' +
                  '   pm.response.to.have.jsonSchema(schema,{unknownFormats: ["int32", "int64"]});\n' +
                  '});\n'
                );
              }
              catch (e) {
                console.warn('JSON schema check failed', e);
                console.warn('invalid schemaValidation for ', content);
              }
            }

            // Add content checks for JSON response
            if (testSuite.contentChecks) {
              let testSuiteContentChecks = testSuite.contentChecks,
                // Get the checkResponseBody settings for the operationId or openApiOperation
                setContentChecksForOperation = testSuiteContentChecks.find((or) => {
                  return this.isMatchOperationItem(operationItem, or);
                });

              if (setContentChecksForOperation && setContentChecksForOperation.checkResponseBody) {
                let responseBodyChecks = setContentChecksForOperation.checkResponseBody;
                responseBodyChecks.forEach((check) => {
                  // Only set the jsonData once
                  if (pmVariablesCounter === 0) {
                    pmTests.push(
                      '// Set response object as internal variable\n' +
                      'let jsonData = pm.response.json();\n');
                  }

                  if (check.key) {
                    pmTests.push(
                      '// Response body should have property "' + check.key + '"\n' +
                      'pm.test("[' + operationItem.method.toUpperCase() + '] /' + operationItem.path +
                      ' - Content check if property \'' + check.key + '\' exists", function() {\n' +
                      '   pm.expect((typeof jsonData.' + check.key + ' !== "undefined")).to.be.true;\n' +
                      '});\n'
                    );
                  }

                  if (check.value) {
                    let checkValue = check.value;
                    if (!(typeof check.value === 'number' || typeof check.value === 'boolean')) {
                      checkValue = '"' + check.value + '"';
                    }
                    if (check.value.includes('{{') && check.value.includes('}}')) {
                      checkValue = 'pm.environment.get("' + check.value.replace(/{{|}}/g,'') + '")';
                    }

                    pmTests.push(
                      '// Response body should have value "' + check.value + '" for "' + check.key + '"\n' +
                      'if (typeof jsonData.' + check.key + ' !== "undefined") {\n' +
                      'pm.test("[' + operationItem.method.toUpperCase() + '] /' + operationItem.path +
                      ' - Content check if value for \'' + check.key + '\' matches \'' +
                      check.value + '\'", function() {\n' +
                      '  pm.expect(jsonData.' + check.key + ').to.eql(' + checkValue + ');\n' +
                      '})};\n'
                    );
                  }
                  pmVariablesCounter++;
                });
              }
            }

            // Automatic set the response.id as an environment variable for chaining option
            if (operationItem.method.toUpperCase() === 'POST' && resolvedSchema !== undefined &&
              resolvedSchema.properties && resolvedSchema.properties.id) {
              let opsRef = (operation.operationId) ?
                operation.operationId :
                this.getOpenApiOperationRef(operationItem, 'PMVAR');

              // Only set the jsonData once
              if (pmVariablesCounter === 0) {
                pmTests.push(
                  '// Set response object as internal variable\n' +
                  'let jsonData = pm.response.json();\n');
              }
              pmTests.push(
                '// pm.environment - Set ' + opsRef + '.id as environment variable \n' +
                'if (typeof jsonData.id !== "undefined") {\n' +
                '   pm.environment.set("' + opsRef + '.id",jsonData.id);\n' +
                '   console.log("pm.environment - use {{' + opsRef + '.id}} ' +
                'as variable for value", jsonData.id);\n' +
                '};\n');
              // eslint-disable-next-line no-console
              console.log('- pm.environment for "' + opsRef + '.id" - use {{' +
                opsRef + '.id}} as variable for "reponse.id');
              pmVariablesCounter++;
            }

            // Assign defined PmVariables for JSON response
            if (testSuite.assignPmVariables) {
              let testSuiteAssignPmVariables = testSuite.assignPmVariables,
                // Get the environmentVariables settings for the operationId or openApiOperation
                assignPmVariablesForOperation = testSuiteAssignPmVariables.find((or) => {
                  return this.isMatchOperationItem(operationItem, or);
                });

              if (assignPmVariablesForOperation && assignPmVariablesForOperation.environmentVariables) {
                let assignEnvironmentVariables = assignPmVariablesForOperation.environmentVariables;

                assignEnvironmentVariables.forEach((environmentVariable) => {
                  let i = 0;
                  // Set value as variable
                  if (environmentVariable.value) {
                    // Set variable name
                    let opsRef = (operation.operationId) ?
                      operation.operationId :
                      this.getOpenApiOperationRef(operationItem, 'PMVAR');
                    let varName = opsRef + '.var-' + i; // eslint-disable-line one-var
                    if (environmentVariable.name) {
                      varName = environmentVariable.name;
                    }
                    pmTests.push(
                      '// pm.environment - Set a value for ' + varName + '\n' +
                      'pm.environment.set("' + varName + '",' + environmentVariable.value + ')\n'
                    );
                    // eslint-disable-next-line no-console
                    console.log('- pm.environment for "' + opsRef + '" - use {{' + varName + '}} ' +
                      'as variable for "' + environmentVariable.value + '"');
                    i++;
                  }

                  // Set response body property as variable
                  if (environmentVariable.responseProp || environmentVariable.responseBodyProp) {
                    let responseProp = (environmentVariable.responseProp) ?
                        environmentVariable.responseProp :
                        environmentVariable.responseBodyProp,
                      opsRef = (operation.operationId) ?
                        operation.operationId :
                        this.getOpenApiOperationRef(operationItem, 'PMVAR');

                    // Set variable name
                    let varName = opsRef + '.' + responseProp; // eslint-disable-line one-var
                    if (environmentVariable.name) {
                      varName = environmentVariable.name;
                    }
                    // Only set the jsonData once
                    if (pmVariablesCounter === 0) {
                      pmTests.push(
                        '// Set response object as internal variable\n' +
                        'let jsonData = pm.response.json();\n');
                    }
                    pmTests.push(
                      '// pm.environment - Set ' + varName + ' as variable for jsonData.' + responseProp + '  \n' +
                      'if (typeof jsonData.' + responseProp + ' !== "undefined") {\n' +
                      '   pm.environment.set("' + varName + '",jsonData.' + responseProp + ');\n' +
                      '   console.log("pm.environment - use {{' + varName + '}} as variable for value", ' +
                      'jsonData.' + responseProp + ');\n' +
                      '};\n');
                    // eslint-disable-next-line no-console
                    console.log('- pm.environment for "' + opsRef + '" - use {{' + varName + '}} ' +
                      'as variable for "reponse.' + responseProp + '"');
                    pmVariablesCounter++;
                  }
                });
              }
            }

          }
        }

      });

      // Process the response header
      _.forOwn(swagResponse.headers, (header, headerKey) => {

        if (headerKey && header.name) {
          // Add content-type check
          if (_.get(testSuiteSettings, 'responseChecks.headersPresent.enabled')) {
            pmTests.push(
              '// Validate header \n' +
              'pm.test("[' + operationItem.method.toUpperCase() + '] /' + operationItem.path +
              ' - Response header ' + header.name + ' is present", function () {\n' +
              '   pm.response.to.have.header("' + header.name + '");\n' +
              '});\n'
            );
          }
        }

      });

      // Assign defined PmVariables for response headers
      if (testSuite.assignPmVariables) {
        let testSuiteAssignPmVariables = testSuite.assignPmVariables,
          // Get the environmentVariables settings for the operationId or openApiOperation
          assignPmVariablesForOperation = testSuiteAssignPmVariables.find((or) => {
            return this.isMatchOperationItem(operationItem, or);
          });

        if (assignPmVariablesForOperation && assignPmVariablesForOperation.environmentVariables) {
          let assignEnvironmentVariables = assignPmVariablesForOperation.environmentVariables;

          assignEnvironmentVariables.forEach((environmentVariable) => {
            // Set response header property as variable
            if (environmentVariable.responseHeaderProp) {
              let headerProp = environmentVariable.responseHeaderProp,
                opsRef = (operation.operationId) ?
                  operation.operationId :
                  this.getOpenApiOperationRef(operationItem, 'PMVAR');

              // Set variable name
              let varName = opsRef + '.' + headerProp; // eslint-disable-line one-var
              if (environmentVariable.name) {
                varName = environmentVariable.name;
              }

              // Safe variable name
              let safeVarName = varName.replace(/-/g, '') // eslint-disable-line one-var
                .replace(/_/g, '').replace(/ /g, '')
                .replace(/\./g, '');

              pmTests.push(
                String('// pm.environment - Set ' + varName + ' as environment variable \n' +
                  'let ' + safeVarName + ' = pm.response.headers.get("' + headerProp + '"); \n' +
                  'if (' + safeVarName + ' !== undefined) {\n' +
                  '   pm.environment.set("' + varName + '",' + safeVarName + ');\n' +
                  '   console.log("pm.environment - use {{' + varName + '}} as variable for value", ') +
                safeVarName + ');\n' +
                '};\n');
              // eslint-disable-next-line no-console
              console.log('- pm.environment for "' + opsRef + '" - use {{' + varName + '}} ' +
                'as variable for "header.' + headerProp + '"');
            }

          });
        }
      }

    });

    // Add test extensions that are defined in the test suite file
    if (testSuiteExtensions.length > 0) {
      testSuiteExtensions.forEach((testExtension) => {
        if (operation.operationId && testExtension.openApiOperationId &&
          operation.operationId === testExtension.openApiOperationId) {

          if (testExtension && testExtension.overwrite && testExtension.overwrite === true) {
            // Reset generated tests
            pmTests = [];
          }

          // Add test extensions
          if (testExtension.tests && testExtension.tests.length > 0) {
            testExtension.tests.forEach((postmanTest) => {
              try {
                // Extend the generated tests, with the test extension scripts
                pmTests.push(postmanTest);
              }
              catch (e) {
                console.warn('invalid extendTests for ' + testExtension.openApiOperationI);
              }
            });
          }
        }
      });
    }

    return pmTests;
  },

  /**
   * function to overwrite a request body with values defined by the postman testsuite
   * @param {*} requestBody object
   * @param {*} operation openapi operation object
   * @param {*} operationItem - The operation item to get relevant information for the test generation
   * @param {object} options - a standard list of options that's globally passed around. Check options.js for more.
   * @returns {*} Modified requestBody object
   */
  overwriteRequestBodyByTests: function (requestBody, operation, operationItem, options) {
    options = _.merge({}, defaultOptions, options);
    let testRequestBody = Object.assign({}, requestBody), // clone requestBody before manipulation
      bodyString,
      find,
      replace,
      testSuite = {},
      overwriteValues = [],
      testSuiteOverwriteRequest = {},
      testSuiteOverwriteRequests = [];

    // Check for test suite flag and if there is RAW requestBody, abort early
    if (!options.testSuite && !requestBody.raw) {
      return requestBody;
    }

    if (options.testSuite && options.testSuiteSettings) {
      testSuite = options.testSuiteSettings;
    }

    if (testSuite.overwriteRequests) {
      testSuiteOverwriteRequests = options.testSuiteSettings.overwriteRequests;
      // Get the overwrite setting for the operationId or openApiOperation
      testSuiteOverwriteRequest = testSuiteOverwriteRequests.find((or) => {
        return this.isMatchOperationItem(operationItem, or);
      });

      if (testSuiteOverwriteRequest && testSuiteOverwriteRequest.overwriteRequestBody) {
        overwriteValues = testSuiteOverwriteRequest.overwriteRequestBody;

        // Overwrite values for Keys
        let bodyData = JSON.parse(testRequestBody.raw);
        overwriteValues.forEach((overwriteValue) => {
          if (overwriteValue.key && overwriteValue.hasOwnProperty('value')) {
            let orgValue = _.get(bodyData, overwriteValue.key),
              newValue = overwriteValue.value;

            if (overwriteValue.overwrite === false) {
              newValue = orgValue + newValue;
            }

            bodyData = _.set(bodyData, overwriteValue.key, newValue);

            if (overwriteValue.remove === true) {
              bodyData = _.omit(bodyData, overwriteValue.key);
            }
          }
        });
        bodyString = JSON.stringify(bodyData, null, 4);

        // Handle {{$randomInt}},{{$randomCreditCardMask}} conversion from string to number
        find = ['"{{$randomInt}}"', '"{{$randomCreditCardMask}}"', '"{{$randomBankAccount}}"'];
        replace = ['{{$randomInt}}', '{{$randomCreditCardMask}}', '{{$randomBankAccount}}'];
        find.forEach(function (item, index) {
          let escapedFind = item.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
          bodyString = bodyString.replace(new RegExp(escapedFind, 'g'), replace[index]);
        });

        // Set testRequestBody.raw with stringified body
        testRequestBody.raw = bodyString;
      }
    }

    return testRequestBody;
  },

  /**
   * function to overwrite a request path variables with values defined by the postman testsuite
   * @param {*} requestPathVariables request Path Variables object
   * @param {*} operation openapi operation object
   * @param {*} operationItem - The operation item to get relevant information for the test generation
   * @param {object} options - a standard list of options that's globally passed around. Check options.js for more.
   * @returns {*} Modified requestBody object
   */
  overwriteRequestPathByTests: function (requestPathVariables, operation, operationItem, options) {
    options = _.merge({}, defaultOptions, options);
    let testRequestPathVariables = JSON.parse(JSON.stringify(requestPathVariables)), // clone requestPathVariables
      testSuite = {},
      overwriteValues = [],
      testSuiteOverwriteRequest = {},
      testSuiteOverwriteRequests = [];

    // Check for test suite flag and if there is no requestPathVariables, abort early
    if (!options.testSuite && requestPathVariables.length > 0) {
      return requestPathVariables;
    }

    if (options.testSuite && options.testSuiteSettings) {
      testSuite = options.testSuiteSettings;
    }

    if (testSuite.overwriteRequests) {
      testSuiteOverwriteRequests = options.testSuiteSettings.overwriteRequests;
      // Get the overwrite setting for the operationId or openApiOperation
      testSuiteOverwriteRequest = testSuiteOverwriteRequests.find((or) => {
        return this.isMatchOperationItem(operationItem, or);
      });

      if (testSuiteOverwriteRequest && testSuiteOverwriteRequest.overwriteRequestPathVariables) {
        overwriteValues = testSuiteOverwriteRequest.overwriteRequestPathVariables;

        // Overwrite value for path variable name
        testRequestPathVariables.forEach((pathVar, index) => {
          overwriteValues.forEach((overwriteValue) => {
            if (overwriteValue.key && pathVar.name && overwriteValue.key === pathVar.name &&
              overwriteValue.hasOwnProperty('value') && pathVar.schema) {
              let orgValue = (pathVar.schema.example ? pathVar.schema.example : null),
                newValue = overwriteValue.value;

              if (overwriteValue.overwrite === false) {
                newValue = orgValue + newValue;
              }
              pathVar.schema.type = 'string'; // Set schema as type string dynamic variable
              pathVar.schema.example = newValue;

              if (overwriteValue.remove === true) {
                testRequestPathVariables.splice(index, 1);
              }
            }
          });
        });
      }
    }
    return testRequestPathVariables;
  },

  /**
   * function to overwrite a request query params with values defined by the postman testsuite
   * @param {*} requestQueryParam request Query Param object
   * @param {*} operation openapi operation object
   * @param {*} operationItem - The operation item to get relevant information for the test generation
   * @param {object} options - a standard list of options that's globally passed around. Check options.js for more.
   * @returns {*} Modified requestBody object
   */
  overwriteRequestQueryParamByTests: function (requestQueryParam, operation, operationItem, options) {
    options = _.merge({}, defaultOptions, options);
    let testRequestQueryParam = Object.assign({}, requestQueryParam), // clone requestQueryParam
      testSuite = {},
      overwriteValues = [],
      testSuiteOverwriteRequest = {},
      testSuiteOverwriteRequests = [];

    // Check for test suite flag and if there is no requestQueryParam.key, abort early
    if (!options.testSuite && !requestQueryParam.key) {
      return requestQueryParam;
    }

    if (options.testSuite && options.testSuiteSettings) {
      testSuite = options.testSuiteSettings;
    }

    if (testSuite.overwriteRequests) {
      testSuiteOverwriteRequests = options.testSuiteSettings.overwriteRequests;
      // Get the overwrite setting for the operationId or openApiOperation
      testSuiteOverwriteRequest = testSuiteOverwriteRequests.find((or) => {
        return this.isMatchOperationItem(operationItem, or);
      });

      if (testSuiteOverwriteRequest && testSuiteOverwriteRequest.overwriteRequestQueryParams) {
        overwriteValues = testSuiteOverwriteRequest.overwriteRequestQueryParams;

        // Overwrite value for query param key
        overwriteValues.forEach((overwriteValue) => {
          if (overwriteValue.key && testRequestQueryParam.key && overwriteValue.key === testRequestQueryParam.key) {

            // Test suite - Overwrite/extend query param value
            if (overwriteValue.hasOwnProperty('value') && testRequestQueryParam.hasOwnProperty('value')) {
              let orgValue = testRequestQueryParam.value,
                newValue = overwriteValue.value;

              if (overwriteValue.overwrite === false) {
                newValue = orgValue + newValue;
              }
              testRequestQueryParam.value = newValue;
            }

            // Test suite - Disable query param
            if (overwriteValue.disable === true) {
              testRequestQueryParam.disabled = true;
            }

            // Test suite - Remove query param
            if (overwriteValue.remove === true) {
              testRequestQueryParam = {};
            }
          }
        });
      }
    }
    return testRequestQueryParam;
  },

  /**
   * function to overwrite a request header with values defined by the postman testsuite
   * @param {*} requestHeader request Header object
   * @param {*} operation openapi operation object
   * @param {*} operationItem - The operation item to get relevant information for the test generation
   * @param {object} options - a standard list of options that's globally passed around. Check options.js for more.
   * @returns {*} Modified requestBody object
   */
  overwriteRequestHeaderByTests: function (requestHeader, operation, operationItem, options) {
    options = _.merge({}, defaultOptions, options);
    let testRequestHeader = Object.assign({}, requestHeader), // clone requestHeader
      testSuite = {},
      overwriteValues = [],
      testSuiteOverwriteRequest = {},
      testSuiteOverwriteRequests = [];

    // Check for test suite flag and if there is no requestHeader.schema, abort early
    if (!options.testSuite && !requestHeader.schema) {
      return requestHeader;
    }

    if (options.testSuite && options.testSuiteSettings) {
      testSuite = options.testSuiteSettings;
    }

    if (testSuite.overwriteRequests) {
      testSuiteOverwriteRequests = options.testSuiteSettings.overwriteRequests;
      // Get the overwrite setting for the operationId or openApiOperation
      testSuiteOverwriteRequest = testSuiteOverwriteRequests.find((or) => {
        return this.isMatchOperationItem(operationItem, or);
      });

      if (testSuiteOverwriteRequest && testSuiteOverwriteRequest.overwriteRequestHeaders) {
        overwriteValues = testSuiteOverwriteRequest.overwriteRequestHeaders;
        // Overwrite value for header name
        overwriteValues.forEach((overwriteValue) => {
          if (overwriteValue.key && testRequestHeader.name && overwriteValue.key === testRequestHeader.name &&
            overwriteValue.hasOwnProperty('value') && testRequestHeader.schema) {
            let orgValue = (testRequestHeader.schema.example ? testRequestHeader.schema.example : null),
              newValue = overwriteValue.value;

            if (overwriteValue.overwrite === false) {
              newValue = orgValue + newValue;
            }
            testRequestHeader.schema.example = newValue;

            if (overwriteValue.remove === true) {
              testRequestHeader = {};
            }
          }
        });
      }
    }
    return testRequestHeader;
  },

  /**
   * function to assign PM variables with values defined by the request body from OpenApi
   * @param {*} requestBody request Body object
   * @param {*} operation openapi operation object
   * @param {*} operationItem - The operation item to get relevant information for the test generation
   * @param {object} options - a standard list of options that's globally passed around. Check options.js for more.
   * @returns {*} Postman Test scripts array
   */
  assignVariablesByRequestBody: function (requestBody, operation, operationItem, options) {
    options = _.merge({}, defaultOptions, options);
    let testSuite = {},
      pmTests = [];

    // Check for test suite flag and if there is RAW requestBody, abort early
    if (!options.testSuite && !requestBody.raw) {
      return requestBody;
    }

    if (options.testSuite && options.testSuiteSettings) {
      testSuite = options.testSuiteSettings;
    }
    if (testSuite.assignPmVariables) {
      let testSuiteAssignPmVariables = testSuite.assignPmVariables,
        // Get the environmentVariables settings for the operationId or openApiOperation
        assignPmVariablesForOperation = testSuiteAssignPmVariables.find((or) => {
          return this.isMatchOperationItem(operationItem, or);
        });

      if (assignPmVariablesForOperation && assignPmVariablesForOperation.environmentVariables) {
        let assignEnvironmentVariables = assignPmVariablesForOperation.environmentVariables;

        assignEnvironmentVariables.forEach((environmentVariable) => {
          // Set request body property as variable
          if (environmentVariable.requestBodyProp) {
            let responseProp = environmentVariable.requestBodyProp,
              opsRef = (operation.operationId) ?
                operation.operationId :
                this.getOpenApiOperationRef(operationItem, 'PMVAR');

            // Set variable name
            let varName = opsRef + '.' + responseProp; // eslint-disable-line one-var
            if (environmentVariable.name) {
              varName = environmentVariable.name;
            }

            // Set variable value
            const requestBodyObj = JSON.parse(requestBody.raw);
            if (typeof requestBodyObj[responseProp] !== 'undefined') {
              let requestBodyValue = requestBodyObj[responseProp];
              if (!(typeof requestBodyValue === 'number' || typeof requestBodyValue === 'boolean')) {
                requestBodyValue = '"' + requestBodyValue + '"';
              }
              pmTests.push(
                '// pm.environment - Set ' + varName + ' as environment variable from request body \n' +
                'pm.environment.set("' + varName + '",' + requestBodyValue + ');\n' +
                'console.log("pm.environment - use {{' + varName + '}} as variable for value", ' +
                requestBodyValue + ');\n'
              );
              // eslint-disable-next-line no-console
              console.log('- pm.environment for "' + opsRef + '" - use {{' + varName + '}} ' +
                'as variable for "request.' + responseProp + '"');
            }
          }
        });
      }
    }

    return pmTests;
  },

  /**
   * function to convert unsupported OpenAPI(3.0) properties to valid JSON schema properties
   * @param {*} oaSchema openAPI schema
   * @returns {*} Modified openAPI schema object that is compatible with JSON schema validation
   */
  convertUnsupportedJsonSchemaProperties: function (oaSchema) {
    let jsonSchema = JSON.parse(JSON.stringify(oaSchema)); // Deep copy of the schema object

    // Convert unsupported OpenAPI(3.0) properties to valid JSON schema properties
    // let jsonSchemaNotSupported = ['nullable', 'discriminator', 'readOnly', 'writeOnly', 'xml',
    //   'externalDocs', 'example', 'deprecated'];

    // Recurse through OpenAPI Schema
    const traverse = (obj) => {
      for (let k in obj) {
        if (obj.hasOwnProperty(k) && obj[k] && typeof obj[k] === 'object') {
          if (obj[k].nullable && obj[k].nullable === true) {
            // deletes nullable and adds "null" to type array if nullable is true
            let jsonTypes = [];
            jsonTypes.push(obj[k].type);
            jsonTypes.push('null');
            obj[k].type = jsonTypes;
            delete obj[k].nullable;
          }
          if (obj[k].maxItems && obj[k].maxItems === 2 && obj[k].type === 'array') {
            // deletes maxItems, which is added unwanted by resolveRefs() in combination with resolveFor CONVERSION
            // TODO find another way to respect the maxItems that might be passed by OpenAPI
            // Asked for assistance https://github.com/postmanlabs/openapi-to-postman/issues/367
            delete obj[k].maxItems;
          }
          traverse(obj[k]);
        }
      }
    };
    traverse(jsonSchema);
    return jsonSchema;
  },

  // TODO remove this function, use a reference to schemaUtils instead
  /**
   * @param {*} $ref reference object
   * @param {*} components the components
   * @param {object} options - a standard list of options that's globally passed around. Check options.js for more.
   * @returns {Object} reference object from the saved components
   * @no-unit-tests
   */
  getRefObject: function ($ref, components, options) {
    options = _.merge({}, defaultOptions, options);
    var refObj,
      savedSchema;

    savedSchema = $ref.split('/').slice(1).map((elem) => {
      // https://swagger.io/docs/specification/using-ref#escape
      // since / is the default delimiter, slashes are escaped with ~1
      return decodeURIComponent(
        elem
          .replace(/~1/g, '/')
          .replace(/~0/g, '~')
      );
    });
    // at this stage, savedSchema is [components, part1, parts]
    // must have min. 2 segments after "#/components"
    if (savedSchema.length < 3) {
      console.warn(`ref ${$ref} not found.`);
      return { value: `reference ${$ref} not found in the given specification` };
    }

    if (savedSchema[0] !== 'components' && savedSchema[0] !== 'paths') {
      console.warn(`Error reading ${$ref}. Can only use references from components and paths`);
      return { value: `Error reading ${$ref}. Can only use references from components and paths` };
    }

    // at this point, savedSchema is similar to ['components', 'schemas','Address']
    // components is actually components and paths (an object with components + paths as 1st-level-props)
    refObj = _.get(components, savedSchema);

    if (!refObj) {
      console.warn(`ref ${$ref} not found.`);
      return { value: `reference ${$ref} not found in the given specification` };
    }

    if (refObj.$ref) {
      return this.getRefObject(refObj.$ref, components, options);
    }

    return refObj;
  },

  /**
   * A check if the OpenApi operation item matches a target definition .
   * @param {object} operationItem the OpenApi operation item to match
   * @param {object} target the entered path definition that is a combination of the method & path, like GET::/lists
   * @returns {boolean} matching information
   */
  isMatchOperationItem: function (operationItem, target) {
    if (target.openApiOperationId) {
      return (operationItem.properties && operationItem.properties.operationId &&
        operationItem.properties.operationId === target.openApiOperationId);
    }

    if (target.openApiOperation) {
      const targetSplit = target.openApiOperation.split('::/');
      if (targetSplit[0] && targetSplit[1]) {
        let targetMethod = [targetSplit[0].toLowerCase()];
        const targetPath = targetSplit[1].toLowerCase();
        // Wildcard support
        if (targetMethod.includes('*')) {
          targetMethod = METHODS;
        }
        return ((operationItem.method && targetMethod.includes(operationItem.method.toLowerCase())) &&
          (operationItem.path && this.matchPath(targetPath, operationItem.path.toLowerCase())));
      }
    }

    return false;
  },

  /**
   * Converts combination of the OpenApi method & path to a uniform OpenApiOperationRef.
   * @param {object} operationItem the OpenApi operation item to match
   * @param {string} format the format of OpenApi Operation reference (MATCH or PMVAR)
   * @returns {string} Return a OpenApiOperation reference
   * @no-unit-tests
   */
  getOpenApiOperationRef: function (operationItem, format) {
    const operationFormat = format || 'MATCH';
    if (operationItem.method && operationItem.path) {
      if (operationFormat === 'MATCH') {
        return operationItem.method.toUpperCase() + '::/' + operationItem.path;
      }
      if (operationFormat === 'PMVAR') {
        return operationItem.method.toLowerCase() + '-' + operationItem.path.replace('{', ':')
          .replace('}', '').replace(/#|\//g, '-');
      }
    }
    return '';
  },

  /**
   * Converts a string path to a Regular Expression.
   * Transforms path parameters into named RegExp groups.
   * @param {*} path the path pattern to match
   * @returns {RegExp} Return a regex
   * @no-unit-tests
   */
  pathToRegExp: function (path) {
    const pattern = path
      // Escape literal dots
      .replace(/\./g, '\\.')
      // Escape literal slashes
      .replace(/\//g, '/')
      // Escape literal question marks
      .replace(/\?/g, '\\?')
      // Ignore trailing slashes
      .replace(/\/+$/, '')
      // Replace wildcard with any zero-to-any character sequence
      .replace(/\*+/g, '.*')
      // Replace parameters with named capturing groups
      .replace(/:([^\d|^\/][a-zA-Z0-9_]*(?=(?:\/|\\.)|$))/g, (_, paramName) => {
        return `(?<${paramName}>[^\/]+?)`;
      })
      // Allow optional trailing slash
      .concat('(\\/|$)');
    return new RegExp(pattern, 'gi');
  },

  /**
   * Matches a given url against a path, with Wildcard support (based on the node-match-path package)
   * @param {*} path the path pattern to match
   * @param {*} url the entered URL is being evaluated for matching
   * @returns {Object} matching information
   */
  matchPath: function (path, url) {
    const expression = path instanceof RegExp ? path : this.pathToRegExp(path),
      match = expression.exec(url) || false;
    // Matches in strict mode: match string should equal to input (url)
    // Otherwise loose matches will be considered truthy:
    // match('/messages/:id', '/messages/123/users') // true
    // eslint-disable-next-line one-var,no-implicit-coercion
    const matches = path instanceof RegExp ? !!match : !!match && match[0] === match.input;
    return matches;
    // return {
    //   matches,
    //   params: match && matches ? match.groups || null : null
    // };
  }

};
