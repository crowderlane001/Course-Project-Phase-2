// /package/byRegEx:
//     post:
//       requestBody:
//         content:
//           application/json:
//             schema:
//               $ref: '#/components/schemas/PackageRegEx'
//             examples:
//               ExampleRegEx:
//                 value:
//                   RegEx: .*?Underscore.*
//         required: true
//       responses:
//         "200":
//           content:
//             application/json:
//               schema:
//                 type: array
//                 items:
//                   $ref: '#/components/schemas/PackageMetadata'
//               examples:
//                 ExampleResponse:
//                   value:
//                   - Version: 1.2.3
//                     Name: Underscore
//                     ID: underscore
//                   - Version: 2.1.0
//                     Name: Lodash
//                     ID: lodash
//                   - Version: 1.2.0
//                     Name: React
//                     ID: react
//           description: Return a list of packages.
//         "400":
//           description: There is missing field(s) in the PackageRegEx or it is formed improperly, or is invalid
//         403:
//           description: Authentication failed due to invalid or missing AuthenticationToken.
//         "404":
//           description: No package found under this regex.
//       operationId: PackageByRegExGet
//       summary: Get any packages fitting the regular expression (BASELINE).
//       description: Search for a package using regular expression over package names
//         and READMEs. This is similar to search by name.
//     parameters:
//     - examples:
//         ExampleToken:
//           value: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
//       name: X-Authorization
//       description: ""
//       schema:
//         $ref: '#/components/schemas/AuthenticationToken'
//       in: header
//       required: true

// PackageRegEx:
//       description: ""
//       required:
//       - RegEx
//       type: object
//       properties:
//         RegEx:
//           description: A regular expression over package names and READMEs that is
//             used for searching for a package
//           type: string