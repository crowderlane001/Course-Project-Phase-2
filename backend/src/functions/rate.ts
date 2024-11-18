/* Provides metrics for uploaded packages.

Schema:
/package/{id}/rate:
    get:
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PackageRating'
          description: Return the rating. Only use this if each metric was computed
            successfully.
        400:
          description: There is missing field(s) in the PackageID
        403:
          description: Authentication failed due to invalid or missing AuthenticationToken.
        404:
          description: Package does not exist.
        500:
          description: The package rating system choked on at least one of the metrics.
      operationId: PackageRate
      summary: "Get ratings for this package. (BASELINE)"
    parameters:
    - name: id
      schema:
        $ref: '#/components/schemas/PackageID'
      in: path
      required: true
    - name: X-Authorization
      description: ""
      schema:
        $ref: '#/components/schemas/AuthenticationToken'
      in: header
      required: true
*/
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "PackageRegistry";

// Custom error class for better error handling
class PackageRegistryError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PackageRegistryError";
    this.statusCode = statusCode;
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Validate HTTP method
    if (event.httpMethod !== "GET") {
      throw new PackageRegistryError("Method not allowed", 405);
    }

    // Validate path parameter for package ID
    const packageId = event.pathParameters?.id;
    if (!packageId) {
      throw new PackageRegistryError("Package ID is missing in the request", 400);
    }

    // Validate headers for X-Authorization
    const authToken = event.headers["X-Authorization"];
    if (!authToken) {
      throw new PackageRegistryError("Authentication failed: Missing AuthenticationToken", 403);
    }

    // Fetch the package from DynamoDB
    const { Item } = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: packageId },
      })
    );

    if (!Item) {
      throw new PackageRegistryError(`Package with ID '${packageId}' does not exist`, 404);
    }

    // Check if metrics are available for the package
    if (!Item.metrics || typeof Item.metrics.rating === "undefined") {
      throw new PackageRegistryError("The package was not rated", 500);
    }

    // Return a successful response with the package rating
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Package rating retrieved successfully",
        rating: Item.metrics.rating,
        details: Item.metrics,
      }),
    };
  } catch (error) {
    console.error("Error:", error);

    // Determine error response
    let statusCode = 500;
    let message = "Internal Server Error";

    if (error instanceof PackageRegistryError) {
      statusCode = error.statusCode;
      message = error.message;
    }

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: {
          message,
        },
      }),
    };
  }
};