/*
/package:
    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PackageData'
            examples:
              ExampleRequestWithContent:
                value:
                  Content: |
                        UEsDBAoAAAAAACAfUFkAAAAAAAAAAAAAAAASAAkAdW5kZXJzY29yZS1t.........fQFQAoADBkODIwZWY3MjkyY2RlYzI4ZGQ4YjVkNTY1OTIxYjgxMDBjYTMzOTc=
                  JSProgram: |
                    if (process.argv.length === 7) {
                    console.log('Success')
                    process.exit(0)
                    } else {
                    console.log('Failed')
                    process.exit(1)
                    }
                  debloat: false
                  Name: cool-package
              ExampleRequestWithURL:
                value:
                  JSProgram: |
                    if (process.argv.length === 7) {
                    console.log('Success')
                    process.exit(0)
                    } else {
                    console.log('Failed')
                    process.exit(1)
                    }
                  URL: https://github.com/jashkenas/underscore
        required: true
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Package'
              examples:
                ExampleResponseWithURL:
                  value:
                    metadata:
                      Name: Underscore
                      Version: 1.0.0
                      ID: underscore
                    data:
                      Content: |
                        UEsDBAoAAAAAACAfUFkAAAAAAAAAAAAAAAASAAkAdW5kZXJzY29yZS1t.........fQFQAoADBkODIwZWY3MjkyY2RlYzI4ZGQ4YjVkNTY1OTIxYjgxMDBjYTMzOTc=
                      URL: https://github.com/jashkenas/underscore
                      JSProgram: |
                        if (process.argv.length === 7) {
                        console.log('Success')
                        process.exit(0)
                        } else {
                        console.log('Failed')
                        process.exit(1)
                        }
                ExampleResponseWithContent:
                  value:
                    metadata:
                      Name: Underscore
                      Version: 1.0.0
                      ID: underscore
                    data:
                      Content: |
                        UEsDBAoAAAAAACAfUFkAAAAAAAAAAAAAAAASAAkAdW5kZXJzY29yZS1t.........fQFQAoADBkODIwZWY3MjkyY2RlYzI4ZGQ4YjVkNTY1OTIxYjgxMDBjYTMzOTc=
                      JSProgram: |
                        if (process.argv.length === 7) {
                        console.log('Success')
                        process.exit(0)
                        } else {
                        console.log('Failed')
                        process.exit(1)
                        }

          description: Success. Check the ID in the returned metadata for the official
            ID.
        "400":
          description: There is missing field(s) in the PackageData or it is formed improperly (e.g. Content and URL ar both set)
        403:
          description: Authentication failed due to invalid or missing AuthenticationToken.
        "409":
          description: Package exists already.
        "424":
          description: Package is not uploaded due to the disqualified rating.
      operationId: PackageCreate
      summary: Upload or Ingest a new package. (BASELINE)
      description: |-
                  Upload or Ingest a new package. Packages that are uploaded may have the same name but a new version. Refer to the description above to see how an id is formed for a pacakge.
    parameters:
    - name: X-Authorization
      description: ""
      schema:
        $ref: '#/components/schemas/AuthenticationToken'
      in: header
      required: true
*/

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from "zod";

// Initialize DynamoDB clients outside the handler for better performance
const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // Remove undefined values when writing to DynamoDB
  },
});

const TABLE_NAME = "PackageRegistry";

// Define schema for request validation
const PackageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  version: z.string().min(1, "Version is required"),
  description: z.string().optional(),
  author: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  url: z.string().url().optional(),   // New URL field validation
});

// Custom error class for better error handling
class PackageRegistryError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PackageRegistryError';
    this.statusCode = statusCode;
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let requestBody;
  try {
    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      throw new PackageRegistryError('Method not allowed', 405);
    }

    // Parse and validate request body
    try {
      if (!event.body) {
        throw new PackageRegistryError('Request body is missing');
      }
      requestBody = JSON.parse(event.body);
    } catch (err) {
      throw new PackageRegistryError('Invalid JSON payload');
    }

    // Validate against schema
    const validatedData = PackageSchema.parse(requestBody);

    // Create package ID
    const packageId = `${validatedData.name}@${validatedData.version}`;

    // Prepare the URL for the repo details
    const url = validatedData.url;

    if (!url) {
      throw new PackageRegistryError('URL is required to fetch repo data', 400);
    }

    // Prepare item for DynamoDB
    const timestamp = new Date().toISOString();
    const item = {
      id: packageId,
      ...validatedData,
      createdAt: timestamp,
      updatedAt: timestamp,
      _type: 'package', // Useful for filtering and querying
      _status: 'active',  // Useful for soft deletes
    };

    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(id)',
      })
    );

    return {
      statusCode: 201, // Created
      headers: {
        'Content-Type': 'application/json',
        'X-Package-Id': packageId,
      },
      body: JSON.stringify({
        message: 'Package created successfully completed with metrics',
        data: {
          packageId,
          name: validatedData.name,
          version: validatedData.version,
        },
      }),
    };

  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    } else {
      console.error('Unknown error:', error);
    }

    // Handle different types of errors
    let statusCode = 500;
    let message = 'Internal Server Error';

    if (error instanceof PackageRegistryError) {
      statusCode = error.statusCode;
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
    }

    if (error instanceof Error && error.name === 'ZodError') {
      statusCode = 400;
      message = 'Validation error';
    } else if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ConditionalCheckFailedException') {
      statusCode = 409; // Conflict
      message = `Package ${requestBody?.name}@${requestBody?.version} already exists`;
    }

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: {
          message,
          details: (error as any).name === 'ZodError' ? (error as any).errors : undefined,
        },
      }),
    };
  }
};

// {
//   "httpMethod": "POST",
//   "body": "{\"name\": \"my-package\", \"version\": \"1.0.0\", \"description\": \"A test package\"}"
// }
