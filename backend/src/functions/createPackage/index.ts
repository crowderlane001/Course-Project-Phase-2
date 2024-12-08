//Default index file containing handler for post /package endpoint. This creates a new package in the registry.

import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, GetItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Buffer } from 'buffer';
const unzipper = require('unzipper');

import axios from 'axios';
/*
Take in zip. check if package.json to get name, metadata

take in url, use api to get metadata
*/
// Schema Definitions

const PackageDataSchema = z.object({
  Name: z.string(),
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
const JWT_SECRET = '1b7e4f8a9c2d1e6m3k5p9q8r7t2y4x6zew';

// Initialize AWS clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});

// Helper function to check if package exists
async function checkPackageExists(name: string, version: string): Promise<boolean> {
  try {
    const response = await dynamoClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        'Name': { S: name },      // Using 'Name' instead of 'name' to match table schema
        'Version': { S: version } // Using 'Version' instead of 'version' to match table schema
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
async function fetchNpmPackageInfo(url: string): Promise<{ name: string; version: string; URL: string}> {
  //name in url
  const packageName = url.split('/').pop();
  if (!packageName) {
    throw new Error('Could not extract package name from URL');
  }

  const npmApiUrl = `https://registry.npmjs.org/${packageName}`;
  const response = await axios.get(npmApiUrl);
  
  return {
    name: response.data.name || packageName,
    version: response.data['dist-tags']?.latest || '1.0.0',
    URL: url
  };
}

// Helper function to fetch package info from GitHub
async function fetchGithubPackageInfo(url: string): Promise<{ name: string; version: string; URL:string }> {
  const repoPath = url.split('github.com/')[1];
  if (!repoPath) {
    throw new Error('Could not extract repository path from URL');
  }

  // Remove .git from the end if present
  const cleanRepoPath = repoPath.replace(/\.git$/, '');
  
  const githubNameApiUrl = `https://api.github.com/repos/${cleanRepoPath}`;
  const githubVerApiUrl = `https://api.github.com/repos/${cleanRepoPath}/releases`;

  const [nameResponse, versionResponse] = await Promise.all([
    axios.get(githubNameApiUrl),
    axios.get(githubVerApiUrl)
  ]);

  const name = nameResponse.data.name;
  let version = '1.0.0';

  if (Array.isArray(versionResponse.data) && versionResponse.data.length > 0) {
    // Remove 'v' prefix if present and validate version format
    version = versionResponse.data[0].tag_name.replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      version = '1.0.0';
    }
  }
  const URL = url;

  return { name, version, URL };
}


  // const tmpDir = '/tmp';
  // const zipPath = path.join(tmpDir, `${packageId}.zip`);

  async function readPackageFromZip(zipBuffer: Buffer): Promise<{ name: string; version: string; URL: string }> {
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
      let URL = packageJson.repository?.url || "";

      if (URL.startsWith("git://")) {
        URL = URL.replace("git://", "https://");
      } else if (URL.startsWith("git+https://")) {
        URL = URL.replace("git+https://", "https://");
      }
  
      return { name, version, URL};
    } catch (error) {
      throw new Error(`Failed to read package.json: ${(error as Error).message}`);
    }
  }

  async function downloadAndStorePackage(url: string, content: string, packageId: string, isZip: boolean): Promise<{s3Key: string, base64Content: string}> {
    console.log('Starting downloadAndStorePackage with:', {
        url,
        packageId,
        isZip,
        contentLength: content?.length || 0
    });

    try {
        let downloadUrl: string;
        let packageData: Buffer;
        let base64Content: string;

        if (isZip) {
            console.log('Processing pre-uploaded zip content');
            base64Content = content;
            packageData = Buffer.from(content, 'base64');
            console.log('Successfully decoded base64 zip content, size:', packageData.length);
        }
        else {
            if (url.includes('npmjs.com')) {
                console.log('Processing NPM package');
                const packageName = url.split('/package/')[1];
                console.log('Extracted package name:', packageName);

                if (!packageName) {
                    console.error('Package name extraction failed for URL:', url);
                    throw new Error('Invalid NPM URL format');
                }

                console.log('Fetching package metadata from NPM registry for:', packageName);
                const registryResponse = await axios.get(
                    `https://registry.npmjs.org/${packageName}`
                );
                console.log('NPM registry response received, status:', registryResponse.status);

                const latestVersion = registryResponse.data['dist-tags'].latest;
                downloadUrl = registryResponse.data.versions[latestVersion].dist.tarball;
                console.log('Latest version:', latestVersion);
                console.log('Download URL:', downloadUrl);

                console.log('Downloading tarball...');
                const response = await axios({
                    method: 'get',
                    url: downloadUrl,
                    responseType: 'arraybuffer',
                    headers: {
                        'Accept': 'application/x-gzip',
                        'User-Agent': 'AWS-Lambda'
                    }
                });
                console.log('Tarball download complete, status:', response.status);

                packageData = Buffer.from(response.data);
                base64Content = packageData.toString('base64');
                console.log('Package data size:', packageData.length);
                console.log('Base64 content length:', base64Content.length);

            } else if (url.includes('github.com')) {
                console.log('Processing GitHub repository');
                downloadUrl = url.replace('github.com', 'api.github.com/repos')
                                .replace(/\.git$/, '')
                                + '/zipball';
                console.log('GitHub API URL:', downloadUrl);

                console.log('Downloading GitHub repository...');
                const response = await axios({
                    method: 'get',
                    url: downloadUrl,
                    responseType: 'arraybuffer',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'AWS-Lambda'
                    }
                });
                console.log('GitHub download complete, status:', response.status);

                packageData = Buffer.from(response.data);
                base64Content = packageData.toString('base64');
                console.log('Package data size:', packageData.length);
                console.log('Base64 content length:', base64Content.length);

            } else {
                console.error('Unsupported URL format:', url);
                throw new Error('Unsupported package source URL');
            }
        }

        const fileExtension = url.includes('npmjs.com') ? 'tgz' : 'zip';
        const s3Key = `${packageId}.${fileExtension}`;
        console.log('Generated S3 key:', s3Key);

        console.log('Initiating S3 upload...');
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: packageData,
            ContentType: url.includes('npmjs.com') ? 'application/gzip' : 'application/zip',
            Metadata: {
                'source-url': url
            }
        }));
        console.log('S3 upload complete for key:', s3Key);

        return {
            s3Key,
            base64Content
        };

    } catch (error) {
        console.error('Error in downloadAndStorePackage:', {
            error: error as Error,
            message: (error as Error).message,
            stack: (error as Error).stack,
            url,
            packageId,
            isZip
        });

        if (axios.isAxiosError(error)) {
            console.error('Axios error details:', {
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
            });
        }

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

  // const token = event.headers['X-Authorization']?.split(' ')[1];

  // if (!token) {
  //   return {
  //     statusCode: 403,
  //     body: JSON.stringify({ message: 'Authentication failed due to invalid or missing AuthenticationToken.' }),
  //   };
  // }

  // try {
  //   // Verify the JWT
  //   const decoded = jwt.verify(token, JWT_SECRET);

  //   console.log('Token is valid:', decoded);
  // } catch (err) {
  //   console.error('Token verification failed:', err);

  //   return {
  //     statusCode: 403,
  //     body: JSON.stringify({ message: 'Authentication failed due to invalid or missing AuthenticationToken.' }),
  //   };
  // }

  
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ description: 'There is missing field(s) in the PackageData or it is formed improperly (e.g. Content and URL ar both set)' })
      };
    }

    const body = JSON.parse(event.body);
    const data = PackageDataSchema.safeParse(body);

    console.log('~~~~~~~~~~~~~~~~~~~~~~~Data~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    console.log(data.data);


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
      console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~URL~~~~~~~~~~~~~~~~~~~~');
      console.log(url);
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
      //get package.json infromatio
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
      Name: data.data.Name,
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
      url = packageInfo.URL;
    }   

    //create separate for content
    const result = await downloadAndStorePackage(url, content, metadata.ID, isZip);

    // Store metadata in DynamoDB
    // await storePackageMetadata(metadata, data.data, s3Key);
    await storePackageMetadata(metadata, { ...data.data, URL: url || "" }, result.s3Key);

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
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from your frontend
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Allow HTTP methods
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization", // Allow headers
      },
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