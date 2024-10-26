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
        message: 'Package created successfully lets gooo',
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