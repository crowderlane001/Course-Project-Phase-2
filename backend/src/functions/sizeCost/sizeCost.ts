import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import AdmZip = require('adm-zip');

const s3Client = new S3Client({});
const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = "PackageRegistry";
const BUCKET_NAME = "storage-phase-2";

// Validate PackageID format
const isValidPackageId = (id: string): boolean => {
    const packageIdPattern = /^[a-zA-Z0-9\-]+$/; // Updated regex pattern to match OpenAPI spec
    return packageIdPattern.test(id);
};

// Get package size from S3 in MB
async function getPackageSize(s3Key: string): Promise<number> {
    try {
        const command = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key
        });
        const response = await s3Client.send(command);

        if (response.ContentLength === undefined || response.ContentLength === null) {
            throw new Error('ContentLength is undefined');
        }

        return response.ContentLength / (1024 * 1024); // Convert bytes to MB
    } catch (error) {
        console.error('Error getting package size:', error);
        throw new Error('Failed to get package size');
    }
}

// Get dependencies from package.json in zip file
async function getDependencies(s3Key: string): Promise<string[]> {
    try {
        // Get zip file from S3
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key
        });
        const response = await s3Client.send(command);

        if (!response.Body) {
            throw new Error('Empty package content');
        }

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as any) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Parse zip and find package.json
        const zip = new AdmZip(buffer);
        const packageJsonEntry = zip.getEntries().find(entry =>
            entry.entryName.endsWith('package.json') && !entry.entryName.includes('node_modules')
        );

        if (!packageJsonEntry) {
            console.log('No package.json found');
            return [];
        }

        // Parse package.json
        const packageJson = JSON.parse(packageJsonEntry.getData().toString());

        // Get all dependencies
        const allDependencies = {
            ...(packageJson.dependencies || {}),
            ...(packageJson.devDependencies || {}),
            ...(packageJson.peerDependencies || {})
        };

        // Convert dependencies to package IDs (you might need to adjust this based on your ID generation logic)
        return Object.keys(allDependencies).map(depName => {
            const version = allDependencies[depName].replace(/[\^~]/g, '');
            const depId = `${depName}-${version}`.toLowerCase().replace(/[^a-z0-9\-]/g, '-');
            return depId;
        });

    } catch (error) {
        console.error('Error getting dependencies:', error);
        return [];
    }
}

// Calculate total cost including dependencies
async function calculateTotalCost(
    packageId: string,
    seenPackages = new Set<string>()
): Promise<{ [key: string]: { standaloneCost: number; totalCost: number } }> {
    if (seenPackages.has(packageId)) {
        return {};
    }
    seenPackages.add(packageId);

    try {
        // Get package info from DynamoDB
        const getItemCommand = new GetItemCommand({
            TableName: TABLE_NAME,
            Key: marshall({ id: packageId })
        });
        const result = await dynamoDb.send(getItemCommand);

        if (!result.Item) {
            // If package is not found, skip it
            return {};
        }

        const item = unmarshall(result.Item);
        const packageSize = await getPackageSize(item.s3Key);

        // Initialize cost map for this package
        let costMap: { [key: string]: { standaloneCost: number; totalCost: number } } = {
            [packageId]: {
                standaloneCost: Number(packageSize.toFixed(3)),
                totalCost: Number(packageSize.toFixed(3)) // Will update after adding dependencies
            }
        };

        // Get dependencies and calculate their costs
        const dependencies = await getDependencies(item.s3Key);
        for (const depId of dependencies) {
            const depCosts = await calculateTotalCost(depId, seenPackages);
            // Merge dependency costs into the cost map
            for (const [depPackageId, depCost] of Object.entries(depCosts)) {
                if (!costMap[depPackageId]) {
                    costMap[depPackageId] = depCost;
                }
            }
            // Add dependency's total cost to this package's total cost
            costMap[packageId].totalCost += depCosts[depId]?.standaloneCost || 0;
        }

        // Round total cost
        costMap[packageId].totalCost = Number(costMap[packageId].totalCost.toFixed(3));

        return costMap;
    } catch (error) {
        console.error('Error calculating total cost:', error);
        throw error;
    }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Check authentication
        const authHeader = event.headers['X-Authorization'] || event.headers['x-authorization'];
        if (!authHeader) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Authentication failed due to invalid or missing AuthenticationToken' })
            };
        }

        // Extract and validate package ID
        const packageId = event.pathParameters?.id;
        const includeDependencies = event.queryStringParameters?.dependency === 'true';

        if (!packageId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'There is missing field(s) in the PackageID' })
            };
        }

        if (!isValidPackageId(packageId)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid PackageID format' })
            };
        }

        // Get package info from DynamoDB
        const getItemCommand = new GetItemCommand({
            TableName: TABLE_NAME,
            Key: marshall({ id: packageId })
        });

        const result = await dynamoDb.send(getItemCommand);

        if (!result.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Package does not exist' })
            };
        }

        const item = unmarshall(result.Item);
        const packageSize = await getPackageSize(item.s3Key);

        // Format response based on whether dependencies are included
        let response;
        if (includeDependencies) {
            const costMap = await calculateTotalCost(packageId);
            response = costMap;
        } else {
            response = {
                [packageId]: {
                    totalCost: Number(packageSize.toFixed(3))
                }
            };
        }
        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };

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
