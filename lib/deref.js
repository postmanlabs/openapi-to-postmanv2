const openApiErr = require('./error.js'),
  _ = require('lodash'),
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
  BODY_TYPE = {
    REQUEST: 'REQUEST',
    RESPONSE: 'RESPONSE'
  };

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
   * @param {string} bodyTypeOption tells that the schema object is of request or response
   * @param {*} components components in openapi spec.
   * @param {*} stack counter which keeps a tab on nested schemas
   * @returns {*} schema - schema that adheres to all individual schemas in schemaArr
   */
  resolveAllOf: function (schemaArr, bodyTypeOption, components, stack = 0) {
    if (!(schemaArr instanceof Array)) {
      return null;
    }

    if (schemaArr.length === 1) {
      // for just one entry in allOf, don't need to enforce type: object restriction
      return this.resolveRefs(schemaArr[0], bodyTypeOption, components, stack);
    }

    // generate one object for each schema
    let indivObjects = schemaArr.map((schema) => {
        return this.resolveRefs(schema, bodyTypeOption, components, stack);
      }).filter((schema) => {
        return schema.type === 'object';
      }),

      // generated object with properties from all allOf entries which we return
      finalObject = {
        type: 'object',
        properties: {}
      },

      // set of properties which we've already handled, to avoid repitition
      handledProps = {},
      i,
      j;

    for (i = 0; i < indivObjects.length; i++) {
      // go through the indiv props, and add to finalObject if not in handledProps
      for (j in indivObjects[i].properties) {
        if (indivObjects[i].properties.hasOwnProperty(j) && !handledProps[j]) {
          handledProps[j] = true;
          finalObject.properties[j] = indivObjects[i].properties[j];
        }
      }

      finalObject.description = finalObject.description || indivObjects[i].description;
    }

    return finalObject;
  },

  /**
   * Resolves references to components for a given schema.
   * @param {*} schema (openapi) to resolve references.
   * @param {string} bodyTypeOption tells that the schema object is of request or response
   * @param {*} components components in openapi spec.
   * @param {*} stack counter which keeps a tab on nested schemas
   * @returns {*} schema satisfying JSON-schema-faker.
   */
  resolveRefs: function (schema, bodyTypeOption, components, stack = 0) {
    var resolvedSchema, prop, splitRef;
    stack++;

    if (stack > 20) {
      return { value: '<Error: Too many levels of nesting to fake this schema>' };
    }

    if (schema.anyOf) {
      return this.resolveRefs(schema.anyOf[0], bodyTypeOption, components, stack);
    }
    if (schema.oneOf) {
      return this.resolveRefs(schema.oneOf[0], bodyTypeOption, components, stack);
    }
    if (schema.allOf) {
      return this.resolveAllOf(schema.allOf, bodyTypeOption, components, stack);
    }
    if (schema.$ref) {
      // points to an existing location
      // .split will return [#, components, schemas, schemaName]
      splitRef = schema.$ref.split('/');

      if (splitRef.length < 4) {
        throw new openApiErr(`Invalid schema reference: ${schema.$ref}`);
      }

      // something like #/components/schemas/PaginationEnvelope/properties/page
      // will be resolved - we don't care about anything after the components part
      // splitRef.slice(2) will return ['schemas', 'PaginationEnvelope', 'properties', 'page']
      // not using _.get here because that fails if there's a . in the property name (Pagination.Envelope, for example)
      resolvedSchema = this._getEscaped(components, splitRef.slice(2));
      if (resolvedSchema) {
        return this.resolveRefs(resolvedSchema, bodyTypeOption, components, stack);
      }
      return { value: 'reference ' + schema.$ref + ' not found in the api spec' };
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
            if (property.readOnly && bodyTypeOption === BODY_TYPE.REQUEST) {
              continue;
            }
            else if (property.writeOnly && bodyTypeOption === BODY_TYPE.RESPONSE) {
              continue;
            }
            /* eslint-enable */
            tempSchema.properties[prop] = this.resolveRefs(property,
              bodyTypeOption, components, stack);
          }
        }
        return tempSchema;
      }

      schema.type = 'string';
      schema.default = '<object>';
    }
    else if (schema.type === 'array' && schema.items) {

      // This nonsense is needed because the schemaFaker doesn't respect options.maxItems/minItems
      schema.maxItems = 2;
      schema.minItems = 2;
      // have to create a shallow clone of schema object,
      // so that the original schema.items object will not change
      // without this, schemas with circular references aren't faked correctly
      let tempSchema = _.omit(schema, 'items');
      tempSchema.items = this.resolveRefs(schema.items, bodyTypeOption, components, stack);
      return tempSchema;
    }
    else if (schema.default === undefined) {
      if (schema.hasOwnProperty('type')) {
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
      else if (schema.enum && schema.enum.length > 0) {
        return {
          type: (typeof (schema.enum[0])),
          value: schema.enum[0]
        };
      }
      else {
        return {
          type: 'string',
          default: 'schema type not provided'
        };
      }
      if (!schema.type) {
        schema.type = 'string';
      }
      delete schema.format;
    }

    return schema;
  }
};
