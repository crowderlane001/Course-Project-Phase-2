import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as unzipper from "unzipper";
import * as jwt from 'jsonwebtoken';

const s3Client = new S3Client({});
const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = "PackageRegistry";
const BUCKET_NAME = "storage-phase-2";
const JWT_SECRET = '1b7e4f8a9c2d1e6m3k5p9q8r7t2y4x6zew';

interface PackageItem {
  ID: string;
  Name: string;
  Version: string;
  s3Key: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
}

interface CostResult {
  [packageId: string]: {
    standaloneCost?: number;
    totalCost: number;
  }
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

const calculateDependenciesSizeRecursive = async (
  packageItem: PackageItem, 
  visitedPackages = new Set<string>(),
  costMap: CostResult = {}
): Promise<CostResult> => {
  try {
    // Create unique key for cycle detection
    const packageKey = `${packageItem.Name}@${packageItem.Version}`;
    if (visitedPackages.has(packageKey)) {
      console.log(`[CALC] Skipping circular dependency: ${packageKey}`);
      return costMap;
    }
    visitedPackages.add(packageKey);

    // Calculate standalone size
    const standaloneSize = await getPackageSize(packageItem.s3Key);
    console.log(`[CALC] Base package ${packageKey} (${packageItem.ID}) size: ${standaloneSize} MB`);
    
    // Initialize cost map entry
    costMap[packageItem.ID] = {
      standaloneCost: standaloneSize,
      totalCost: standaloneSize
    };

    // Get and process dependencies
    const packageJson = await extractPackageJson(packageItem.s3Key);
    if (!packageJson?.dependencies) {
      console.log('[CALC] No dependencies found in package.json');
      return costMap;
    }

    console.log("[CALC] Processing dependencies for:", packageKey);
    
    // Process each dependency recursively
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      const depKey = `${name}@${version}`;
      console.log(`\n[CALC] Processing dependency: ${depKey}`);
      
      const dep = await getPackageByNameAndVersion(name, version);
      if (dep) {
        // Recursively calculate costs for this dependency and its dependencies
        const depCosts = await calculateDependenciesSizeRecursive(dep, visitedPackages, costMap);
        
        // Add dependency's total cost to current package's total
        if (depCosts[dep.ID]) {
          costMap[packageItem.ID].totalCost += depCosts[dep.ID].totalCost;
          console.log(`[CALC] Added dependency ${depKey} cost (${depCosts[dep.ID].totalCost} MB) to ${packageKey}`);
        }
      } else {
        console.log(`[CALC] Dependency not available in registry: ${depKey}`);
      }
    }

    // Round final costs
    costMap[packageItem.ID].totalCost = Number(costMap[packageItem.ID].totalCost.toFixed(3));
    costMap[packageItem.ID].standaloneCost = Number(costMap[packageItem.ID].standaloneCost?.toFixed(3));

    console.log(`[CALC] Final costs for ${packageKey}:`, costMap[packageItem.ID]);
    return costMap;
  } catch (error: unknown) {
    console.error("[CALC] Error calculating dependencies size:", error);
    return costMap;
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

    // Handle dependencies if requested
    if (includeDependencies) {
      const costResults = await calculateDependenciesSizeRecursive(packageItem);
      console.log("[HANDLER] Final costs:", costResults);
      
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(costResults)
      };
    }

    // Without dependency parameter, just return totalCost for requested package
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
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