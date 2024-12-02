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
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"; // Import the document client
import { APIGatewayEvent, Context } from "aws-lambda";

// Create a DynamoDB client instance
const dynamoClient = new DynamoDBClient({ region: "us-east-1" });

// Create a DynamoDBDocumentClient instance from the low-level DynamoDBClient
const documentClient = DynamoDBDocumentClient.from(dynamoClient);

// Define the DynamoDB table name
const TABLE_NAME = "PackageRegistry";

export const handler = async (event: APIGatewayEvent, context: Context) => {
    try {
        // Extract the search pattern from the event body (looking for 'RegEx')
        const requestBody = event.body ? JSON.parse(event.body) : {};
        const pattern: string = requestBody.RegEx || event.queryStringParameters?.RegEx;

        if (!pattern) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "'RegEx' is required for searching."
                }),
            };
        }

        const regex = new RegExp(pattern, "i"); // Create a case-insensitive regex

        // Scan the table for all items using the DocumentClient
        const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
        });

        const scanResult = await documentClient.send(scanCommand);

        // Check for items in the response
        if (!scanResult.Items || scanResult.Items.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: "No items found in the table."
                }),
            };
        }

        // Filter items based on the Name column
        const filteredItems = scanResult.Items.filter((item) => {
            const name = item.Name || ""; // Extract Name attribute directly (no need for .S)
            return regex.test(name);
        });

        // Respond with the filtered items
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Matching items found.",
                items: filteredItems,
            }),
        };
    } catch (error) {
        console.error("Error processing request:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal server error.",
                error: error.message,
            }),
        };
    }
};