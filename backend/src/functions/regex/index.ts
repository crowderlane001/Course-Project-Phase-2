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

// PackageMetadata:
//       description: |-
//         The "Name" and "Version" are used as a unique identifier pair when uploading a package.

//         The "ID" is used as an internal identifier for interacting with existing packages.
//       required:
//       - Name
//       - Version
//       - ID
//       type: object
//       properties:
//         Name:
//           $ref: '#/components/schemas/PackageName'
//         Version:
//           description: Package version
//           type: string
//           example: 1.2.3
//         ID:
//           $ref: '#/components/schemas/PackageID'

// PackageName:
// description: |-
//   Name of a package

//   - Names should only use typical "keyboard" characters.
//   - The name "*" is reserved. See the `/packages` API for its meaning.
// type: string
// description: "Unique ID for use with the /package/{id} endpoint."
// example: "123567192081501"
// type: string
// pattern: '^[a-zA-Z0-9\-]+$

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayEvent, Context } from "aws-lambda";
import * as jwt from 'jsonwebtoken';
const JWT_SECRET = '1b7e4f8a9c2d1e6m3k5p9q8r7t2y4x6zew';
const documentClient = new DynamoDBClient({});
const TABLE_NAME = "PackageRegistry";

function hasBacktrackingRisk(pattern: string): boolean {
    // Check for common patterns that can cause catastrophic backtracking
    const riskyPatterns = [
        /(\w+)\1+/,                    // Repeated groups
        /([^]*)(\1)+/,                 // Nested quantifiers
        /(.*){2,}/,                    // Multiple unbounded quantifiers
        /(.+)+/,                       // Repeated plus quantifier
        /(\w+)*\w+/,                   // Star quantifier followed by plus
        /([a-z]+)*([a-z]+)*/i,        // Multiple star quantifiers
        /(\b\w+\b\s*)+/,              // Repeated word boundaries
        /^(.*?)*$/,                    // Unbounded lookbehind-like pattern
    ];

    // Check for excessive nesting of groups
    const nestedGroups = (pattern.match(/\(/g) || []).length;
    if (nestedGroups > 3) return true;

    // Check for multiple adjacent quantifiers
    if (/[+*?]{2,}/.test(pattern)) return true;

    // Check pattern against known risky patterns
    return riskyPatterns.some(riskyPattern => riskyPattern.test(pattern));
}

export const handler = async (event: APIGatewayEvent, context: Context) => {
    const token = event.headers['X-Authorization']?.split(' ')[1];

    if (!token) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Authentication failed due to invalid or missing AuthenticationToken.' }),
      };
    }
  
    try {
      // Verify the JWT
      const decoded = jwt.verify(token, JWT_SECRET);
  
      console.log('Token is valid:', decoded);
    } catch (err) {
      console.error('Token verification failed:', err);
  
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Authentication failed due to invalid or missing AuthenticationToken.' }),
      };
    }

    try {
        // Extract the search pattern from the event body (looking for 'RegEx')
        const requestBody = event.body ? JSON.parse(event.body) : {};
        const pattern: string = requestBody.RegEx || event.queryStringParameters?.RegEx;

        if (!pattern) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "There is missing field(s) in the PackageRegEx or it is formed improperly, or is invalid",
                }),
            };
        }

        console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~REGEX~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        console.log(pattern);
        console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~REGEX~~~~~~~~~~~~~~~~~~~~~~~~~~~~');


        if (hasBacktrackingRisk(pattern)) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "There is missing field(s) in the PackageRegEx or it is formed improperly, or is invalid",
                }),
            };
        }

        let regex: RegExp;
        try {
            regex = new RegExp(pattern, "i"); // Create a case-insensitive regex
        } catch (err) {
            console.error("Invalid regex pattern:", err);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "There is missing field(s) in the PackageRegEx or it is formed improperly, or is invalid" }),
            };
        }

        // Scan the table for all items using the DocumentClient
        //backtracking in regex 400 where its bad

        const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
        });

        const scanResult = await documentClient.send(scanCommand);

        // Check for items in the response
        if (!scanResult.Items || scanResult.Items.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify([]), // Return an empty array if no packages are found
            };
        }

        const filteredItems = [];
        const timeout = 1000; // 1 second timeout for regex operations
    
        for (const item of scanResult.Items) {
            const name = item.Name || "";
            let match = false;
    
            try {
                const start = Date.now();
                match = regex.test(name);
                const duration = Date.now() - start;
    
                if (duration > timeout) {
                    throw new Error("Regex operation timed out");
                }
            } catch (err) {
                console.error("Regex operation failed:", err);
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: "Regex operation failed due to backtracking or excessive length" }),
                };
            }
    
            if (match) {
                if (!item.Name || !item.Version || !item.ID) {
                    console.warn(`Skipping invalid item: ${JSON.stringify(item)}`);
                    continue; // Exclude invalid items
                }
                filteredItems.push({
                    Name: item.Name, // Expected to exist
                    Version: item.Version, // Expected to exist
                    ID: item.ID, // Expected to exist
                });
            }
        }

        // Respond with the filtered items
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "http://localhost:5173", // Allow requests from your frontend
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Allow HTTP methods
                "Access-Control-Allow-Headers": "Content-Type, Authorization", // Allow headers
                'Content-Type': 'application/json'
              },
            body: JSON.stringify(filteredItems) // Return filteredItems directly
        };
    } catch (error) {
        console.error("Error processing request:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal server erroring."
            }),
        };
    }
};
