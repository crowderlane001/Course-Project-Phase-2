import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, GetItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';

import { Buffer } from 'buffer';
const unzipper = require('unzipper');

import axios from 'axios';
/*
Take in zip. check if package.json to get name, metadata

take in url, use api to get metadata
*/
// Schema Definitions
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

// const PackageSchema = z.object({
//   metadata: PackageMetadataSchema,
//   data: PackageDataSchema,
// });

const BUCKET_NAME = "storage-phase-2";
const TABLE_NAME = "PackageRegistry";

// Initialize AWS clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});

// Helper function to check if package exists
async function checkPackageExists(name: string, version: string): Promise<boolean> {
  try {
    const response = await dynamoClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        'name': { S: name },
        'version': {S: version}
      }
    }));
    return !!response.Item;
  } catch (error) {
    console.error('Error checking package existence:', error);
    return false;
  }
}

// Helper function to generate package ID
function generatePackageId(name: string, version: string): string {
  if (!name || !version) {
    throw new Error(`Invalid package name or version. Name: ${name}, Version: ${version}`);
  }
  return `${name.toLowerCase()}-${version}`.replace(/[^a-z0-9-]/g, '-');
}

// Helper function to fetch package info from npm
async function fetchNpmPackageInfo(url: string): Promise<{ name: string; version: string }> {
  //name in url
  const packageName = url.split('/').pop();
  if (!packageName) {
    throw new Error('Could not extract package name from URL');
  }

  const npmApiUrl = `https://registry.npmjs.org/${packageName}`;
  const response = await axios.get(npmApiUrl);
  
  return {
    name: response.data.name || packageName,
    version: response.data['dist-tags']?.latest || '1.0.0'
  };
}

// Helper function to fetch package info from GitHub
async function fetchGithubPackageInfo(url: string): Promise<{ name: string; version: string }> {
  const repoPath = url.split('github.com/')[1];
  if (!repoPath) {
    throw new Error('Could not extract repository path from URL');
  }

  // Remove .git from the end if present
  const cleanRepoPath = repoPath.replace(/\.git$/, '');
  
  const githubNameApiUrl = `https://api.github.com/repos/${cleanRepoPath}`;
  const githubVerApiUrl = `https://api.github.com/repos/${cleanRepoPath}/tags`;

  const [nameResponse, versionResponse] = await Promise.all([
    axios.get(githubNameApiUrl),
    axios.get(githubVerApiUrl)
  ]);

  const name = nameResponse.data.name;
  let version = '1.0.0';

  if (Array.isArray(versionResponse.data) && versionResponse.data.length > 0) {
    // Remove 'v' prefix if present and validate version format
    version = versionResponse.data[0].name.replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      version = '1.0.0';
    }
  }

  return { name, version };
}


// Helper function to store package content in S3
async function storePackageContent(id: string, content: string): Promise<string> {
  const key = `packages/${id}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: Buffer.from(content, 'base64'),
    ContentType: 'application/zip'
  }));
  return key;
}
  // const tmpDir = '/tmp';
  // const zipPath = path.join(tmpDir, `${packageId}.zip`);

  async function readPackageFromZip(zipBuffer: Buffer): Promise<{ name: string; version: string }> {
    try {
      console.log('Zip buffer length:', zipBuffer.length);
      const directory = await unzipper.Open.buffer(zipBuffer);
      console.log('Files in zip:');
      // Find package.json in the zip
      const packageJsonFile = directory.files.find((file: { path: string }) => {
        // Handle both root level and nested package.json
        return file.path.endsWith('package.json') && !file.path.includes('node_modules');
      });
  
      if (!packageJsonFile) {
        throw new Error('package.json not found in zip file');
      }
  
      // Read and parse package.json
      const content = await packageJsonFile.buffer();
      console.log('package.json content:', content.toString());
      const packageJson = JSON.parse(content.toString());
  
      if (!packageJson.name || !packageJson.version) {
        throw new Error('Invalid package.json: missing name or version');
      }

      const name = packageJson.name;
      const version = packageJson.version;
  
      return { name, version };
    } catch (error) {
      throw new Error(`Failed to read package.json: ${(error as Error).message}`);
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
      item['jsProgram'] = { S: data.JSProgram };
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

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ description: 'There1 is missing field(s) in the PackageData or it is formed improperly (e.g. Content and URL ar both set)' })
      };
    }

    const body = JSON.parse(event.body);
    const data = PackageDataSchema.safeParse(body);

    if (!data.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ description: 'There2 is missing field(s) in the PackageData or it is formed improperly (e.g. Content and URL ar both set)' })
      };
    }

    let content = ""
    let url = ""
    if (data.data.URL){
      url = data.data.URL;
    }
    else if (data.data.Content){
      content = data.data.Content;
    }


    if ((!url && !content) || (url && content)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ description: 'There2 is missing field(s) in the PackageData or it is formed improperly (e.g. Content and URL ar both set)' })
      };
    }

    let packageInfo;
    if (url){
      try {
        if (url.includes('npm')) {
          packageInfo = await fetchNpmPackageInfo(url);
        } else if (url.includes('github.com')) {
          packageInfo = await fetchGithubPackageInfo(url);
        } else {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid URL. Must be from npm or GitHub' })
          };
        }
      } catch (error) {
        console.error('Error fetching package info:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            error: 'Failed to fetch package information',
            details: (error as Error).message 
          })
        };
      }
    }
    else{
      //get package.json infromatioin, 
      const zipBuffer = Buffer.from(content, 'base64');
      packageInfo = await readPackageFromZip(zipBuffer);
    }

    if (!packageInfo || !packageInfo.name) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not determine package name' })
      };
    }

    const metadata = {
      Name: packageInfo.name,
      Version: packageInfo.version,
      ID: randomUUID()
      // ID: generatePackageId(packageInfo.name, packageInfo.version)
    };

    // Store package content and metadata
    // ... (rest of your existing code)

    const exists = await checkPackageExists(metadata.Name, metadata.Version);
    if (exists) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Package already exists' })
      };
    }

    let isZip = false;
    if (!url){
      isZip = true;
    }   

    //create separate for content
    const result = await downloadAndStorePackage(url, content, metadata.ID, isZip);

    // Store metadata in DynamoDB
    // await storePackageMetadata(metadata, data.data, s3Key);
    await storePackageMetadata(metadata, { ...data.data, URL: data.data.URL || "" }, result.s3Key);

    let responseBody: any = {
      metadata,
      data: {
        Content: result.base64Content,
        JSProgram: data.data.JSProgram,
        debloat: data.data.debloat
      }
    };

    if (url) {
      responseBody.data.URL = url;
    }

    return {
      statusCode: 201,
      body: JSON.stringify(responseBody)
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