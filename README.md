Project README

Overview

This project implements a RESTful API adhering to the OpenAPI Specification. It provides endpoints for managing, rating, uploading, downloading, and searching for packages. Designed for extensibility and security, the API includes:

Package ingestion from npm.

Features like version pinning and package rating.

ADA-compliant web interface.

Deployment and CI/CD integrations with AWS and GitHub Actions.

Security case analysis using ThreatModeler.

Features

Upload & Update Packages: Allows users to add new packages or update existing ones.

Search & Directory: Provides search capabilities and a package directory.

Rate & Download: Enables rating and downloading packages.

Version Pinning: Ensures version compatibility and stability.

Requirements

TypeScript

AWS SDK

GitHub Actions for CI/CD

npm (for package ingestion)

Installation

Clone the repository:

git clone https://github.com/yourusername/yourrepository.git

Navigate to the project directory:

cd yourrepository

Set up environment variables:

export GITHUB_TOKEN="insert_here"
export LOG_FILE="/tmp/checker.log"
export LOG_LEVEL=2

Usage

Deploy the application via GitHub Actions.

Access the API at:

https://med4k766h1.execute-api.us-east-1.amazonaws.com/prod

Access the Web UI at:

https://ece-461-team-9.github.io

Deployment

Ensure GitHub Actions is configured for deployment.

Push changes to the main branch to trigger a deployment pipeline.

Monitor the deployment via AWS Management Console.

Individual Deployment

Run zipper.sh in desired folder.

Upload new zip folder to aws lambda function.

Development

Run Tests:

npm test

Start Local Development:

npm run dev

Contributing

Fork the repository.

Create a feature branch.

Submit a pull request.

For additional details, consult the OpenAPI specification file (spec.yaml).
