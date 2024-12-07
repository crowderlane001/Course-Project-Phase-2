// /packages:
//     post:
//       requestBody:
//         content:
//           application/json:
//             schema:
//               type: array
//               items:
//                 $ref: '#/components/schemas/PackageQuery'
//         required: true
//       parameters:
//       - name: offset
//         description: "Provide this for pagination. If not provided, returns the first\
//           \ page of results."
//         schema:
//           $ref: '#/components/schemas/EnumerateOffset'
//         in: query
//         required: false
//       responses:
//         "200":
//           headers:
//             offset:
//               schema:
//                 $ref: '#/components/schemas/EnumerateOffset'
//               examples:
//                 ExampleRequest:
//                   value: "3"
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
//                   - Version: 1.2.3
//                     Name: Lodash
//                     ID: lodash
//                   - Version: 1.2.3
//                     Name: React
//                     ID: react
//           description: List of packages
//         "400":
//           description: "There is missing field(s) in the PackageQuery or it is formed improperly, or is invalid."
//         403:
//           description: Authentication failed due to invalid or missing AuthenticationToken.
//         "413":
//           description: Too many packages returned.
//       operationId: PackagesList
//       summary: Get the packages from the registry. (BASELINE)
//       description: |-
//         Get any packages fitting the query.
//         Search for packages satisfying the indicated query.

//         If you want to enumerate all packages, provide an array with a single PackageQuery whose name is "*".

//         The response is paginated; the response header includes the offset to use in the next query.

//         In the Request Body below, "Version" has all the possible inputs. The "Version" cannot be a combinaiton of the different possibilities.
//     parameters:
//     - name: X-Authorization
//       description: ""
//       schema:
//         $ref: '#/components/schemas/AuthenticationToken'
//       in: header
//       required: true


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

// PackageQuery:
//       description: ""
//       required:
//       - Name
//       type: object
//       properties:1
//         Version:
//           $ref: '#/components/schemas/SemverRange'
//           description: ""
//         Name:
//           $ref: '#/components/schemas/PackageName'
//           description: ""

// SemverRange:
//       description: ""
//       type: string
//       example: |-
//         Exact (1.2.3)
//         Bounded range (1.2.3-2.1.0)
//         Carat (^1.2.3)
//         Tilde (~1.2.0)

// PackageName:
//       description: |-
//         Name of a package.

//         - Names should only use typical "keyboard" characters.
//         - The name "*" is reserved. See the `/packages` API for its meaning.
//       type: string
import { z } from 'zod';
import {
  DynamoDBClient,
  ScanCommand,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Schema Definitions
const PackageName = z.string().min(1);
const SemverRange = z.string().optional(); // Version is now optional

// PackageQuery Schema for request validation
const PackageQuerySchema = z.object({
  Name: PackageName,
  Version: SemverRange,
});

const FetchPackagesSchema = z.array(PackageQuerySchema);

// Pagination offset schema
const OFFSET_SCHEMA = z.coerce.number().int().min(0).default(0);

const TABLE_NAME = 'PackageRegistry';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});

// Helper function to fetch all packages (wildcard scenario)
async function fetchAllPackages(offset: number = 0): Promise<any[]> {
  try {
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      Limit: 10,
      ExclusiveStartKey: offset > 0 ? { ID: { N: offset.toString() } } : undefined,
    });

    const response = await dynamoClient.send(scanCommand);
    return response.Items || [];
  } catch (error) {
    console.error('Error scanning packages:', error);
    throw new Error(`Failed to fetch all packages: ${(error as Error).message}`);
  }
}

// Helper function to fetch packages by name and version
async function fetchPackagesByNameAndVersion(
  name: string,
  version?: string,
  offset: number = 0
): Promise<any[]> {
  try {
    const queryInput: QueryCommandInput = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#name = :name',
      ExpressionAttributeNames: { '#name': 'Name' },
      ExpressionAttributeValues: { ':name': { S: name } },
      Limit: 10,
      ExclusiveStartKey: offset > 0 ? { Name: { S: name }, Version: { S: version || '' } } : undefined,
    };

    // Add condition for version if provided
    if (version) {
      queryInput.KeyConditionExpression += ' and #version = :version';
      queryInput.ExpressionAttributeNames!['#version'] = 'Version';
      queryInput.ExpressionAttributeValues![':version'] = { S: version };
    }

    const response = await dynamoClient.send(new QueryCommand(queryInput));
    return response.Items || [];
  } catch (error) {
    console.error('Error querying packages:', error);
    throw new Error(`Failed to query packages: ${(error as Error).message}`);
  }
}

// Lambda Handler
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received event:', JSON.stringify(event));
  try {
    // Validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validationResult = FetchPackagesSchema.safeParse(body);
    console.log('Parsed body:', JSON.stringify(body));

    if (!validationResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request data',
          details: validationResult.error.errors,
        }),
      };
    }

    // Validate and parse offset from query string
    const offsetResult = OFFSET_SCHEMA.safeParse(event.queryStringParameters?.offset);
    if (!offsetResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid offset', details: offsetResult.error.errors }),
      };
    }
    const offset = offsetResult.data;

    // Fetch packages based on queries
    const results = await Promise.all(
      validationResult.data.map(async ({ Name, Version }) => {
        if (Name === '*') {
          // Wildcard: Return all packages
          return fetchAllPackages(offset);
        } else {
          // Specific query by name and optional version
          return fetchPackagesByNameAndVersion(Name, Version, offset);
        }
      })
    );

    // Flatten and format results
    const formattedResults = results.flat().map((item) => ({
      Name: item.Name.S,
      Version: item.Version?.S,
      ID: item.ID.S,
    }));
    console.log('Formatted results:', JSON.stringify(formattedResults));
    // Return the result with paginated offs
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173", // Allow requests from your frontend
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Allow HTTP methods
        "Access-Control-Allow-Headers": "Content-Type, X-Authorization", // Allow headers
      },
      body: JSON.stringify(formattedResults),
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server errorings', 
        details: (error as Error).message,
        stack: (error as Error).stack 
      }),
    };
  }
}