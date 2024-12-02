import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const s3Client = new S3Client({});
const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = "PackageRegistry";
const BUCKET_NAME = "storage-phase-2";

// Get package size from S3 in MB
async function getPackageSize(s3Key: string): Promise<number> {
    try {
        const command = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key
        });
        const response = await s3Client.send(command);
        if (!response.ContentLength) {
            throw new Error('ContentLength is undefined');
        }
        return response.ContentLength / (1024 * 1024); // Convert bytes to MB
    } catch (error) {
        console.error('Error getting package size:', error);
        throw error;
    }
}

// Get package from DynamoDB using Scan
async function getPackageFromDB(packageId: string) {
    try {
        console.log('Looking up package with ID:', packageId);
        
        const command = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'ID = :id',
            ExpressionAttributeValues: marshall({
                ':id': packageId
            })
        });

        const result = await dynamoDb.send(command);
        
        if (!result.Items || result.Items.length === 0) {
            throw new Error('Package not found');
        }

        return unmarshall(result.Items[0]);
    } catch (error) {
        console.error('Error getting package from DB:', error);
        throw error;
    }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Check authentication
        if (!event.headers['X-Authorization']) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Authentication failed due to invalid or missing AuthenticationToken' })
            };
        }

        // Get and validate package ID
        const packageId = event.pathParameters?.id;
        const includeDependencies = event.queryStringParameters?.dependency === 'true';

        if (!packageId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing package ID' })
            };
        }

        try {
            const item = await getPackageFromDB(packageId);
            const standaloneSize = await getPackageSize(item.s3Key);

            let response;
            if (includeDependencies) {
                // For now, just return standalone size as total size since we're skipping dependencies
                response = {
                    [packageId]: {
                        standaloneCost: Number(standaloneSize.toFixed(3)),
                        totalCost: Number(standaloneSize.toFixed(3))
                    }
                };
            } else {
                response = {
                    [packageId]: {
                        totalCost: Number(standaloneSize.toFixed(3))
                    }
                };
            }

            return {
                statusCode: 200,
                body: JSON.stringify(response)
            };

        } catch (error) {
            if ((error as Error).message === 'Package not found') {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: 'Package does not exist' })
                };
            }
            throw error;
        }

    } catch (error) {
        console.error('Error calculating package cost:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                message: 'The package rating system choked on at least one of the metrics' 
            })
        };
    }
};