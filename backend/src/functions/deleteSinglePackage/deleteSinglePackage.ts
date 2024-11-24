import { DynamoDBClient, GetItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamodb = new DynamoDBClient({});
const s3Client = new S3Client({});
const TABLE_NAME = "PackageRegistry";
const BUCKET_NAME = "storage-phase-2";

// Validate PackageID format
const isValidPackageId = (id: string): boolean => {
  const packageIdPattern = /^[a-zA-Z0-9\-]+$/;
  return packageIdPattern.test(id);
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Starting deletion process');
    // Extract package ID from path parameters
    console.log('Event:', JSON.stringify(event));
    const packageId = event.pathParameters?.id;
    console.log('Package ID:', packageId);

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
          message: 'Invalid package ID format'
        })
      };
    }

    // First, get the item to retrieve the S3 key
    const getParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        id: packageId
      })
    };

    // Get the item first to retrieve S3 key
    const getCommand = new GetItemCommand(getParams);
    const getResult = await dynamodb.send(getCommand);

    if (!getResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Package not found'
        })
      };
    }

    // Get S3 key from the item
    const item = unmarshall(getResult.Item);
    const s3Key = item.s3Key; // Assuming the S3 key is stored in an attribute named 's3Key'

    // Delete from S3 first
    if (s3Key && BUCKET_NAME) {
      const deleteS3Params = {
        Bucket: BUCKET_NAME,
        Key: s3Key
      };

      await s3Client.send(new DeleteObjectCommand(deleteS3Params));
    }

    // Delete from DynamoDB
    const deleteDynamoParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        id: packageId
      })
    };

    await dynamodb.send(new DeleteItemCommand(deleteDynamoParams));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Package successfully deleted'
      })
    };

  } catch (error) {
    console.error('Error deleting package:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error while deleting package'
      })
    };
  }
};