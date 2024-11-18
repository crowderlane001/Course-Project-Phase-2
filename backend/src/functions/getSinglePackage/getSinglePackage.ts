import { DynamoDB } from 'aws-sdk';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamodb = new DynamoDB.DocumentClient();
const TABLE_NAME = "PackageRegistry";

// Validate PackageID format
const isValidPackageId = (id: string): boolean => {
  const packageIdPattern = /^[a-zA-Z0-9\-]+$/;
  return packageIdPattern.test(id);
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Extract package ID from path parameters
    const packageId = event.pathParameters?.id;

    // Check if package ID exists
    if (!packageId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Missing package ID in path parameters'
        })
      };
    }

    // Validate package ID format
    if (!isValidPackageId(packageId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid package ID format. Must contain only alphanumeric characters and hyphens.'
        })
      };
    }

    // Get authentication token from headers if needed
    // const authToken = event.headers?.['Authorization'];
    
    // // Add authentication check if required
    // if (!authToken) {
    //   return {
    //     statusCode: 403,
    //     body: JSON.stringify({
    //       message: 'Authentication failed. Missing authentication token.'
    //     })
    //   };
    // }

    // Query DynamoDB
    const params = {
      TableName: TABLE_NAME!,
      Key: {
        id: packageId
      }
    };

    const result = await dynamodb.get(params).promise();

    // Check if package exists
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Package not found'
        })
      };
    }

    // Transform DynamoDB item into response format
    const response = {
      metadata: {
        Name: result.Item.name,
        Version: result.Item.version,
        ID: result.Item.id
      },
      data: {
        Content: result.Item.content,
        URL: result.Item.url,
        JSProgram: result.Item.jsProgram
      }
    };

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error retrieving package:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error while retrieving package'
      })
    };
  }
};