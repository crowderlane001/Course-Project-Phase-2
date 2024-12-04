#!/bin/bash

# Define the output zip file name
ZIP_FILE="ratePackage.zip"

tsc
npm install

# Create a zip archive, excluding .ts files and package-lock.json
zip -r "$ZIP_FILE" zip index.js node_modules/ */

echo "Files zipped successfully into $ZIP_FILE, ignoring .ts files, package-lock.json, and zipper.sh."
