import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamodb = new DynamoDBClient({});
const s3Client = new S3Client({});
const TABLE_NAME = "PackageRegistry";
const BUCKET_NAME = "storage-phase-2";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Starting bulk deletion process');

    // First, scan DynamoDB table to get all items
    const scanParams = {
      TableName: TABLE_NAME
    };

    let items: any[] = [];
    let lastEvaluatedKey: any = undefined;

    // Paginate through all items in DynamoDB
    do {
      const scanCommand = new ScanCommand({
        ...scanParams,
        ExclusiveStartKey: lastEvaluatedKey
      });
      
      const scanResult = await dynamodb.send(scanCommand);
      if (scanResult.Items) {
        items = items.concat(scanResult.Items.map(item => unmarshall(item)));
      }
      
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Found ${items.length} items to delete`);

    // Delete all objects from S3
    const deletionPromises = items.map(async (item) => {
      try {
        // Delete from S3 if s3Key exists
        if (item.s3Key && BUCKET_NAME) {
          const deleteS3Params = {
            Bucket: BUCKET_NAME,
            Key: item.s3Key
          };
          await s3Client.send(new DeleteObjectCommand(deleteS3Params));
        }

        // Delete from DynamoDB
        const deleteDynamoParams = {
          TableName: TABLE_NAME,
          Key: marshall({
            id: item.id
          })
        };
        await dynamodb.send(new DeleteItemCommand(deleteDynamoParams));

        return item.id;
      } catch (error) {
        console.error(`Error deleting item ${item.id}:`, error);
        return null;
      }
    });

    // Wait for all deletions to complete
    const results = await Promise.allSettled(deletionPromises);
    
    // Count successful and failed deletions
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value).length;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Bulk deletion completed',
        summary: {
          totalProcessed: items.length,
          successfulDeletions: successful,
          failedDeletions: failed
        }
      })
    };

  } catch (error) {
    console.error('Error in bulk deletion:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error during bulk deletion'
      })
    };
  }
};