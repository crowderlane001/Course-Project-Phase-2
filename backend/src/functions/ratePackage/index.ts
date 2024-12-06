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

// PackageRating:
// description: |-
//   Package rating (cf. Project 1).

//   If the Project 1 that you inherited does not support one or more of the original properties, denote this with the value "-1".
// required:
// - RampUp
// - Correctness
// - BusFactor
// - ResponsiveMaintainer
// - LicenseScore
// - GoodPinningPractice
// - PullRequest
// - NetScore
// - RampUpLatency
// - CorrectnessLatency
// - BusFactorLatency
// - ResponsiveMaintainerLatency
// - LicenseScoreLatency
// - GoodPinningPracticeLatency
// - PullRequestLatency
// - NetScoreLatency
// type: object
// properties:
//   BusFactor:
//     format: double
//     description: ""
//     type: number
//   BusFactorLatency:
//     format: double
//     description: ""
//     type: number
//   Correctness:
//     format: double
//     description: ""
//     type: number
//   CorrectnessLatency:
//     format: double
//     description: ""
//     type: number
//   RampUp:
//     format: double
//     description: ""
//     type: number
//   RampUpLatency:
//     format: double
//     description: ""
//     type: number
//   ResponsiveMaintainer:
//     format: double
//     description: ""
//     type: number
//   ResponsiveMaintainerLatency:
//     format: double
//     description: ""
//     type: number
//   LicenseScore:
//     format: double
//     description: ""
//     type: number
//   LicenseScoreLatency:
//     format: double
//     description: ""
//     type: number
//   GoodPinningPractice:
//     format: double
//     description: "The fraction of its dependencies that are pinned to at least\
//       \ a specific major+minor version, e.g. version 2.3.X of a package. (If\
//       \ there are zero dependencies, they should receive a 1.0 rating. If there\
//       \ are two dependencies, one pinned to this degree, then they should receive\
//       \ a Â½ = 0.5 rating)."
//     type: number
//   GoodPinningPracticeLatency:
//     format: double
//     description: ""
//     type: number
//   PullRequest:
//     format: double
//     description: The fraction of project code that was introduced through pull
//       requests with a code review.
//     type: number
//   PullRequestLatency:
//     format: double
//     description: The fraction of project code that was introduced through pull
//       requests with a code review.
//     type: number
//   NetScore:
//     format: double
//     description: Scores calculated from other seven metrics.
//     type: number
//   NetScoreLatency:
//     format: double
//     description: Scores calculated from other seven metrics.
//     type: number

//id-index: global secondary index name
//ID: name of column in dynamodb
//id: name of packagequery parameter
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { main } from "./src/indexSRC";
import * as jwt from 'jsonwebtoken';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "PackageRegistry";
const GSI_NAME = "id-index";
const JWT_SECRET = '1b7e4f8a9c2d1e6m3k5p9q8r7t2y4x6zew';

// Custom error class for better error handling

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

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
    // Validate HTTP method

    // Validate path parameter for package ID
    const packageId = event.pathParameters?.id; // API input uses 'id' Note: must be path parameter since the id is specified in path
    if (!packageId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'There is missing field(s) in the PackageID' }),
      };
    }
    console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ID~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    console.log(packageId);

    // Query the package from DynamoDB using the GSI
    const { Items } = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI_NAME,
        KeyConditionExpression: "#ID = :id",
        ExpressionAttributeNames: {
          "#ID": "ID", // Map the GSI key
        },
        ExpressionAttributeValues: {
          ":id": packageId,
        },
      })
    );

    if (!Items || Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Package does not exist.' }),
      };
    }

    // var metrics = {
    //   RampUp: -1,
    //   Correctness: -1,
    //   BusFactor: -1,
    //   ResponsiveMaintainer: -1,
    //   LicenseScore: -1,
    //   GoodPinningPractice: -1,
    //   PullRequest: -1,
    //   NetScore: -1,
    //   RampUpLatency: -1,
    //   CorrectnessLatency: -1,
    //   BusFactorLatency: -1,
    //   ResponsiveMaintainerLatency: -1,
    //   LicenseScoreLatency: -1,
    //   GoodPinningPracticeLatency: -1,
    //   PullRequestLatency: -1,
    //   NetScoreLatency: -1,
    // };

    const item = Items[0]; // Assuming one record per ID
    if (!item.URL) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Package does not exist.' }),
      };
    }

    console.log(item.URL);

    const metrics = await main(item.URL);

    if (!metrics) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'The package rating system choked on at least one of the metrics.' }),
      };
    }

    console.log(metrics);

    console.log("Metrics calculated successfully");


    // Update the metrics in the DynamoDB table
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { Name: item.Name, Version: item.Version }, // Replace with actual primary key
        UpdateExpression: "SET #metrics = :metrics",
        ExpressionAttributeNames: {
          "#metrics": "metrics",
        },
        ExpressionAttributeValues: {
          ":metrics": metrics,
        }
      })
    );
    
    console.log("Metrics updated successfully");

    // Return a successful response with the package rating
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173", // Allow requests from your frontend
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Allow HTTP methods
        "Access-Control-Allow-Headers": "Content-Type, Authorization", // Allow headers
      },
      body: JSON.stringify(metrics),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error during bulk deletion',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};