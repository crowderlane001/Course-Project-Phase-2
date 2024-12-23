#!/bin/bash

# Define the output zip file name
ZIP_FILE="regex.zip"

tsc
npm install

# Create a zip archive, excluding .ts files and package-lock.json
zip -r "$ZIP_FILE" . -x "*.ts" -x "zipper.sh" -x "*.zip"

echo "Files zipped successfully into $ZIP_FILE, ignoring .ts files, package-lock.json, and zipper.sh."
