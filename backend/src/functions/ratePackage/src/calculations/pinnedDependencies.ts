import * as fs from 'fs';
import * as path from 'path';

export async function calcPinnedDependencies(owner: string, repo: string, token: string): Promise<number> {
    const packageJsonPath = path.join("./repos", `${owner}_${repo}`, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        return 1.0; // No dependencies, so return 1.0
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const totalDependencies = Object.keys(dependencies).length;
    if (totalDependencies === 0) {
        return 1.0;
    }

    let pinnedCount = 0;
    for (const dep in dependencies) {
        const version = dependencies[dep];
        const majorMinorPattern = /^\d+\.\d+/; // Matches major.minor version (e.g., 2.3.X)
        if (majorMinorPattern.test(version)) {
            pinnedCount++;
        }
    }

    return pinnedCount / totalDependencies;
};