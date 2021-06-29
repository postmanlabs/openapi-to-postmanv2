# OpenAPI-Postman Changelog

#### v2.8.0 (June 29, 2021)
* Add a new argument in input object 'origin' to handle browser specific changes.
* Added handling for type errors encountered on sentry.

#### v2.7.0 (May 14, 2021)
* Added support for no-auth as auth in collection when empty object is specified in OAS.
* Bumped up dependencies and dev-dependencies.

#### v2.6.0 (May 05, 2021)
* Fixed issue where nested objects present in parameters caused validation mismatches.
* Fixed issue in schema faker where schema with property named deafult was faked incorrectly.

#### v2.5.1 (March 19, 2021)
* Fixed wrongly defined maxLength and minLength options for schemaFaker.

#### v2.5.0 (March 18, 2021)
* Fix for [#337](https://github.com/postmanlabs/openapi-to-postman/issues/337) - Fixed issue where non-required params were not disbled for urlencoded body.
* Fix for [#338](https://github.com/postmanlabs/openapi-to-postman/issues/338) - Fixed issue where examples which had non-truthy value were not present in converted collection.
* Fixed issue where resolved schema contain conflicting info regarding pattern and format resulting in validation mismatches.
* Fixed issue where definition for path variable in path caused no matched request for certain paths in validation.

#### v2.4.0 (March 08, 2021)
* Fix for [#9396](https://github.com/postmanlabs/postman-app-support/issues/9396) - Fixed validation issue where result contained matched endpoints in incorrect order.
* Fix for [#328](https://github.com/postmanlabs/openapi-to-postman/issues/328) - Fixed incorrect usage of id field in sdk.variable and used key.
* Fix for [issue](https://community.postman.com/t/user-feedback-updating-api-elements/13308/13) where implicit headers generation and validation.
* Fix for [#329](https://github.com/postmanlabs/openapi-to-postman/issues/329) - Fixed issue where --test was failing for cli.

#### v2.3.0 (February 19, 2021)
* Fixed [issue](https://community.postman.com/t/user-feedback-updating-api-elements/13308/13) where content type header was reported missing in validation even if present.
* Feature request [#9046](https://github.com/postmanlabs/postman-app-support/issues/9046) - Added support for validation of request body of type urlencoded.

#### v2.2.0 (January 28, 2021)
* Fixed [issue](https://community.postman.com/t/openapi-import-with-multi-file-support/9439/8) with import folder flow on respective platform.
* Fixed issue where collection did not contain name for specification with empty string as title.
* Updated description of option to disable optional parameters.

#### v2.1.0 (January 27, 2021)
* Fix for [#9404](https://github.com/postmanlabs/postman-app-support/issues/9404) - Fixed issue where incorrect mismatches were reported for valid path variables.
* Fixed issue where validation result contained incorrect path variable indices.
* Fix for [#9344](https://github.com/postmanlabs/postman-app-support/issues/9344) - Fixed issue where for type array examples with more than 2 elements were not used.
* Fix for [#9080](https://github.com/postmanlabs/postman-app-support/issues/9080) - Fixed issue where parameter examples were not used in faked data.
* Fix for [#315](https://github.com/postmanlabs/openapi-to-postman/issues/315) - Fixed issue where ConfigFile options are overwritten by CLI options.
* Fix for [#69](https://github.com/postmanlabs/openapi-to-postman/issues/69) - Fixed incorrect handling for explodable parameters for resolution schema.
* Added support for disabling optional parameters via option.

#### v2.0.0 (October 15, 2020)
* Updated minimum supported node version to v8.
* Fixed issue where schemas in allOf were not resolved correctly.
* Added support for options in CLI converter.
* Bumped up few dev-dependency versions.

#### v1.2.7 (September 9, 2020)
* Fixed issue where schema type object with no properties reolved to string.
* Fix for [#8474](https://github.com/postmanlabs/postman-app-support/issues/8474) - Unable to validate primitive data types in req/res body.
* Added support for handling correct media types which were throwing mismatches for validation.
* Added support for internal $ref resolution in validation flows.
* Fixed issue where parameter resolution was "schema" when "example" was specified.
* Add supported formats for schema resolution (deref).
* Fix for [#7643](https://github.com/postmanlabs/postman-app-support/issues/7643), [#7914](https://github.com/postmanlabs/postman-app-support/issues/7914), [#9004](https://github.com/postmanlabs/postman-app-support/issues/9004) - Added support for Auth params in response/example.
* Bumped up multiple dependecies and dev-dependencies versions to keep them up-to-date.
* Updated code coverage tool from deprecated istanbul to nyc.

#### v1.2.6 (August 10, 2020)
* Fixed TypeError happening when null parameter value provided.
* Fixed an issue where suggested value for mismatch did not fix corresponding mismatch upon applying.
* Fixed issue where root path was not matched during validation.
* Fixed an issue where transaction was not matching if path had segment with fix and variable parts during valiadtion.
* Fixed issue where URL did not contain baseUrl as host when base url variables are present.
* Fixed issue where collection variable generated for path variables had empty values.
* Fixed issue where invalid deserialisation was happening for param style matrix.
* Added validation tests to improve code coverage.

#### v1.2.5 (July 21, 2020)
* Fixed incorrect variable name in schemapack.js.

#### v1.2.4 (July 15, 2020)
* Introducing a new option `Optimize conversion` for improving performance of conversion for larger schemas.

#### v1.2.3 (July 14, 2020)
* Added support for parameter serialisation in conversion and deserialisation in validation.
* Skipped validation for headers/query-params added by security scheme.
* Fixed incorrect Url and collection variable when path level server is present.
* Fixed issue where empty description property caused mismatch.
* Fixed issue where mismatch was happening even when correct path variable is present.
* Fixed dataPath handling for root property when dataPath is empty string.
* Fixed collection variable ignoring when pattern property is present.
* Added support for collection variables for local servers in suggested request for validation.
* Fixed TypeError happening when empty parameter is provided.
* Fixed invalid transaction json path for headers.

#### v1.2.2 (June 29, 2020)
* Added support for collection request as suggested value for missing endpoints.
* Use forked version of oas-resolver to make folder imports work in browser.
* Fixed issues with collection conforimg to JSON schema validation as per [v2.1.0](https://schema.getpostman.com/json/draft-07/collection/v2.1.0/) schema.

#### v1.2.1 (June 18, 2020)
* Added support for validating content-type header.

#### v1.2.0 (June 14, 2020)
* Added support for stricter request matching via option for validation.
* Added missing endpoints from collection info in result of validation.
* Suggest fixes in collection for violated properties in validation.
* Introduced option to validate metadata for validation.
* Use faked value instead of fallback to schema for parameter resolution when set to example.
* Use faked value instead of invalid schema defined example.
* Introduced option to ignore unresolved postman variable mismatches.
* Fixed invalid generated collection for body type formdata.

#### v1.1.19 (June 12, 2020)
* Fix for [#232](https://github.com/postmanlabs/openapi-to-postman/issues/232) - Changes default auth of requests to null conforming to the JSON schema.

#### v1.1.18 (June 1, 2020)
* Fix for [#86](https://github.com/postmanlabs/openapi-to-postman/issues/86) - Now global security schemes will be added at the collection level.

#### v1.1.17 (May 15, 2020)
* Fix for [#3](https://github.com/postmanlabs/openapi-to-postman/issues/3) [#57](https://github.com/postmanlabs/openapi-to-postman/issues/57) - Introduced a new option `folderStrategy`, can choose between `Tags` or `Path` while creating folders in Postman Collection.
* Fixed an issue where undefined was returned as error message while trying to import invalid format.
* Use `minItems` and `maxItems` values if available in schema with type array.

#### v1.1.16 (May 4, 2020)
* Change Url to URL in Naming Request option.

#### v1.1.15 (April 29, 2020)
* Add missing yaml dependency.

#### v1.1.14 (April 28, 2020)
* Added a new function to get meta data from a schema.
* Fix for [#169](https://github.com/postmanlabs/openapi-to-postman/issues/169) - Removed unused folderStrategy option.

#### v1.1.13 (April 21, 2020)
* Added support for detailed validation body mismatches with option detailedBlobValidation.
* Fix for [#8098](https://github.com/postmanlabs/postman-app-support/issues/8098) - Unable to validate schema with type array.
* Fixed URIError for invalid URI in transaction.
* Fix for [#152](https://github.com/postmanlabs/openapi-to-postman/issues/152) - Path references not resolved due to improver handling of special characters.
* Fix for [#160](https://github.com/postmanlabs/openapi-to-postman/issues/160) - Added handling for variables in local servers not a part of a URL segment. All path servers to be added as collection variables.
* Unresolved refs will not be stored in schemaResolutionCache.

#### v1.1.12 (Mar 26, 2020)
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/133 and https://github.com/postmanlabs/openapi-to-postman/issues/101
* Ignore resolving circular references.
* Upgrade commander from 2.3.0 to 2.20.3
* Upgrade postman-collection from 3.5.1 to 3.5.5

#### v1.1.11 (Mar 14, 2020)
* Safely handling invalid reference schemas/properties

#### v1.1.10 (Mar 4, 2020)
* Safely handling malformed URIs and schemas

#### v1.1.9 (Feb 17, 2020)
* Support for multi-file schemas. Added a new input method 'folder'.

#### v1.1.8 (Feb 15, 2020)
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/162

#### v1.1.7 (Feb 05, 2020)
* Caching faked/resolved schemas for better performance
* Empty input specs don't throw an error anymore
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/150 - empty examples don't throw exceptions during conversion
* A `(Required)` annotation is added for required parameters

#### v1.1.6 (Jan 13, 2020)
* Not throwing errors for missing schema path entries

#### v1.1.5 (Jan 10, 2020)
* Not throwing errors for invalid schema references
* Not throwing errors for invalid schema.path entries
* Not throwing errors for unknown schema types

#### v1.1.4 (Jan 07, 2020)
* More updated copy for mismatch reasons
* Added missing dependency for async.js

#### v1.1.2/v1.1.3 (Jan 03, 2020)
* Updated copy for mismatch reasons
* Returning errors instead of exceptions for invalid schemas
* Fix for duplicate mismatches

#### v1.1.1 (Jan 03, 2020)
* Correct validation against JSON request/response bodies
* Correct JSON paths in response mismatches

#### v1.1.0 (Jan 02, 2020)
* Handling cases where API definition parameters have no schema
* Validating input transaction schema before starting validation
* Forcing path variable descriptions to be strings instead of objects

#### v1.0.2 (Jan 01, 2020)
* Exposing option to hide MISSING_IN_SCHEMA mismatches, hiding them by default
* Consistent response formats, more resilient against invalid schemas

#### v1.0.1 (Jan 01, 2020)
* Deleting 'info.version' from generated collection JSON - it's not required and was causing versioning problems
* Scope-related bugfixes in schema validation flows

#### v1.0.0 (Dec 31, 2019)
* New API to validate requests against a schema
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/113 - Correct description set for falsy values
* Invalid file paths return a falsy result and a reason (instead of an error)
* Invalid option values don't throw errors anymore
* Readme typo fix (courtesy https://github.com/disposedtrolley)

#### v0.2.0 (Nov 22, 2019)
* Handled cases where the URL query has no description property
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/117 - Maintaining descriptions for form-urlencoded body params
* Added various options for converting OpenAPI specs into Postman Collections, including controlling how examples are generated
* Request parameters now default to a schema-based value generation, response parameters default to example-based value generation.

#### v0.1.0 (Oct 1, 2019)
* Fix for https://github.com/postmanlabs/swagger2-postman2/issues/21 - Not creating folders at each path level unless required
* Schemas with circular object definitions are imported successfully


#### v0.0.17/v0.0.18 (Sep 3, 2019)
* Empty local server definitions not crashing the converter
* Custom JSON headers being picked up for request/response body generation
* Stringifying boolean params if present as query parameters (courtesy https://github.com/Firtzberg)
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/102 - Not crashing on undefined name/email/description properties
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/90 - respecting `server` elements defined inside paths
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/98 - respecting `readOnly` and `writeOnly` properies while faking schemas
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/88 - escaping / and ~ characters in `$ref`s  (courtesy https://github.com/bzmw)


#### v0.0.16 (July 22, 2019)
* Corrected code snippet in README (courtesy https://github.com/simonlampen)
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/44 - Prevent crashes for specs that contain a root endpoint (courtesy https://github.com/pitpit)
* Ignoring missing body propertes in schema objects

#### v0.0.14 / v0.0.15 (June 5, 2019)
* Added system tests, updated lockfiles for npm@6.4.1
* Fix for https://github.com/postmanlabs/postman-app-support/issues/6538 - parsing JSON correctly from example references

#### v0.0.13 (May 29, 2019)
* Fix for https://github.com/postmanlabs/postman-app-support/issues/6538 - handling references in request/response examples
* Fix for https://github.com/postmanlabs/postman-app-support/issues/6500 - manually stringifying number types as a workaround for SDK issues
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/23 - custom schema formats are not ignored
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/18 - consistent parsing for URL variables
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/64 - array params don't cause a crash with schemaFaker disabled (courtesy https://github.com/brpeterman)
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/52 - allowing $refs to point to paths, not just components
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/27 - support for allOf-type schemas
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/45 - trailing slashes in the path don't create empty folders
* Using a placeholder for servers.url in case the spec has a falsy value
* Support for x-postman-meta for including Postman auth in converted collections


#### v0.0.12 (Apr 17, 2019)
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/36 - Property names with a . in the name are supported during schema faking

#### v0.0.11 (Apr 17, 2019)
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/47 - Accepting application/vnd.api+json headers as JSON
* Removing unused dependencies
* Fix CLI test commands (courtesy https://github.com/aerotog)
* Fix README typos (courtesy https://github.com/T1l3 and https://github.com/evertharmeling)

#### v0.0.10 (Jan 31, 2019)
* Safe property access to empty content/authHelper objects
* Setting postman_previewLanguage while setting responses
* Not overriding non-string variable types during schema faking
* Not doubly-stringifying string headers

#### v0.0.9 (December 17, 2018)
* Removing Node v4/5 from CI
* Ignoring falsy responses in the OAS spec
* Correct error handling/output logging in the executable
* Showing detailed error messages for malformed JSON/YAML
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/5 - headers with refs to deeply nested components should work
* Fix for https://github.com/postmanlabs/openapi-to-postman/issues/4 - the cwd (not __dirname) is used to look for files specified by -s
* Adding tests for the executable

#### v0.0.8 (December 12, 2018)
* Refactoring, restucturing tests
* Adding support for xml chemas
* Enabling travis CI
* Updating README, adding a license, moving to Github

#### v0.0.7 (December 7, 2018)
* Converting all console.error to console.warn

#### v0.0.6 (December 5, 2018)
* Handling schema.enum when no other schema is specified
* Resolving parameter schemas while creating requests
* Correctly setting path variable descriptions
* Using a browserified json-schema-faker

#### v0.0.5 (November 30, 2018)
* Populating the original request in generated example responses
* Infer the response content-type header from the response body
* Generating more human-readable folder/request names from snake_case/camelCase

#### v0.0.4 (November 29, 2018)
* Handling nested schemas, correct handling for oneOf/anyOf

#### v0.0.3 (November 29, 2018)
* Prefer examples to schemas while generating example response body
* Correct handling for scheme variables in the URL
* Ignoring schema errors for invalid references
* Blocking schema nesting of >20 levels
* Correctly handling empty security sets for requests
* Removing the insecure node-uuid dependency

#### v0.0.2 (November 19, 2018)
* Adding default URLs if "server" is absent
* Better indication of lack-of-support for allOf schemas

#### v0.0.1 (October 23, 2018)
* Base release
