const _ = require('lodash');

module.exports = {
  // default options
  // if mode=document, returns an array of name/id/default etc.

  /**
   * name - human-readable name for the option
   * id - key to pass the option with
   * type - boolean or enum for now
   * default - the value that's assumed if not specified
   * availableOptions - allowed values (only for type=enum)
   * description - human-readable description of the item
   * external - whether the option is settable via the API
   * usage - array of supported types of usage (i.e. CONVERSION, VALIDATION)
   *
   * @param {string} [mode='document'] Describes use-case. 'document' will return an array
   * with all options being described. 'use' will return the default values of all options
   * @param {Object} criteria Decribes required criteria for options to be returned. can have properties
   *   external: <boolean>
   *   usage: <array> (Array of supported usage type - CONVERSION, VALIDATION)
   * @returns {mixed} An array or object (depending on mode) that describes available options
   */
  getOptions: function(mode = 'document', criteria = {}) {
    // Override mode & criteria if first arg is criteria (objects)
    if (typeof mode === 'object') {
      criteria = mode;
      mode = 'document';
    }

    let optsArray = [
      {
        name: 'Naming requests',
        id: 'requestNameSource',
        type: 'enum',
        default: 'Fallback',
        availableOptions: ['URL', 'Fallback'],
        description: 'Determines how the requests inside the generated collection will be named.' +
        ' If “Fallback” is selected, the request will be named after one of the following schema' +
        ' values: `description`, `operationid`, `url`.',
        external: true,
        usage: ['CONVERSION', 'VALIDATION']
      },
      {
        name: 'Set indent character',
        id: 'indentCharacter',
        type: 'enum',
        default: 'Space',
        availableOptions: ['Space', 'Tab'],
        description: 'Option for setting indentation character',
        external: true,
        usage: ['CONVERSION']
      },
      {
        name: 'Collapse redundant folders',
        id: 'collapseFolders',
        type: 'boolean',
        default: true,
        description: 'Importing will collapse all folders that have only one child element and lack ' +
        'persistent folder-level data.',
        external: true,
        usage: ['CONVERSION']
      },
      {
        name: 'Optimize conversion',
        id: 'optimizeConversion',
        type: 'boolean',
        default: true,
        description: 'Optimizes conversion for large specification, disabling this option might affect' +
          ' the performance of conversion.',
        external: true,
        usage: ['CONVERSION']
      },
      {
        name: 'Request parameter generation',
        id: 'requestParametersResolution',
        type: 'enum',
        default: 'Schema',
        availableOptions: ['Example', 'Schema'],
        description: 'Select whether to generate the request parameters based on the' +
        ' [schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#schemaObject) or the' +
        ' [example](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#exampleObject)' +
        ' in the schema.',
        external: true,
        usage: ['CONVERSION']
      },
      {
        name: 'Response parameter generation',
        id: 'exampleParametersResolution',
        type: 'enum',
        default: 'Example',
        availableOptions: ['Example', 'Schema'],
        description: 'Select whether to generate the response parameters based on the' +
        ' [schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#schemaObject) or the' +
        ' [example](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#exampleObject)' +
        ' in the schema.',
        external: true,
        usage: ['CONVERSION']
      },
      {
        name: 'Folder organization',
        id: 'folderStrategy',
        type: 'enum',
        default: 'Paths',
        availableOptions: ['Paths', 'Tags'],
        description: 'Select whether to create folders according to the spec’s paths or tags.',
        external: true,
        usage: ['CONVERSION']
      },
      {
        name: 'Enable Schema Faking',
        id: 'schemaFaker',
        type: 'boolean',
        default: true,
        description: 'Whether or not schemas should be faked.',
        external: false,
        usage: ['CONVERSION']
      },
      {
        name: 'Include auth info in example requests',
        id: 'includeAuthInfoInExample',
        type: 'boolean',
        default: true,
        description: 'Select whether to include authentication parameters in the example request',
        external: true,
        usage: ['CONVERSION']
      },
      {
        name: 'Short error messages during request <> schema validation',
        id: 'shortValidationErrors',
        type: 'boolean',
        default: false,
        description: 'Whether detailed error messages are required for request <> schema validation operations.',
        external: true,
        usage: ['VALIDATION']
      },
      {
        name: 'Properties to ignore during validation',
        id: 'validationPropertiesToIgnore',
        type: 'array',
        default: [],
        description: 'Specific properties (parts of a request/response pair) to ignore during validation.' +
          ' Must be sent as an array of strings. Valid inputs in the array: PATHVARIABLE, QUERYPARAM,' +
          ' HEADER, BODY, RESPONSE_HEADER, RESPONSE_BODY',
        external: true,
        usage: ['VALIDATION']
      },
      {
        name: 'Whether MISSING_IN_SCHEMA mismatches should be returned',
        id: 'showMissingInSchemaErrors',
        type: 'boolean',
        default: false,
        description: 'MISSING_IN_SCHEMA indicates that an extra parameter was included in the request. For most ' +
          'use cases, this need not be considered an error.',
        external: true,
        usage: ['VALIDATION']
      },
      {
        name: 'Show detailed body validation messages',
        id: 'detailedBlobValidation',
        type: 'boolean',
        default: false,
        description: 'Determines whether to show detailed mismatch information for application/json content ' +
          'in the request/response body.',
        external: true,
        usage: ['VALIDATION']
      },
      {
        name: 'Suggest fixes if available',
        id: 'suggestAvailableFixes',
        type: 'boolean',
        default: false,
        description: 'Whether to provide fixes for patching corresponding mismatches.',
        external: true,
        usage: ['VALIDATION']
      },
      {
        name: 'Show Metadata validation messages',
        id: 'validateMetadata',
        type: 'boolean',
        default: false,
        description: 'Whether to show mismatches for incorrect name and description of request',
        external: true,
        usage: ['VALIDATION']
      },
      {
        name: 'Ignore mismatch for unresolved postman variables',
        id: 'ignoreUnresolvedVariables',
        type: 'boolean',
        default: false,
        description: 'Whether to ignore mismatches resulting from unresolved variables in the Postman request',
        external: true,
        usage: ['VALIDATION']
      },
      {
        name: 'Enable strict request matching',
        id: 'strictRequestMatching',
        type: 'boolean',
        default: false,
        description: 'Whether requests should be strictly matched with schema operations. Setting to true will not ' +
          'include any matches where the URL path segments don\'t match exactly.',
        external: true,
        usage: ['VALIDATION']
      },
      {
        name: 'Disable optional parameters',
        id: 'disableOptionalParameters',
        type: 'boolean',
        default: false,
        description: 'Whether to set optional parameters as disabled',
        external: true,
        usage: ['CONVERSION']
      },
      {
        name: 'Separate requests',
        id: 'separateRequests',
        type: 'array',
        default: null,
        description: 'Whether to have separate requests for multiple response status codes',
        external: true,
        usage: ['CONVERSION']
      }
    ];

    // Filter options based on criteria
    if (_.isObject(criteria)) {
      typeof criteria.external === 'boolean' && (optsArray = _.filter(optsArray, { external: criteria.external }));
      if (_.isArray(criteria.usage)) {
        let tempOptsArray = [];

        _.forEach(criteria.usage, (usageCriteria) => {
          tempOptsArray = _.concat(tempOptsArray, _.filter(optsArray, (option) => {
            return _.includes(option.usage, usageCriteria);
          }));
        });
        optsArray = tempOptsArray;
      }
    }

    if (mode === 'use') {
      // options to be used as default kv-pairs
      let defOptions = {};
      _.each(optsArray, (opt) => {
        // special handling for indent character as in documentation it states `Tab` and `Space`
        // but for the generation mode, we need actual values
        if (opt.id === 'indentCharacter') {
          defOptions[opt.id] = opt.default === 'tab' ? '\t' : ' ';
        }
        else {
          defOptions[opt.id] = opt.default;
        }
      });
      return defOptions;
    }

    // options to be used as documentation
    return _.filter(optsArray, (opt) => {
      // only return options that are externally controllable
      return opt.external === true;
    });
  }
};
