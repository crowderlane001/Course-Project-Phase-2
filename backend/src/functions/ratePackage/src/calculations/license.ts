import * as fs from 'fs';
import * as path from 'path';

import { hasLicenseHeading } from "../utils/utils";

// List of licenses compatible with GNU LGPL v2.1
const LGPLv21CompatibleLicenses = [
    "LGPL-2.1",
    "MIT",
    "Apache-2.0",
];

export const calcLicenseScore = async (repoUrl: string, localDir: string): Promise<number> => {
    // Print all folders in /tmp

    // Look for files with "license" in the name (case-insensitive)
    const licenseFiles = fs.readdirSync(localDir).filter((file) =>
        file.toLowerCase().includes("license")
    );

    // Check if any license file is compatible
    for (const licenseFile of licenseFiles) {
        const licenseFilePath = path.join(localDir, licenseFile);
        const licenseText = fs.readFileSync(licenseFilePath, 'utf8');
        const isCompatible = LGPLv21CompatibleLicenses.some((license) =>
            licenseText.includes(license)
        );
        if (isCompatible) {
            return 1.0;
        }
    }

    // Check package.json for license field
    const packageJsonPath = path.join(localDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.license) {
            const isCompatible = LGPLv21CompatibleLicenses.includes(packageJson.license);
            return isCompatible ? 1.0 : 0.0;
        }
    }

    // Check README for license information
    const readmeFilePath = path.join(localDir, "README.md");
    if (fs.existsSync(readmeFilePath)) {
        const readmeText = fs.readFileSync(readmeFilePath, 'utf8');
        if (hasLicenseHeading(readmeText)) {
            const isCompatible = LGPLv21CompatibleLicenses.some((license) =>
                readmeText.includes(license)
            );
            return isCompatible ? 1.0 : 0.0;
        }
    }

    // No compatible license found
    return 0.0;
};

export async function calcLicense(owner: string, repo: string, repoURL: string): Promise<number> {
    const localDir = path.join("/tmp", `${repo}`);
    const license = await calcLicenseScore(repoURL, localDir);

    return license;
}
