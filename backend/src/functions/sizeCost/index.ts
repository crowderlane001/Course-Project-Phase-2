import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as unzipper from "unzipper";

const s3Client = new S3Client({});
const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = "PackageRegistry";
const BUCKET_NAME = "storage-phase-2";

interface PackageItem {
  ID: string;
  Name: string;
  Version: string;
  s3Key: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
}

const normalizeVersion = (version: string): string => {
  return version.replace(/[^\d.]/g, '');
};

const versionSatisfiesRange = (version: string, range: string): boolean => {
  console.log(`[VERSION] Checking if ${version} satisfies ${range}`);
  const cleanVersion = normalizeVersion(version);
  const cleanRange = range.replace(/[\^~]/, '');
  
  if (range.startsWith('^')) {
    const [vMajor] = cleanVersion.split('.');
    const [rMajor] = cleanRange.split('.');
    console.log(`[VERSION] Caret range: comparing major versions ${vMajor} === ${rMajor}`);
    return vMajor === rMajor;
  } 
  
  if (range.startsWith('~')) {
    const [vMajor, vMinor] = cleanVersion.split('.');
    const [rMajor, rMinor] = cleanRange.split('.');
    console.log(`[VERSION] Tilde range: comparing ${vMajor}.${vMinor} === ${rMajor}.${rMinor}`);
    return vMajor === rMajor && vMinor === rMinor;
  }
  
  console.log(`[VERSION] Exact match: comparing ${cleanVersion} === ${cleanRange}`);
  return cleanVersion === cleanRange;
};

const getPackageSize = async (s3Key: string): Promise<number> => {
  try {
    const key = s3Key.endsWith('.zip') ? s3Key : `${s3Key}.zip`;
    console.log("[SIZE] Getting size from S3 for key:", key);
    
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    const response = await s3Client.send(command);
    console.log("[SIZE] S3 response:", {
      contentLength: response.ContentLength,
      metaData: response.Metadata
    });

    if (!response.ContentLength) {
      console.log("[SIZE] No content length found for:", key);
      return 0;
    }

    // More precise size calculation - ensure we don't lose small files
    const mbSize = response.ContentLength / (1024 * 1024);
    const roundedSize = Number((Math.max(mbSize, 0.001)).toFixed(3));
    console.log(`[SIZE] Calculated size for ${key}: ${roundedSize} MB (${response.ContentLength} bytes)`);
    return roundedSize;
  } catch (error: unknown) {
    console.error("[SIZE] Error getting package size:", error);
    if (
      typeof error === 'object' && 
      error !== null && 
      'name' in error && 
      typeof (error as { name: string }).name === 'string'
    ) {
      const s3Error = error as { name: string };
      if (s3Error.name === 'NoSuchKey') {
        console.log("[SIZE] File not found in S3:", s3Key);
      }
    }
    return 0;
  }
};

const logRegistryState = async () => {
  try {
    const scanCommand = new ScanCommand({ TableName: TABLE_NAME });
    const result = await dynamoDb.send(scanCommand);
    console.log("[REGISTRY] Available packages:", 
      result.Items?.map(item => {
        const pkg = unmarshall(item);
        return `${pkg.Name}@${pkg.Version} (${pkg.ID})`;
      })
    );
  } catch (error: unknown) {
    console.error("[REGISTRY] Error scanning registry:", error);
  }
};

const getPackageByNameAndVersion = async (name: string, version: string): Promise<PackageItem | null> => {
  try {
    console.log(`[DB] Looking for package: ${name}@${version}`);
    
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "#n = :name",
      ExpressionAttributeNames: {
        "#n": "Name"
      },
      ExpressionAttributeValues: marshall({
        ":name": name
      })
    });

    const result = await dynamoDb.send(scanCommand);
    if (!result.Items || result.Items.length === 0) {
      console.log(`[DB] No versions found for package ${name}`);
      return null;
    }

    const items = result.Items.map(item => unmarshall(item) as PackageItem);
    console.log(`[DB] Found ${items.length} versions for ${name}:`, 
      items.map(i => `${i.Version} (ID: ${i.ID})`)
    );

    for (const item of items) {
      if (versionSatisfiesRange(item.Version, version)) {
        console.log(`[DB] Version ${item.Version} satisfies ${version}`);
        return item;
      }
    }

    console.log(`[DB] No matching version found for ${name}@${version}`);
    return null;
  } catch (error: unknown) {
    console.error("[DB] Error in getPackageByNameAndVersion:", error);
    return null;
  }
};

const getPackageById = async (id: string): Promise<PackageItem | null> => {
  try {
    console.log("[DB] Looking for package with ID:", id);
    
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "ID = :id",
      ExpressionAttributeValues: marshall({
        ":id": id
      })
    });

    const result = await dynamoDb.send(scanCommand);
    if (!result.Items || result.Items.length === 0) {
      console.log("[DB] Package not found with ID:", id);
      return null;
    }

    const pkg = unmarshall(result.Items[0]) as PackageItem;
    console.log("[DB] Found package:", `${pkg.Name}@${pkg.Version} (${pkg.ID})`);
    return pkg;
  } catch (error: unknown) {
    console.error("[DB] Error in getPackageById:", error);
    return null;
  }
};

const extractPackageJson = async (s3Key: string): Promise<PackageJson | null> => {
  try {
    const key = s3Key.endsWith('.zip') ? s3Key : `${s3Key}.zip`;
    console.log("[EXTRACT] Getting package.json from:", key);
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
      console.log("[EXTRACT] No response body");
      return null;
    }

    const streamToBuffer = async (stream: any): Promise<Buffer> => {
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    };

    const buffer = await streamToBuffer(response.Body);
    const directory = await unzipper.Open.buffer(buffer);
    const packageJsonFile = directory.files.find(f => 
      f.path.includes('package.json') && !f.path.includes('node_modules')
    );

    if (!packageJsonFile) {
      console.log("[EXTRACT] No package.json found");
      return null;
    }

    const content = await packageJsonFile.buffer();
    const packageJson = JSON.parse(content.toString());
    console.log("[EXTRACT] Found package.json with", packageJson.dependencies ? Object.keys(packageJson.dependencies).length : 0, "dependencies");
    return packageJson;
  } catch (error: unknown) {
    console.error("[EXTRACT] Error reading package.json:", error);
    return null;
  }
};

const calculateDependenciesSize = async (packageItem: PackageItem): Promise<number> => {
  try {
    await logRegistryState();

    let totalSize = await getPackageSize(packageItem.s3Key);
    console.log(`[CALC] Base package ${packageItem.Name}@${packageItem.Version} (${packageItem.ID}) size: ${totalSize} MB`);
    
    const packageJson = await extractPackageJson(packageItem.s3Key);
    if (!packageJson?.dependencies) {
      console.log('[CALC] No dependencies found in package.json');
      return totalSize;
    }

    console.log("[CALC] Found dependencies:", packageJson.dependencies);
    let foundDeps = 0;
    let missingDeps = 0;
    let depSizes = [];
    
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      const depKey = `${name}@${version}`;
      console.log(`\n[CALC] Processing dependency: ${depKey}`);
      
      const dep = await getPackageByNameAndVersion(name, version);
      if (dep) {
        foundDeps++;
        const depSize = await getPackageSize(dep.s3Key);
        console.log(`[CALC] Found dependency ${name}@${dep.Version} with size ${depSize} MB`);
        depSizes.push({ name, version: dep.Version, size: depSize });
        totalSize += depSize;
      } else {
        missingDeps++;
        console.log(`[CALC] Dependency not available in registry: ${depKey}`);
      }
    }

    console.log('\n[CALC] Dependencies summary:');
    console.log(`- Total dependencies found: ${foundDeps}`);
    console.log(`- Missing dependencies: ${missingDeps}`);
    console.log('- Dependency sizes:', depSizes);
    console.log(`- Final total size: ${totalSize} MB`);
    
    // Ensure total size is never less than standalone
    return Number((Math.max(totalSize, totalSize)).toFixed(3));
  } catch (error: unknown) {
    console.error("[CALC] Error calculating dependencies size:", error);
    return 0;
  }
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log("[HANDLER] Event received:", JSON.stringify(event, null, 2));
    
    const packageId = event.pathParameters?.id;
    const includeDependencies = event.queryStringParameters?.dependency === "true";

    if (!packageId || !/^[a-zA-Z0-9\-]+$/.test(packageId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "There is missing field(s) in the PackageID"
        })
      };
    }

    const packageItem = await getPackageById(packageId);
    if (!packageItem) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Package does not exist."
        })
      };
    }

    const standaloneSize = await getPackageSize(packageItem.s3Key);
    console.log("[HANDLER] Standalone size:", standaloneSize);

    // Use dependency parameter to control response format
    if (includeDependencies) {
      const totalSize = await calculateDependenciesSize(packageItem);
      console.log("[HANDLER] Final sizes:", {
        standalone: standaloneSize,
        total: Math.max(totalSize, standaloneSize)
      });
      
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "http://localhost:5173", // Allow requests from your frontend
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Allow HTTP methods
          "Access-Control-Allow-Headers": "Content-Type, Authorization", // Allow headers
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [packageId]: {
            standaloneCost: standaloneSize,
            totalCost: Math.max(totalSize, standaloneSize)
          }
        })
      };
    }

    // Without dependency parameter, just return totalCost
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173", // Allow requests from your frontend
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Allow HTTP methods
        "Access-Control-Allow-Headers": "Content-Type, Authorization", // Allow headers
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        [packageId]: {
          totalCost: standaloneSize
        }
      })
    };

  } catch (error: unknown) {
    console.error("[HANDLER] Unexpected error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "The package rating system encountered an error."
      })
    };
  }
};