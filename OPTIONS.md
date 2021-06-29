id|type|available options|default|description|usage
|---|---|---|---|---|---|
requestNameSource|enum|URL, Fallback|Fallback|Determines how the requests inside the generated collection will be named. If “Fallback” is selected, the request will be named after one of the following schema values: `description`, `operationid`, `url`.|CONVERSION, VALIDATION
indentCharacter|enum|Space, Tab|Space|Option for setting indentation character|CONVERSION
collapseFolders|boolean|-|true|Importing will collapse all folders that have only one child element and lack persistent folder-level data.|CONVERSION
optimizeConversion|boolean|-|true|Optimizes conversion for large specification, disabling this option might affect the performance of conversion.|CONVERSION
requestParametersResolution|enum|Example, Schema|Schema|Select whether to generate the request parameters based on the [schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#schemaObject) or the [example](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#exampleObject) in the schema.|CONVERSION
exampleParametersResolution|enum|Example, Schema|Example|Select whether to generate the response parameters based on the [schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#schemaObject) or the [example](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#exampleObject) in the schema.|CONVERSION
folderStrategy|enum|Paths, Tags|Paths|Select whether to create folders according to the spec’s paths or tags.|CONVERSION
includeAuthInfoInExample|boolean|-|true|Select whether to include authentication parameters in the example request|CONVERSION
shortValidationErrors|boolean|-|false|Whether detailed error messages are required for request <> schema validation operations.|VALIDATION
validationPropertiesToIgnore|array|-|[]|Specific properties (parts of a request/response pair) to ignore during validation. Must be sent as an array of strings. Valid inputs in the array: PATHVARIABLE, QUERYPARAM, HEADER, BODY, RESPONSE_HEADER, RESPONSE_BODY|VALIDATION
showMissingInSchemaErrors|boolean|-|false|MISSING_IN_SCHEMA indicates that an extra parameter was included in the request. For most use cases, this need not be considered an error.|VALIDATION
detailedBlobValidation|boolean|-|false|Determines whether to show detailed mismatch information for application/json content in the request/response body.|VALIDATION
suggestAvailableFixes|boolean|-|false|Whether to provide fixes for patching corresponding mismatches.|VALIDATION
validateMetadata|boolean|-|false|Whether to show mismatches for incorrect name and description of request|VALIDATION
ignoreUnresolvedVariables|boolean|-|false|Whether to ignore mismatches resulting from unresolved variables in the Postman request|VALIDATION
strictRequestMatching|boolean|-|false|Whether requests should be strictly matched with schema operations. Setting to true will not include any matches where the URL path segments don't match exactly.|VALIDATION
disableOptionalParameters|boolean|-|false|Whether to set optional parameters as disabled|CONVERSION
separateRequests|array|-|null|Whether to have separate requests for multiple response status codes|CONVERSION
