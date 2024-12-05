import { boolean, z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, QueryCommand, PutItemCommand, GetItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { Buffer } from 'buffer';
import axios from 'axios';
/*
Take in id via url, take in package schema, meta and dat
check if its already there
check the package originally, make sure it was uploaded by content / url like before
get all versions of the package
check version numbers, if we can upload
upload like normal afte

*/
const PackageName = z.string().min(1);
const PackageID = z.string().min(1);

const PackageMetadataSchema = z.object({
  Name: PackageName,
  Version: z.string().regex(/^\d+\.\d+\.\d+$/),
  ID: PackageID,
});

const PackageDataSchema = z.object({
  Content: z.string().optional(),
  URL: z.string().url().optional(),
  debloat: z.boolean().optional(),
  JSProgram: z.string().optional(),
}).refine(data => !(data.Content && data.URL), {
  message: "Cannot provide both Content and URL"
}).refine(data => data.Content || data.URL, {
  message: "Must provide either Content or URL"
});

const PackageSchema = z.object({
  metadata: PackageMetadataSchema,
  data: PackageDataSchema,
});

const ERROR_TYPES = {
  INVALID_REQUEST: { statusCode: 400, message: 'Invalid request parameters' },
  AUTH_FAILED: { statusCode: 403, message: 'Authentication failed' },
  NOT_FOUND: { statusCode: 404, message: 'Package not found' },
  VERSION_CONFLICT: { statusCode: 400, message: 'Invalid version sequence' },
  INGESTION_MISMATCH: { statusCode: 400, message: 'Content/URL ingestion method mismatch' }
};

const BUCKET_NAME = "storage-phase-2";
const TABLE_NAME = "PackageRegistry";
const GSI_NAME = "id-index";

// Initialize AWS clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});

// Helper function to check if package exists
async function checkPackageExists(name: string, version: string): Promise<boolean> {
  try {
    const response = await dynamoClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        'Name': { S: name },
        'Version': {S: version}
      }
    }));
    return !!response.Item;
  } catch (error) {
    console.error('Error checking package existence:', error);
    return false;
  }
}

  async function downloadAndStorePackage(url: string, content: string, packageId: string, isZip: boolean): Promise<{s3Key: string, base64Content: string}> {
    try {
      let downloadUrl: string;
      let packageData: Buffer;
      let base64Content: string;

      if (isZip){
        base64Content = content;
        packageData = Buffer.from(content, 'base64');
      }
      else{
        if (url.includes('npmjs.com')) {
          // Extract package name from NPM URL
          const packageName = url.split('/package/')[1];
          if (!packageName) {
            throw new Error('Invalid NPM URL format');
          }
    
          // First, get package metadata from NPM registry
          const registryResponse = await axios.get(
            `https://registry.npmjs.org/${packageName}`
          );
    
          // Get the latest version's tarball URL
          const latestVersion = registryResponse.data['dist-tags'].latest;
          downloadUrl = registryResponse.data.versions[latestVersion].dist.tarball;
    
          // Download the tarball
          const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'arraybuffer',
            headers: {
              'Accept': 'application/x-gzip',
              'User-Agent': 'AWS-Lambda'
            }
          });
    
          packageData = Buffer.from(response.data);
          base64Content = packageData.toString('base64');
        } else if (url.includes('github.com')) {
          // Handle GitHub URLs as before
          downloadUrl = url.replace('github.com', 'api.github.com/repos')
                          .replace(/\.git$/, '')
                          + '/zipball/master';
    
          const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'arraybuffer',
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'AWS-Lambda'
            }
          });
    
          packageData = Buffer.from(response.data);
          base64Content = packageData.toString('base64');
        } else {
          throw new Error('Unsupported package source URL');
        }
      }
  
      // Generate S3 key
      const fileExtension = url.includes('npmjs.com') ? 'tgz' : 'zip';
      const s3Key = `${packageId}.${fileExtension}`;
  
      // Upload to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: packageData,
        ContentType: url.includes('npmjs.com') ? 'application/gzip' : 'application/zip',
        Metadata: {
          'source-url': url
        }
      }));
  
      console.log(`Successfully stored package content at ${s3Key}`);
      return {
        s3Key,
        base64Content
      };
  
    } catch (error) {
      console.error('Error in downloadAndStorePackage:', error);
      throw new Error(`Failed to download and store package: ${(error as Error).message}`);
    }
  }

// Helper function to store package metadata in DynamoDB
async function storePackageMetadata(
  metadata: {
    Name: string;
    Version: string;
    ID: string;
  },
  data: {
    URL: string;
    JSProgram?: string;
    debloat?: boolean;
  },
  s3Key: string
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    const item: { 
      [key: string]: AttributeValue 
    } = {
      'ID': { S: metadata.ID },
      'Name': { S: metadata.Name },
      'Version': { S: metadata.Version },
      's3Key': { S: s3Key },
      'URL': { S: data.URL },
      'createdAt': { S: timestamp },
      'updatedAt': { S: timestamp }
    };

    if (data.JSProgram) {
      item['JSProgram'] = { S: data.JSProgram };
    }

    if (data.debloat !== undefined) {
      item['debloat'] = { BOOL: data.debloat };
    }

    await dynamoClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: item
    }));

    console.log(`Successfully stored metadata for package ${metadata.ID}`);

  } catch (error) {
    console.error('Error in storePackageMetadata:', error);
    throw new Error(`Failed to store package metadata: ${(error as Error).message}`);
  }
}

async function getPackageById(packageId: string) {
  console.log('Getting package with ID:', packageId);
  
  const params = {
    TableName: TABLE_NAME,
    IndexName: GSI_NAME,
    KeyConditionExpression: 'ID = :id',
    ExpressionAttributeValues: marshall({
      ':id': packageId
    })
  };
  
  console.log('DynamoDB Query Parameters:', JSON.stringify(params, null, 2));
  try {
    const command = new QueryCommand(params);
    const result = await dynamoClient.send(command);
    
    console.log('DynamoDB Response:', JSON.stringify(result, null, 2));
    
    if (!result.Items || result.Items.length === 0) {
      console.log('No items found in DynamoDB response');
      return null;
    }
    
    const unmarshalledItem = unmarshall(result.Items[0]);
    console.log('Unmarshalled item:', JSON.stringify(unmarshalledItem, null, 2));
    return unmarshalledItem;
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    throw error;
  }
}

async function validatePatchVersion(packageName: string, version: string, isURLUpload: boolean): Promise<boolean> {
  const [major, minor, patch] = version.split('.').map(Number);
  
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: '#name = :name and begins_with(#version, :version_prefix)',
    ExpressionAttributeNames: {
      '#name': 'Name',
      '#version': 'Version'
    },
    ExpressionAttributeValues: marshall({
      ':name': packageName,
      ':version_prefix': `${major}.${minor}.`
    })
  };

  try {
    const command = new QueryCommand(params);
    const response = await dynamoClient.send(command);
    const existingVersions = response.Items ? response.Items.map(item => unmarshall(item)) : [];

    console.log('Existing versions found:', existingVersions);

    // For URL-based packages, just check if version exists
    if (isURLUpload) {
      return !existingVersions.some(pkg => pkg.version === version);
    }

    // For Content-based packages, ensure patch version is higher
    for (const pkg of existingVersions) {
      console.log('Checking package:', pkg);
      const [, , existingPatch] = pkg.Version.split('.').map(Number);
      console.log('We are COMPARING PATCHES');
      console.log('Current patch:', patch);
      console.log('Existing patch:', existingPatch);
      console.log(patch);
      console.log(existingPatch);
      if (patch <= existingPatch) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    throw error;
  }
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ description: 'There is missing field(s) in the PackageID or it is formed improperly, or is invalid.' })
      };
    }

    const packageId = event.pathParameters?.id;

    const body = JSON.parse(event.body);
    console.log("Body!~~~~~~~!!!~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    console.log(body);
    const newPackageData = PackageSchema.safeParse(body);
    
    if (!newPackageData.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ description: 'There is missing field(s) in the PackageID or it is formed improperly, or is invalid.' })
      };
    }
    const newVersion = newPackageData.data.metadata.Version;
    let checkURL = !!newPackageData.data.data.URL;

    if (!packageId || !newPackageData.data.metadata || !newVersion) {
      return {
        statusCode: 400,
        body: JSON.stringify(ERROR_TYPES.INVALID_REQUEST)
      };
    }

    const getPackage = await getPackageById(packageId);

    if (!getPackage) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Package does not exist.'
        })
      };
    }
    let unitem = getPackage;

    const prevName = unitem.Name;
    const prevVersion = unitem.Version;
    // const prevURLCheck = unitem.URL;

    // let checkURL = false;

    // if (prevURLCheck){
    //   checkURL = true;
    // }

    //make sure new package is same name, different version, and same upload type

    if (prevName != newPackageData.data.metadata.Name || prevVersion == newVersion) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Package does not exist.'
        })
      };
    }

    //check all other package versions if we can upload.
    const canUpload = await validatePatchVersion(prevName, newVersion, checkURL);

    if (!canUpload) {
      return {
        statusCode: 400,
        body: JSON.stringify({ description: 'There is missing field(s) in the PackageID or it is formed improperly, or is invalid.' })
      };
    }
    const packageInfo = newPackageData.data;

    const metadata = {
      Name: packageInfo.metadata.Name,
      Version: packageInfo.metadata.Version,
      ID: packageInfo.metadata.ID
    };

    // Store package content and metadata
    // ... (rest of your existing code)

    const exists = await checkPackageExists(metadata.Name, metadata.Version);
    if (exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'There is missing field(s) in the PackageID or it is formed improperly, or is invalid.' })
      };
    }

    let isZip = false;
    if (!checkURL){
      isZip = true;
    }   

    //create separate for content
    const result = await downloadAndStorePackage(packageInfo.data.URL || "", packageInfo.data.Content || "", metadata.ID, isZip);

    // Store metadata in DynamoDB
    // await storePackageMetadata(metadata, data.data, s3Key);
    await storePackageMetadata(metadata, { ...packageInfo.data, URL: packageInfo.data.URL || "" }, result.s3Key);
    return {
      statusCode: 201,
      body: JSON.stringify( {
        message: "Version is updated."
      })
    };

  } catch (error) {
    console.error('Error processing package upload:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: (error as Error).message 
      })
    };
  }
}