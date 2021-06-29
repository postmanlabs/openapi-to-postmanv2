'use strict';

// This is the default collection name if one can't be inferred from the OpenAPI spec
const COLLECTION_NAME = 'Imported from OpenAPI 3.0',
  BROWSER = 'browser',
  Ajv = require('ajv'),
  async = require('async'),
  sdk = require('postman-collection'),
  schemaUtils = require('./schemaUtils.js'),
  OasResolverOptions = {
    resolve: true, // Resolve external references
    jsonSchema: true // Treat $ref like JSON Schema and convert to OpenAPI Schema Objects
  },
  parse = require('./parse.js'),
  getOptions = require('./options').getOptions,
  transactionSchema = require('../assets/validationRequestListSchema.json'),
  utils = require('./utils.js'),
  _ = require('lodash'),
  fs = require('fs'),
  // use path based on platform it's running on (web or node)
  // options for oas-resolver

  // This provides the base class for
  // errors with the input OpenAPI spec
  OpenApiErr = require('./error.js');

let path = require('path'),
  pathBrowserify = require('path-browserify');

class SchemaPack {
  constructor (input, options = {}) {
    this.input = input;
    this.validated = false;
    this.openapi = null;
    this.validationResult = null;
    this.definedOptions = getOptions();
    this.computedOptions = null;
    this.schemaFakerCache = {};
    this.schemaResolutionCache = {};

    this.computedOptions = utils.mergeOptions(
      // predefined options
      _.keyBy(this.definedOptions, 'id'),
      // options provided by the user
      options
    );
    // hardcoding this option - not exposed to users yet
    this.computedOptions.schemaFaker = true;
    let indentCharacter = this.computedOptions.indentCharacter;
    this.computedOptions.indentCharacter = indentCharacter === 'tab' ? '\t' : ' ';

    // hardcoding the test suite options CLI mapping - not exposed to postman users yet
    this.computedOptions.testSuite = options.testSuite;
    this.computedOptions.testSuiteSettings = options.testSuiteSettings;

    this.validate();
  }

  // need to store the schema here
  validate() {
    let input = this.input,
      json,
      specParseResult;
    if (!input) {
      return {
        result: false,
        reason: 'Input not provided'
      };
    }
    if (input.type === 'string' || input.type === 'json') {
      // no need for extra processing before calling the converter
      // string can be JSON or YAML
      json = input.data;
    }
    else if (input.type === 'file') {
      try {
        json = fs.readFileSync(input.data, 'utf8');
      }
      catch (e) {
        this.validationResult = {
          result: false,
          reason: e.message
        };
        return this.validationResult;
      }
    }
    else if (input.type === 'folder') {
      this.validationResult = {
        result: false,
        reason: 'Input data not validated, please call mergeAndValidate() for input.type \'folder\''
      };

      return this.validationResult;
    }
    else {
      // invalid input type
      this.validationResult = {
        result: false,
        reason: `Invalid input type (${input.type}). type must be one of file/json/string.`
      };
      return this.validationResult;
    }
    if (_.isEmpty(json)) {
      this.validationResult = {
        result: false,
        reason: 'Empty input schema provided.'
      };
      return this.validationResult;
    }

    specParseResult = schemaUtils.parseSpec(json);

    if (!specParseResult.result) {
      // validation failed
      // calling this.convert() will be blocked
      this.validationResult = {
        result: false,
        reason: specParseResult.reason
      };
      return this.validationResult;
    }

    this.openapi = specParseResult.openapi;
    this.validated = true;
    this.validationResult = {
      result: true
    };
    return this.validationResult;
  }

  getMetaData (cb) {
    let input = this.input;

    // Return validation result if the schema is not validated.
    if (input.type !== 'folder' && !this.validated) {
      return cb(null, this.validationResult);
    }
    // if the schema is validated, return the meta data as required.
    else if (this.validated) {
      return cb(null, {
        result: true,
        name: _.get(this.openapi, 'info.title', COLLECTION_NAME),
        output: [{
          type: 'collection',
          name: _.get(this.openapi, 'info.title', COLLECTION_NAME)
        }]
      });
    }
    else if (input.type === 'folder') {
      this.mergeAndValidate((err, validationResult) => {
        if (err) {
          return cb(err);
        }

        if (!validationResult.result) {
          return cb(null, validationResult);
        }

        return cb(null, {
          result: true,
          name: _.get(this.openapi, 'info.title', COLLECTION_NAME),
          output: [{
            type: 'collection',
            name: _.get(this.openapi, 'info.title', COLLECTION_NAME)
          }]
        });
      });
    }
  }

  mergeAndValidate (cb) {
    let input = this.input,
      validationResult,
      files = {},
      rootFiles;

    // Special handling depending on origin of the request.
    // if it is coming from browser use pathBrowserify.
    if (input.origin === BROWSER) {
      path = pathBrowserify;
      OasResolverOptions.browser = true;
    }

    // if content of files is available in the input.data
    // Create a file content <> path map to be used to read files from paths.
    if ('content' in input.data[0]) {
      input.data.forEach((file) => {
        files[path.resolve(file.fileName)] = file.content ? file.content : '';
      });
    }

    try {
      rootFiles = parse.getRootFiles(input, files);
    }
    catch (e) {
      return cb(null, {
        result: false,
        reason: e
      });
    }
    if (rootFiles.length > 1) {
      this.validationResult = {
        result: false,
        reason: 'More than one root file not supported.'
      };
      return cb(null, this.validationResult);
    }
    if (rootFiles.length) {
      parse.mergeFiles(rootFiles[0], OasResolverOptions, files)
        .then((spec) => {
          this.input = {
            type: 'json',
            data: spec
          };
          validationResult = this.validate();

          return cb(null, validationResult);
        })
        .catch((err) => {
          this.validationResult = {
            result: false,
            reason: 'Error while merging files.',
            error: err
          };
          return cb(null, this.validationResult);
        });
    }
    else {
      return cb(null, {
        result: false,
        reason: 'No root files present / input is not an OpenAPI spec.'
      });
    }
  }

  // convert method, this is called when you want to convert a schema that you've already loaded
  // in the constructor
  convert (callback) {
    let openapi,
      options = this.computedOptions,
      analysis,
      generatedStore = {},
      collectionJSON,
      componentsAndPaths,
      authHelper,
      schemaCache = {
        schemaResolutionCache: this.schemaResolutionCache,
        schemaFakerCache: this.schemaFakerCache
      };

    if (!this.validated) {
      return callback(new OpenApiErr('The schema must be validated before attempting conversion'));
    }

    // this cannot be attempted before validation
    componentsAndPaths = {
      components: this.openapi.components,
      paths: this.openapi.paths
    };

    // create and sanitize basic spec
    openapi = this.openapi;
    openapi.servers = _.isEmpty(openapi.servers) ? [{ url: '/' }] : openapi.servers;
    openapi.securityDefs = _.get(openapi, 'components.securitySchemes', {});
    openapi.baseUrl = _.get(openapi, 'servers.0.url', '{{baseURL}}');

    // TODO: Multiple server variables need to be saved as environments
    openapi.baseUrlVariables = _.get(openapi, 'servers.0.variables');

    // Fix {scheme} and {path} vars in the URL to :scheme and :path
    openapi.baseUrl = schemaUtils.fixPathVariablesInUrl(openapi.baseUrl);

    // Creating a new instance of a Postman collection
    // All generated folders and requests will go inside this
    generatedStore.collection = new sdk.Collection({
      info: {
        name: _.isEmpty(_.get(openapi, 'info.title')) ? COLLECTION_NAME : _.get(openapi, 'info.title')
      }
    });

    if (openapi.security) {
      authHelper = schemaUtils.getAuthHelper(openapi, openapi.security);
      if (authHelper) {
        generatedStore.collection.auth = authHelper;
      }
    }
    // ---- Collection Variables ----
    // adding the collection variables for all the necessary root level variables
    // and adding them to the collection variables
    schemaUtils.convertToPmCollectionVariables(
      openapi.baseUrlVariables,
      'baseUrl',
      openapi.baseUrl
    ).forEach((element) => {
      generatedStore.collection.variables.add(element);
    });

    generatedStore.collection.describe(schemaUtils.getCollectionDescription(openapi));

    // Only change the stack limit if the optimizeConversion option is true
    if (options.optimizeConversion) {
      // Deciding stack limit based on size of the schema, number of refs and number of paths.
      analysis = schemaUtils.analyzeSpec(openapi);

      // Update options on the basis of analysis.
      options = schemaUtils.determineOptions(analysis, options);
    }


    // ---- Collection Items ----
    // Adding the collection items from openapi spec based on folderStrategy option
    // For tags, All operations are grouped based on respective tags object
    // For paths, All operations are grouped based on corresponding paths
    try {
      if (options.folderStrategy === 'tags') {
        schemaUtils.addCollectionItemsUsingTags(openapi, generatedStore, componentsAndPaths, options, schemaCache);
      }
      else {
        schemaUtils.addCollectionItemsUsingPaths(openapi, generatedStore, componentsAndPaths, options, schemaCache);
      }
    }
    catch (e) {
      return callback(e);
    }

    collectionJSON = generatedStore.collection.toJSON();

    // this needs to be deleted as even if version is not specified to sdk,
    // it returns a version property with value set as undefined
    // this fails validation against v2.1 collection schema definition.
    delete collectionJSON.info.version;

    return callback(null, {
      result: true,
      output: [{
        type: 'collection',
        data: collectionJSON
      }]
    });
  }

  /**
   *
   * @description Takes in a transaction object (meant to represent a Postman history object)
   *
   * @param {*} transactions RequestList
   * @param {*} callback return
   * @returns {boolean} validation
   */
  validateTransaction(transactions, callback) {
    let schema = this.openapi,
      componentsAndPaths,
      analysis,
      options = this.computedOptions,
      schemaCache = {
        schemaResolutionCache: this.schemaResolutionCache,
        schemaFakerCache: this.schemaFakerCache
      },
      matchedEndpoints = [];

    // Only change the stack limit if the optimizeConversion option is true
    if (options.optimizeConversion) {
      // Deciding stack limit based on size of the schema, number of refs and number of paths.
      analysis = schemaUtils.analyzeSpec(schema);

      // Update options on the basis of analysis.
      options = schemaUtils.determineOptions(analysis, options);
    }

    if (!this.validated) {
      return callback(new OpenApiErr('The schema must be validated before attempting conversion'));
    }

    // this cannot be attempted before validation
    componentsAndPaths = {
      components: this.openapi.components,
      paths: this.openapi.paths
    };

    // create and sanitize basic spec
    schema.servers = _.isEmpty(schema.servers) ? [{ url: '/' }] : schema.servers;
    schema.securityDefs = _.get(schema, 'components.securitySchemes', {});
    schema.baseUrl = _.get(schema, 'servers.0.url', '{{baseURL}}');
    schema.baseUrlVariables = _.get(schema, 'servers.0.variables');

    // Fix {scheme} and {path} vars in the URL to :scheme and :path
    schema.baseUrl = schemaUtils.fixPathVariablesInUrl(schema.baseUrl);

    // check validity of transactions
    try {
      // add Ajv options to support validation of OpenAPI schema.
      // For more details see https://ajv.js.org/#options
      let ajv = new Ajv({ unknownFormats: ['int32', 'int64'], allErrors: true, nullable: true }),
        validate = ajv.compile(transactionSchema),
        res = validate(transactions);

      if (!res) {
        return callback(new OpenApiErr('Invalid syntax provided for requestList', validate.errors));
      }
    }
    catch (e) {
      return callback(new OpenApiErr('Invalid syntax provided for requestList', e));
    }

    return setTimeout(() => {
      async.map(transactions, (transaction, requestCallback) => {
        if (!transaction.id || !transaction.request) {
          return requestCallback(new Error('All transactions must have `id` and `request` properties.'));
        }

        let requestUrl = transaction.request.url,
          matchedPaths;
        if (typeof requestUrl === 'object') {

          // SDK.Url.toString() resolves pathvar to empty string if value is empty
          // so update path variable value to same as key in such cases
          _.forEach(requestUrl.variable, (pathVar) => {
            if (_.isNil(pathVar.value) || (typeof pathVar.value === 'string' && _.trim(pathVar.value).length === 0)) {
              pathVar.value = ':' + pathVar.key;
            }
          });

          // SDK URL object. Get raw string representation.
          requestUrl = (new sdk.Url(requestUrl)).toString();
        }

        // 1. Look at transaction.request.URL + method, and find matching request from schema
        matchedPaths = schemaUtils.findMatchingRequestFromSchema(
          transaction.request.method,
          requestUrl,
          schema,
          options
        );

        if (!matchedPaths.length) {
          // No matching paths found
          return requestCallback(null, {
            requestId: transaction.id,
            endpoints: []
          });
        }

        return setTimeout(() => {
          // 2. perform validation for each identified matchedPath (schema endpoint)
          return async.map(matchedPaths, (matchedPath, pathsCallback) => {

            // override path variable value with actual value present in transaction
            // as matched pathvariable contains key as value, as it is generated from url only
            _.forEach(matchedPath.pathVariables, (pathVar) => {
              let mappedPathVar = _.find(_.get(transaction, 'request.url.variable', []), (transactionPathVar) => {
                return transactionPathVar.key === pathVar.key;
              });
              pathVar.value = _.get(mappedPathVar, 'value', pathVar.value);
            });

            // resolve $ref in all parameter objects if present
            _.forEach(_.get(matchedPath, 'path.parameters'), (param) => {
              if (param.hasOwnProperty('$ref')) {
                _.assign(param, schemaUtils.getRefObject(param.$ref, componentsAndPaths, options));
                _.unset(param, '$ref');
              }
            });

            matchedEndpoints.push(matchedPath.jsonPath);
            // 3. validation involves checking these individual properties
            async.parallel({
              metadata: function(cb) {
                schemaUtils.checkMetadata(transaction, '$', matchedPath.path, matchedPath.name, options, cb);
              },
              path: function(cb) {
                schemaUtils.checkPathVariables(matchedPath.pathVariables, '$.request.url.variable', matchedPath.path,
                  componentsAndPaths, options, schemaCache, cb);
              },
              queryparams: function(cb) {
                schemaUtils.checkQueryParams(requestUrl, '$.request.url.query', matchedPath.path,
                  componentsAndPaths, options, schemaCache, cb);
              },
              headers: function(cb) {
                schemaUtils.checkRequestHeaders(transaction.request.header, '$.request.header', matchedPath.jsonPath,
                  matchedPath.path, componentsAndPaths, options, schemaCache, cb);
              },
              requestBody: function(cb) {
                schemaUtils.checkRequestBody(transaction.request.body, '$.request.body', matchedPath.jsonPath,
                  matchedPath.path, componentsAndPaths, options, schemaCache, cb);
              },
              responses: function (cb) {
                schemaUtils.checkResponses(transaction.response, '$.responses', matchedPath.jsonPath,
                  matchedPath.path, componentsAndPaths, options, schemaCache, cb);
              }
            }, (err, result) => {
              let allMismatches = _.concat(result.metadata, result.queryparams, result.headers, result.path,
                  result.requestBody),
                responseMismatchesPresent = false,
                retVal;

              // adding mistmatches from responses
              _.each(result.responses, (response) => {
                if (_.get(response, 'mismatches', []).length > 0) {
                  responseMismatchesPresent = true;
                  return false;
                }
              });

              retVal = {
                matched: (allMismatches.length === 0 && !responseMismatchesPresent),
                endpointMatchScore: matchedPath.score,
                endpoint: matchedPath.name,
                mismatches: allMismatches,
                responses: result.responses
              };

              pathsCallback(null, retVal);
            });
          }, (err, result) => {
            // only need to return endpoints that have the joint-highest score
            let highestScore = -Infinity,
              bestResults;
            result.forEach((endpoint) => {
              if (endpoint.endpointMatchScore > highestScore) {
                highestScore = endpoint.endpointMatchScore;
              }
            });
            bestResults = _.filter(result, (ep) => {
              return ep.endpointMatchScore === highestScore;
            });

            requestCallback(err, {
              requestId: transaction.id,
              endpoints: bestResults
            });
          });
        }, 0);
      }, (err, result) => {
        var retVal;

        if (err) {
          return callback(err);
        }

        // determine if any endpoint for any request misatched
        _.each(result, (reqRes) => {
          let thisMismatch = false;
          _.each(reqRes.endpoints, (ep) => {
            if (!ep.matched) {
              return false;
            }
          });
          if (thisMismatch) {
            return false;
          }
        });

        retVal = {
          requests: _.keyBy(result, 'requestId'),
          missingEndpoints: schemaUtils.getMissingSchemaEndpoints(schema, matchedEndpoints,
            componentsAndPaths, options, schemaCache)
        };

        callback(null, retVal);
      });
    }, 0);
  }

  static getOptions(mode, criteria) {
    return getOptions(mode, criteria);
  }
}

module.exports = {
  SchemaPack
};
