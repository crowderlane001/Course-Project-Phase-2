import { clone } from 'isomorphic-git';
import * as fs from 'fs';
import http from 'isomorphic-git/http/node';
import * as path from 'path';

import { hasLicenseHeading, writeFile } from ".././utils/utils";

export const calcLicenseScore = async (repoUrl: string, localDir: string): Promise<number> => {

    await clone({
        fs,
        http,
        dir: localDir,
        url: repoUrl,
        singleBranch: true,
        depth: 1,
        
    });
  
    const licenseFilePath = `${localDir}/LICENSE`;
    const readmeFilePath = `${localDir}/README.md`;
    const packageJsonPath = `${localDir}/package.json`;

    if (fs.existsSync(licenseFilePath)) {
        return 1;
    }
  
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.license) {
            return 1;
        }
    }

    if (fs.existsSync(readmeFilePath)) {
        const readmeText = fs.readFileSync(readmeFilePath, 'utf8');
        return hasLicenseHeading(readmeText) ? 1 : 0;
    }
  
    return 0;
};

export async function calcLicense(owner: string, repo: string, repoURL: string): Promise<number> {
    const localDir = path.join("./repos", `${owner}_${repo}`);
    const license = await calcLicenseScore(repoURL, localDir);

    return license;
}
