import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamodb = new DynamoDBClient({});
const s3Client = new S3Client({});

const TABLE_NAME = "PackageRegistry";
const BUCKET_NAME = "storage-phase-2";
const GSI_NAME = "id-index"; // Name of your GSI

interface PackageMetadata {
    Name: string;
    Version: string;
    ID: string;
    s3Key: string;
    URL: string;
    JSProgram: string;
}

interface PackageResponse {
    metadata: {
        Name: string;
        Version: string;
        ID: string;
    };
    data: {
        Content: string;
        URL: string;
        JSProgram: string;
    };
}

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

        const chunks: Buffer[] = [];
        const stream = response.Body as any;

        for await (const chunk of stream) {
            chunks.push(chunk as Buffer);
        }

        const buffer = Buffer.concat(chunks);
        return buffer.toString('base64');
    } catch (error) {
        console.error('Error getting S3 content:', error);
        throw new Error('Failed to retrieve package content from S3');
    }
}

async function getPackageById(packageId: string): Promise<PackageMetadata | null> {
    const params = {
        TableName: TABLE_NAME,
        IndexName: GSI_NAME,
        KeyConditionExpression: 'ID = :id',
        ExpressionAttributeValues: marshall({
            ':id': packageId
        })
    };

    const command = new QueryCommand(params);
    const result = await dynamodb.send(command);

    if (!result.Items || result.Items.length === 0) {
        return null;
    }

    return unmarshall(result.Items[0]) as PackageMetadata;
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

        const item = await getPackageById(packageId);

        if (!item) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Package not found'
                })
            };
        }

        if (!item.s3Key) {
            throw new Error('S3 key not found in package metadata');
        }

        const base64Content = await getS3ContentAsBase64(item.s3Key);

        const response: PackageResponse = {
            metadata: {
                Name: item.Name,
                Version: item.Version,
                ID: item.ID
            },
            data: {
                Content: base64Content,
                URL: item.URL,
                JSProgram: item.JSProgram
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