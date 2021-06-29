const _ = require('lodash'),
  mergeAllOf = require('json-schema-merge-allof'),
  type = {
    integer: {
      int32: '<integer>',
      int64: '<long>'
    },
    number: {
      float: '<float>',
      double: '<double>'
    },
    string: {
      byte: '<byte>',
      binary: '<binary>',
      date: '<date>',
      'date-time': '<dateTime>',
      password: '<password>'
    },
    boolean: '<boolean>'
  },
  PARAMETER_SOURCE = {
    REQUEST: 'REQUEST',
    RESPONSE: 'RESPONSE'
  },
  // All formats supported by both ajv and json-schema-faker
  SUPPORTED_FORMATS = [
    'date', 'time', 'date-time',
    'uri', 'uri-reference', 'uri-template',
    'email',
    'hostname',
    'ipv4', 'ipv6',
    'regex',
    'uuid',
    'json-pointer'
  ];

module.exports = {
  /**
   * @param {*} rootObject - the object from which you're trying to read a property
   * @param {*} pathArray - each element in this array a property of the previous object
   * @param {*} defValue - what to return if the required path is not found
   * @returns {*} - required property value
   * @description - this is similar to _.get(rootObject, pathArray.join('.')), but also works for cases where
   * there's a . in the property name
   */
  _getEscaped: function (rootObject, pathArray, defValue) {
    if (!(pathArray instanceof Array)) {
      return null;
    }

    if (!rootObject) {
      return defValue;
    }

    if (_.isEmpty(pathArray)) {
      return rootObject;
    }

    return this._getEscaped(rootObject[pathArray.shift()], pathArray, defValue);
  },

  /**
   * Creates a schema that's a union of all input schemas (only type: object is supported)
   *
   * @param {array} schemaArr - array of schemas, all of which must be valid in the returned object
   * @param {string} parameterSourceOption tells that the schema object is of request or response
   * @param {*} components components in openapi spec.
   * @param {object} schemaResolutionCache stores already resolved references
   * @param {*} resolveFor - resolve refs for validation/conversion (value to be one of VALIDATION/CONVERSION)
   * @param {string} resolveTo The desired JSON-generation mechanism (schema: prefer using the JSONschema to
     generate a fake object, example: use specified examples as-is). Default: schema
   * @param {*} stack counter which keeps a tab on nested schemas
   * @param {*} seenRef References that are repeated. Used to identify circular references.
   * @param {*} stackLimit Depth to which the schema should be resolved.
   * @returns {*} schema - schema that adheres to all individual schemas in schemaArr
   */
  resolveAllOf: function (schemaArr, parameterSourceOption, components, schemaResolutionCache,
    resolveFor = 'CONVERSION', resolveTo = 'schema', stack = 0, seenRef, stackLimit) {

    if (!(schemaArr instanceof Array)) {
      return null;
    }

    if (schemaArr.length === 1) {
      // for just one entry in allOf, don't need to enforce type: object restriction
      return this.resolveRefs(schemaArr[0], parameterSourceOption, components, schemaResolutionCache, resolveFor,
        resolveTo, stack, seenRef, stackLimit);
    }

    try {
      return mergeAllOf({
        allOf: schemaArr.map((schema) => {
          return this.resolveRefs(schema, parameterSourceOption, components, schemaResolutionCache, resolveFor,
            resolveTo, stack, seenRef, stackLimit);
        })
      }, {
        resolvers: {
          // for keywords in OpenAPI schema that are not standard defined JSON schema keywords, use default resolver
          defaultResolver: (compacted) => { return compacted[0]; }
        }
      });
    }
    catch (e) {
      console.warn('Error while resolving allOf schema: ', e);
      return { value: '<Error: Could not resolve allOf schema' };
    }
  },

  /**
   * Resolves references to components for a given schema.
   * @param {*} schema (openapi) to resolve references.
   * @param {string} parameterSourceOption tells that the schema object is of request or response
   * @param {*} components components in openapi spec.
   * @param {object} schemaResolutionCache stores already resolved references
   * @param {*} resolveFor - resolve refs for validation/conversion (value to be one of VALIDATION/CONVERSION)
   * @param {string} resolveTo The desired JSON-generation mechanism (schema: prefer using the JSONschema to
    generate a fake object, example: use specified examples as-is). Default: schema
   * @param {*} stack counter which keeps a tab on nested schemas
   * @param {*} seenRef - References that are repeated. Used to identify circular references.
   * @param {*} stackLimit Depth to which the schema should be resolved.
   * @returns {*} schema satisfying JSON-schema-faker.
   */

  resolveRefs: function (schema, parameterSourceOption, components, schemaResolutionCache,
    resolveFor = 'CONVERSION', resolveTo = 'schema', stack = 0, seenRef = {}, stackLimit = 10) {
    var resolvedSchema, prop, splitRef,
      ERR_TOO_MANY_LEVELS = '<Error: Too many levels of nesting to fake this schema>';

    stack++;
    schemaResolutionCache = schemaResolutionCache || {};

    if (stack > stackLimit) {
      return { value: ERR_TOO_MANY_LEVELS };
    }

    if (!schema) {
      return { value: '<Error: Schema not found>' };
    }

    if (schema.anyOf) {
      let anyOfSchemas = [];
      _.forOwn(schema.anyOf, (item) => {
        let itemSchema = this.resolveRefs(item, parameterSourceOption, components, schemaResolutionCache, resolveFor,
          resolveTo, stack, _.cloneDeep(seenRef), stackLimit);
        anyOfSchemas.push(itemSchema);
      });
      return { 'anyOf': anyOfSchemas };
    }
    if (schema.oneOf) {
      let oneOfSchemas = [];
      _.forOwn(schema.oneOf, (item) => {
        let itemSchema = this.resolveRefs(item, parameterSourceOption, components, schemaResolutionCache, resolveFor,
          resolveTo, stack, _.cloneDeep(seenRef), stackLimit);
        oneOfSchemas.push(itemSchema);
      });
      return { 'oneOf': oneOfSchemas };
    }
    if (schema.allOf) {
      return this.resolveAllOf(schema.allOf, parameterSourceOption, components, schemaResolutionCache, resolveFor,
        resolveTo, stack, _.cloneDeep(seenRef), stackLimit);
    }
    if (schema.$ref && _.isFunction(schema.$ref.split)) {
      let refKey = schema.$ref;

      // if this reference is seen before, ignore and move on.
      if (seenRef[refKey]) {
        return { value: '<Circular reference to ' + refKey + ' detected>' };
      }
      // add to seen array if not encountered before.
      seenRef[refKey] = stack;

      // points to an existing location
      // .split will return [#, components, schemas, schemaName]
      splitRef = refKey.split('/');

      if (splitRef.length < 4) {
        // not throwing an error. We didn't find the reference - generate a dummy value
        return { value: 'reference ' + schema.$ref + ' not found in the OpenAPI spec' };
      }
      if (schemaResolutionCache[refKey]) {
        return schemaResolutionCache[refKey];
      }
      // something like #/components/schemas/PaginationEnvelope/properties/page
      // will be resolved - we don't care about anything after the components part
      // splitRef.slice(1) will return ['components', 'schemas', 'PaginationEnvelope', 'properties', 'page']
      // not using _.get here because that fails if there's a . in the property name (Pagination.Envelope, for example)

      splitRef = splitRef.slice(1).map((elem) => {
        // https://swagger.io/docs/specification/using-ref#escape
        // since / is the default delimiter, slashes are escaped with ~1
        return decodeURIComponent(
          elem
            .replace(/~1/g, '/')
            .replace(/~0/g, '~')
        );
      });

      resolvedSchema = this._getEscaped(components, splitRef);

      if (resolvedSchema) {
        let refResolvedSchema = this.resolveRefs(resolvedSchema, parameterSourceOption,
          components, schemaResolutionCache, resolveFor, resolveTo, stack, _.cloneDeep(seenRef));

        if (refResolvedSchema && refResolvedSchema.value !== ERR_TOO_MANY_LEVELS) {
          schemaResolutionCache[refKey] = refResolvedSchema;
        }

        return refResolvedSchema;
      }
      return { value: 'reference ' + schema.$ref + ' not found in the OpenAPI spec' };
    }
    if (schema.type === 'object' || schema.hasOwnProperty('properties')) {
      // go through all props
      schema.type = 'object';
      if (schema.hasOwnProperty('properties')) {
        // shallow cloning schema object except properties object
        let tempSchema = _.omit(schema, 'properties');
        tempSchema.properties = {};
        for (prop in schema.properties) {
          if (schema.properties.hasOwnProperty(prop)) {
            /* eslint-disable max-depth */
            // handling OAS readOnly and writeOnly properties in schema
            // Related Doc - https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#schemaObject
            let property = schema.properties[prop];

            if (!property) {
              continue;
            }

            if (property.readOnly && parameterSourceOption === PARAMETER_SOURCE.REQUEST) {
              continue;
            }
            else if (property.writeOnly && parameterSourceOption === PARAMETER_SOURCE.RESPONSE) {
              continue;
            }
            /* eslint-enable */
            tempSchema.properties[prop] = this.resolveRefs(property, parameterSourceOption, components,
              schemaResolutionCache, resolveFor, resolveTo, stack, _.cloneDeep(seenRef));
          }
        }
        return tempSchema;
      }

      // Override deefault value to appropriate type representation for parameter resolution to schema
      if (resolveFor === 'CONVERSION' && resolveTo === 'schema') {
        schema.default = '<object>';
      }
    }
    else if (schema.type === 'array' && schema.items) {
      /*
        For VALIDATION - keep minItems and maxItems properties defined by user in schema as is
        FOR CONVERSION -
          Json schema faker fakes exactly maxItems # of elements in array
          Hence keeping maxItems as minimum and valid as possible for schema faking (to lessen faked items)
          We have enforced limit to maxItems as 100, set by Json schema faker option
      */
      if (resolveFor === 'CONVERSION') {
        // Override minItems to default (2) if no minItems present
        if (!_.has(schema, 'minItems') && _.has(schema, 'maxItems') && schema.maxItems >= 2) {
          schema.minItems = 2;
        }

        // Override maxItems to minItems if minItems is available
        if (_.has(schema, 'minItems') && schema.minItems > 0) {
          schema.maxItems = schema.minItems;
        }

        // If no maxItems is defined than override with default (2)
        !_.has(schema, 'maxItems') && (schema.maxItems = 2);
      }
      // have to create a shallow clone of schema object,
      // so that the original schema.items object will not change
      // without this, schemas with circular references aren't faked correctly
      let tempSchema = _.omit(schema, 'items');
      tempSchema.items = this.resolveRefs(schema.items, parameterSourceOption,
        components, schemaResolutionCache, resolveFor, resolveTo, stack, _.cloneDeep(seenRef));
      return tempSchema;
    }
    else if (!schema.hasOwnProperty('default')) {
      if (schema.hasOwnProperty('type')) {
        // Override default value to schema for CONVERSION only for parmeter resolution set to schema
        if (resolveFor === 'CONVERSION' && resolveTo === 'schema') {
          if (!schema.hasOwnProperty('format')) {
            schema.default = '<' + schema.type + '>';
          }
          else if (type.hasOwnProperty(schema.type)) {
            schema.default = type[schema.type][schema.format];

            // in case the format is a custom format (email, hostname etc.)
            // https://swagger.io/docs/specification/data-models/data-types/#string
            if (!schema.default && schema.format) {
              schema.default = '<' + schema.format + '>';
            }
          }
          else {
            schema.default = '<' + schema.type + (schema.format ? ('-' + schema.format) : '') + '>';
          }
        }
      }
      else if (schema.enum && schema.enum.length > 0) {
        return {
          type: (typeof (schema.enum[0])),
          value: schema.enum[0]
        };
      }
      else {
        return {
          type: 'object'
        };
      }
      if (!schema.type) {
        schema.type = 'string';
      }

      // Discard format if not supported by both json-schema-faker and ajv or pattern is also defined
      if (!_.includes(SUPPORTED_FORMATS, schema.format) || (schema.pattern && schema.format)) {
        delete schema.format;
      }
    }

    return schema;
  }
};
