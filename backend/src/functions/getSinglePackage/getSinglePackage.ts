import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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

// Get and convert S3 content to base64
async function getS3ContentAsBase64(s3Key: string): Promise<string> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    }));

    // Convert the readable stream to buffer
    const chunks = [];
    const stream = response.Body as any;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error getting S3 content:', error);
    throw new Error('Failed to retrieve package content from S3');
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Event:', JSON.stringify(event));
    console.log('Path Parameters:', JSON.stringify(event.pathParameters));
   
    const packageId = event.pathParameters?.id;
    console.log('Package ID:', packageId);

    if (!packageId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Missing package ID in path parameters'
        })
      };
    }

    if (!isValidPackageId(packageId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid package ID format. Must contain only alphanumeric characters and hyphens.'
        })
      };
    }

    const params = {
      TableName: TABLE_NAME!,
      Key: marshall({
        id: packageId
      })
    };

    const command = new GetItemCommand(params);
    const result = await dynamodb.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Package not found'
        })
      };
    }

    const unitem = unmarshall(result.Item);

    if (!unitem.s3Key) {
      throw new Error('S3 key not found in package metadata');
    }
    
    // Get base64 content from S3
    const base64Content = await getS3ContentAsBase64(unitem.s3Key);

    const response = {
      metadata: {
        Name: unitem.name,
        Version: unitem.version,
        ID: unitem.id
      },
      data: {
        Content: base64Content, // Now using the base64 content from S3
        URL: unitem.url,
        JSProgram: unitem.jsProgram
      }
    };

    return {
      statusCode: 200,
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