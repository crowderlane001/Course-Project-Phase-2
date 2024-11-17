import * as fs from 'fs';
import * as path from 'path';

// Function to read a file and convert it to Base64
function encodeFileToBase64(filePath: string): string {
    // Read the file into a buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Convert the buffer to Base64
    const base64Data = fileBuffer.toString('base64');

    return base64Data;
}

// Main function to handle input and output
function main() {
    // Specify the path to the ZIP file
    const zipFilePath = path.resolve(__dirname, 'packageTest-main.zip'); // Change 'example.zip' to your ZIP file's name

    try {
        // Check if the file exists
        if (!fs.existsSync(zipFilePath)) {
            console.error(`File not found: ${zipFilePath}`);
            return;
        }

        // Encode the file to Base64
        const base64Encoded = encodeFileToBase64(zipFilePath);

        // Print the Base64 string
        console.log('Base64 Encoding of the ZIP file:');
        console.log(base64Encoded);
    } catch (error) {
        console.error('Error encoding file:');
    }
}

main();
