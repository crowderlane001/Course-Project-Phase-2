import * as fs from 'fs';
import { ApiResponse, GraphQLResponse } from './types';
import { runWorker } from './index';
import { Metrics } from './types'
import * as path from 'path';
import { logToFile } from './utils/log';

export async function calcPinnedDependencies(owner: string, repo: string, token: string): Promise<number> {
    const packageJsonPath = path.join("./repos", `${owner}_${repo}`, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        logToFile(`Error: package.json not found for ${owner}/${repo}`, 1);
        return 1.0; // No dependencies, so return 1.0
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const totalDependencies = Object.keys(dependencies).length;
    if (totalDependencies === 0) {
        logToFile(`Error: No dependencies found in ${owner}/${repo} package.json`, 1);
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


export async function calcReviewedCode (repoData: ApiResponse<GraphQLResponse | null>): Promise<number> {
    const pullRequests = repoData.data?.data.repository.pullRequests.nodes|| [];
    
    let totalPRs = 0;
    let reviewedPRs = 0;

    for (const pr of pullRequests) {
        totalPRs++;
        //What is going on here. The types don't match at
        console.log(pr.updatedAt);
        // if (pr.reviews?.totalCount > 0) {
        //     reviewedPRs++;
        // }
    }

    if (totalPRs === 0) {
        logToFile(`Error: No pull requests found in`, 1);
        return 1.0; // No PRs, return full score
    }

    console.log(`Reviewed PRs: ${reviewedPRs}, Total PRs: ${totalPRs}`);
    return reviewedPRs / totalPRs;
};


// Modifying the calculateMetrics function to include the new metrics
export async function calculateMetrics(owner: string, repo: string, token: string, repoURL: string, repoData: ApiResponse<GraphQLResponse | null>, inputURL: string): Promise<Metrics | null> {
    const busFactorWorker = runWorker(owner, repo, token, repoURL, repoData, "busFactor");
    const correctnessWorker = runWorker(owner, repo, token, repoURL, repoData, "correctness");
    const rampUpWorker = runWorker(owner, repo, token, repoURL, repoData, "rampUp");
    const responsivenessWorker = runWorker(owner, repo, token, repoURL, repoData, "responsiveness");
    const licenseWorker = runWorker(owner, repo, token, repoURL, repoData, "license");
    const pinnedDepsWorker = runWorker(owner, repo, token, repoURL, repoData, "pinnedDeps");
    const reviewedCodeWorker = runWorker(owner, repo, token, repoURL, repoData, "reviewedCode");

    const results = await Promise.all([busFactorWorker, correctnessWorker, rampUpWorker, responsivenessWorker, licenseWorker, pinnedDepsWorker, reviewedCodeWorker]);

    let busFactor = results[0].score;
    let correctness = results[1].score;
    let rampUp = results[2].score;
    let responsiveness = results[3].score;
    let license = results[4].score;
    let pinnedDeps = results[5].score;
    let reviewedCode = results[6].score;

    // calculate net score
    const begin = Date.now();
    const netScore = (busFactor*0.12) + (correctness*0.12) + (rampUp*0.12) + (responsiveness*0.3) + (license*0.12) + (pinnedDeps*0.12) + (reviewedCode*0.12);
    const end = Date.now();

    const metrics: Metrics = {
        URL: inputURL,
        NetScore: netScore,
        NetScore_Latency: (end - begin) / 1000,
        RampUp: rampUp,
        RampUp_Latency: results[2].latency,
        Correctness: correctness,
        Correctness_Latency: results[1].latency,
        BusFactor: busFactor,
        BusFactor_Latency: results[0].latency,
        ResponsiveMaintainer: responsiveness,
        ResponsiveMaintainer_Latency: results[3].latency,
        License: license,
        License_Latency: results[4].latency,
        PinnedDependencies: pinnedDeps,  // New metric
        PinnedDependencies_Latency: results[5].latency,
        ReviewedCode: reviewedCode,       // New metric
        ReviewedCode_Latency: results[6].latency
    };

    return metrics;
}
