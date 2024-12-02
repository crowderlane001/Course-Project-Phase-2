// src/functions/sizeCost/sizeCost.ts

import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as unzipper from 'unzipper'; // Correct namespace import
import * as stream from 'stream';
import { promisify } from 'util';

const pipeline = promisify(stream.pipeline);

const s3Client = new S3Client({});
const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = "PackageRegistry";
const BUCKET_NAME = "storage-phase-2";

// Custom Error Classes
class PackageNotFoundError extends Error {
    constructor(message: string = 'Package not found') {
        super(message);
        this.name = 'PackageNotFoundError'; // Ensure the name is set correctly
    }
}

// Cache to store already calculated costs to prevent redundant calculations
const costCache: { [key: string]: number } = {};

// Define the structure of dependencies
interface Dependency {
    name: string;
    version: string;
}

// Define the structure of a DynamoDB Package Item
interface PackageItem {
    ID: string;
    Name: string;
    Version: string;
    s3Key: string;
    dependencies?: Dependency[];
    // Add other relevant fields as needed
}

// Define the structure of package.json
interface PackageJson {
    dependencies?: Record<string, string>;
    // Add other relevant fields as needed
}

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
        throw new Error('Internal Server Error'); // Map to 500
    }
}

// Get package from DynamoDB using Query by Name and Version
async function getPackageIdByNameVersion(name: string, version: string): Promise<string | null> {
    try {
        console.log(`Querying DynamoDB for package ID with Name: ${name}, Version: ${version}`);
        const queryCommand = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'NameVersionIndex', // Ensure you have created this GSI in DynamoDB
            KeyConditionExpression: '#name = :nameVal AND #version = :versionVal',
            ExpressionAttributeNames: {
                '#name': 'Name',
                '#version': 'Version',
            },
            ExpressionAttributeValues: marshall({
                ':nameVal': name,
                ':versionVal': version,
            }),
            ProjectionExpression: 'ID',
        });

        const result = await dynamoDb.send(queryCommand);
        if (result.Items && result.Items.length > 0) {
            const item = unmarshall(result.Items[0]);
            console.log(`Found package ID: ${item.ID}`);
            return item.ID;
        } else {
            console.warn(`No package found for ${name}@${version}`);
            return null;
        }
    } catch (error) {
        console.error('Error querying package ID by Name and Version:', error);
        throw new Error('Internal Server Error'); // Map to 500
    }
}

// Get package from DynamoDB using Scan by ID
async function getPackageFromDB(packageId: string): Promise<PackageItem> {
    try {
        console.log('Scanning DynamoDB for package with ID:', packageId);

        const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'ID = :id',
            ExpressionAttributeValues: marshall({
                ':id': packageId
            })
        });

        const result = await dynamoDb.send(scanCommand);

        if (!result.Items || result.Items.length === 0) {
            throw new PackageNotFoundError();
        }

        const packageItem = unmarshall(result.Items[0]);

        // Type assertion to PackageItem
        return packageItem as PackageItem;
    } catch (error) {
        console.error('Error scanning DynamoDB for package:', error);
        if ((error as Error).name === 'PackageNotFoundError') {
            throw error; // Re-throw to be caught by the handler
        }
        throw new Error('Internal Server Error'); // For any other errors
    }
}

// Extract dependencies from package.json within the S3 zip file
async function extractDependenciesFromS3(s3Key: string): Promise<Dependency[]> {
    try {
        console.log(`Extracting dependencies from S3 key: ${s3Key}`);
        const getObjectCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key
        });

        const s3Response = await s3Client.send(getObjectCommand);
        if (!s3Response.Body) {
            throw new Error('S3 object body is undefined');
        }

        // Convert the S3 stream to a buffer
        const buffer = await streamToBuffer(s3Response.Body as stream.Readable);

        // Use unzipper to parse the zip buffer
        const directory = await unzipper.Open.buffer(buffer);
        const packageJsonFile = directory.files.find((file: unzipper.File) => file.path === 'package.json'); // Use 'File' type

        if (!packageJsonFile) {
            console.warn(`package.json not found in ${s3Key}`);
            return [];
        }

        const packageJsonContent = await packageJsonFile.buffer();
        const packageJson: PackageJson = JSON.parse(packageJsonContent.toString());

        const dependencies: Dependency[] = [];

        if (packageJson.dependencies) {
            for (const [name, version] of Object.entries(packageJson.dependencies)) {
                dependencies.push({ name, version });
            }
        }

        console.log(`Extracted dependencies:`, dependencies);
        return dependencies;
    } catch (error) {
        console.error('Error extracting dependencies from S3:', error);
        throw new Error('Internal Server Error'); // Map to 500
    }
}

// Helper function to convert a stream to a buffer
async function streamToBuffer(readableStream: stream.Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        readableStream.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        readableStream.on('end', () => resolve(Buffer.concat(chunks)));
        readableStream.on('error', reject);
    });
}

// Validate PackageID against the regex pattern '^[a-zA-Z0-9\-]+$'
function isValidPackageID(packageId: string): boolean {
    const packageIdPattern = /^[a-zA-Z0-9\-]+$/;
    return packageIdPattern.test(packageId);
}

// Calculate total cost including dependencies
async function calculateTotalCost(packageId: string, seenPackages: Set<string>): Promise<number> {
    console.log(`Calculating total cost for package ID: ${packageId}`);

    if (seenPackages.has(packageId)) {
        console.log(`Package ID ${packageId} already processed. Skipping to prevent circular dependency.`);
        return 0;
    }

    if (costCache[packageId] !== undefined) {
        console.log(`Cache hit for package ID: ${packageId}. Cost: ${costCache[packageId]} MB`);
        return costCache[packageId];
    }

    seenPackages.add(packageId);

    try {
        const item = await getPackageFromDB(packageId);
        if (!item) {
            console.warn(`Package with ID ${packageId} not found`);
            return 0;
        }

        const packageSize = await getPackageSize(item.s3Key);
        let totalCost = packageSize;

        let dependencies: Dependency[] = [];

        // Check if dependencies are already stored in DynamoDB item
        if (item.dependencies && Array.isArray(item.dependencies)) {
            dependencies = item.dependencies;
            console.log(`Dependencies found in DynamoDB for ${packageId}:`, dependencies);
        } else {
            // Extract dependencies from package.json
            dependencies = await extractDependenciesFromS3(item.s3Key);
        }

        console.log(`Processing dependencies for package ID: ${packageId}`);

        for (const dep of dependencies) {
            const depId = await getPackageIdByNameVersion(dep.name, dep.version);
            if (depId) {
                const depCost = await calculateTotalCost(depId, seenPackages);
                totalCost += depCost;
            } else {
                console.warn(`Dependency ${dep.name}@${dep.version} not found in registry.`);
            }
        }

        costCache[packageId] = totalCost;
        console.log(`Total cost for package ID ${packageId}: ${totalCost} MB`);
        return totalCost;
    } catch (error) {
        console.error(`Error calculating total cost for package ID ${packageId}:`, error);
        throw new Error('Internal Server Error'); // Map to 500
    }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Get and validate package ID
        const packageId = event.pathParameters?.id;
        const dependencyParam = event.queryStringParameters?.dependency;
        const includeDependencies = dependencyParam === 'true';

        if (!packageId) {
            console.warn('Missing packageId in path parameters');
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'There is missing field(s) in the PackageID or it is formed improperly, or is invalid.' })
            };
        }

        // Validate packageId format
        if (!isValidPackageID(packageId)) {
            console.warn(`Invalid packageId format: ${packageId}`);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'There is missing field(s) in the PackageID or it is formed improperly, or is invalid.' })
            };
        }

        try {
            const item = await getPackageFromDB(packageId);
            const standaloneSize = await getPackageSize(item.s3Key);

            let response: any = {};

            if (includeDependencies) {
                const totalCost = await calculateTotalCost(packageId, new Set<string>());
                response = {
                    [packageId]: {
                        standaloneCost: Number(standaloneSize.toFixed(3)),
                        totalCost: Number(totalCost.toFixed(3))
                    }
                };
            } else {
                response = {
                    [packageId]: {
                        totalCost: Number(standaloneSize.toFixed(3))
                    }
                };
            }

            console.log(`Returning 200 for package ID ${packageId}`);
            return {
                statusCode: 200,
                body: JSON.stringify(response)
            };

        } catch (error) {
            // Log error details for debugging
            console.error('Error during package processing:', error);

            // Check error name to determine the status code
            if ((error as Error).name === 'PackageNotFoundError') {
                console.warn(`PackageNotFoundError: ${packageId} does not exist`);
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: 'Package does not exist.' })
                };
            }

            // For any other errors during package retrieval or cost calculation
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    message: 'The package rating system choked on at least one of the metrics.' 
                })
            };
        }

    } catch (error) {
        console.error('Unexpected error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                message: 'The package rating system choked on at least one of the metrics.' 
            })
        };
    }
};