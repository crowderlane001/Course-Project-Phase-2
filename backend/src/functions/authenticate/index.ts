//Default index file containing handler for authenticate endpoint

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

/*
/packages
/reset
/id POST(update)
/package (create)
/package/rate
/package/cost
/package/byRegex
*/

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const JWT_SECRET = '1b7e4f8a9c2d1e6m3k5p9q8r7t2y4x6zew';
const USERS_TABLE = "PackageRegistryUsers";

interface AuthRequest {
  User: {
    name: string;
    isAdmin: boolean;
  };
  Secret: {
    password: string;
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'There is missing field(s) in the AuthenticationRequest or it is formed improperly.' })
      };
    }

    const request: AuthRequest = JSON.parse(event.body);

    // Validate request structure
    if (!request.User?.name || request.User.isAdmin === undefined || !request.Secret?.password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'There is missing field(s) in the AuthenticationRequest or it is formed improperly.' })
      };
    }

    // Check if user exists
    const getCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { name: request.User.name }
    });
    const existingUser = await docClient.send(getCommand);

    if (!existingUser.Item) {

      // Hash password
      const hashedPassword = await bcrypt.hash(request.Secret.password, 10);

      // Store new user
      const putCommand = new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          name: request.User.name,
          isAdmin: request.User.isAdmin,
          password: hashedPassword,
          lastTokenIssueTime: Date.now()
        }
      });
      await docClient.send(putCommand);

    } else {
      // Verify password for existing user
      const isValidPassword = await bcrypt.compare(
        request.Secret.password, 
        existingUser.Item.password
      );

      if (!isValidPassword) {
        return {
          statusCode: 401,
          body: JSON.stringify({ message: 'The user or password is invalid.' })
        };
      }

      // Verify admin status hasn't been tampered with
      if (request.User.isAdmin !== existingUser.Item.isAdmin) {
        return {
          statusCode: 401,
          body: JSON.stringify({ message: 'The user or password is invalid.' })
        };
      }
    }

    // Generate JWT token ds
    const token = jwt.sign({
      name: request.User.name,
      isAdmin: request.User.isAdmin,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (10 * 60 * 60) // 10 hours
    }, JWT_SECRET);

    // Update API call count
    const updateCommand = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { name: request.User.name },
      UpdateExpression: 'SET lastTokenIssueTime = :time',
      ExpressionAttributeValues: {
        ':time': Date.now()
      }
    });
    await docClient.send(updateCommand);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from your frontend
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Allow HTTP methods
        "Access-Control-Allow-Headers": "Content-Type, Authorization", // Allow headers
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(`bearer ${token}`)
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};