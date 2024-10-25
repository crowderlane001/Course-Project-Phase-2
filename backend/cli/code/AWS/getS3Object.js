const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

exports.handler = async (event) => {
    console.log('Full event:', JSON.stringify(event, null, 2));

    // Handle both direct Lambda tests and API Gateway requests
    const bucketName = event.queryStringParameters ? event.queryStringParameters.bucketName : event.bucketName;
    const key = event.queryStringParameters ? event.queryStringParameters.key : event.key;

    console.log('bucketName:', bucketName);
    console.log('key:', key);

    const s3Client = new S3Client({ region: "us-east-1" });

    const params = {
        Bucket: bucketName,
        Key: key,
    };

    try {
        const data = await s3Client.send(new GetObjectCommand(params));
        console.log("File retrieved successfully");
        
        const bodyContents = await streamToString(data.Body);
        
        return {
            statusCode: 200,
            body: JSON.stringify(bodyContents),
        };
    } catch (error) {
        console.error("Error retrieving file:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error retrieving file", error: error.message }),
        };
    }
};

// Helper function to convert stream to string
const streamToString = (stream) =>  // Remove TypeScript-specific annotations
    new Promise((resolve, reject) => {
        const chunks = [];  // No need to specify array type in JavaScript
        stream.on("data", (chunk) => chunks.push(chunk));  // No chunk type annotation
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        stream.on("error", reject);
    });


