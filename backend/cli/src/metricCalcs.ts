import { clone, checkout } from 'isomorphic-git';
import * as fs from 'fs';
import http from 'isomorphic-git/http/node';
import { ContributorResponse, ClosedIssueNode, PullRequestNode, OpenIssueNode } from "./types";
import { hasLicenseHeading, writeFile } from "./utils/utils";
import { fetchContributorActivity, fetchRepoData, getReadmeDetails, checkFolderExists } from "./api/githubApi";
import { ApiResponse, GraphQLResponse } from './types';
import { runWorker } from './index';
import { Metrics, WorkerResult } from './types'
import * as path from 'path';
import { logToFile } from './utils/log';
import { log } from 'console';


export const calcBusFactorScore = (contributorActivity: ContributorResponse[]): number => {
    if (!contributorActivity) {
        return 0;
    }

    let totalCommits = 0;
    let totalContributors = 0;
    for (const contributor of contributorActivity) {
        totalCommits += contributor.total
        ++totalContributors
    }

    const threshold = Math.ceil(totalCommits * 0.5); // 50% of commits

    let curr = 0;
    let busFactor = 0;

    // contributorActivity default sorting is least to greatest, so iterate R to L 
    for (let i = contributorActivity.length - 1; i >= 0; i--) {
        curr += contributorActivity[i].total;
        busFactor++;

        if (curr >= threshold) {
            break;
        }
    }

    const averageBusFactor = 3;
    // if bus factor is 10+, thats more than enough
    if (busFactor > 9) {
        return 1;
    }

    // scale bus factor values using sigmoid function
    return 1 - Math.exp(-(busFactor ** 2) / (2 * averageBusFactor ** 2));
}

export const calcCorrectnessScore = (totalOpenIssuesCount: number, totalClosedIssuesCount: number): number => {
    const totalIssues = totalOpenIssuesCount + totalClosedIssuesCount;
    if (totalIssues == 0) {
        return 1;
    }

    return totalClosedIssuesCount / totalIssues;
}

export const calcResponsivenessScore = (
    closedIssues: ClosedIssueNode[], 
    openIssues: OpenIssueNode[], 
    pullRequests: PullRequestNode[],
    sinceDate: Date,
    isArchived: boolean
): number => {
    if (isArchived) {
        // repo is no longer maintained
        return 0;
    }

    let openIssueCount = 0;
    let closedIssueCount = 0;
    let openPRCount = 0;
    let closedPRCount = 0;

    for (let i = 0; i < Math.max(pullRequests.length, openIssues.length, closedIssues.length); ++i) {
        if (i < pullRequests.length && new Date(pullRequests[i].createdAt) >= sinceDate && !pullRequests[i].closedAt) {
            openPRCount++;
        }
        if (i < pullRequests.length && new Date(pullRequests[i].createdAt) >= sinceDate && pullRequests[i].closedAt) {
            closedPRCount++;
        }
        if (i < openIssues.length && new Date(openIssues[i].createdAt) >= sinceDate) {
            openIssueCount++;
        }
        if (i < closedIssues.length && new Date(closedIssues[i].createdAt) >= sinceDate) {
            closedIssueCount++;
        }
    }

    const totalRecentIssues = openIssueCount + closedIssueCount;
    const totalRecentPRs = openPRCount + closedPRCount;

    const issueCloseRatio = totalRecentIssues > 0 
        ? closedIssueCount / totalRecentIssues 
        : 0;
    const prCloseRatio = totalRecentPRs > 0 
        ? closedPRCount / totalRecentPRs 
        : 0;
    
    return 0.5 * issueCloseRatio + 0.5 * prCloseRatio
};

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

export async function calcBusFactor(owner: string, repo: string, token: string): Promise<number> {
    let busFactor;
    const contributorActivity = await fetchContributorActivity(owner, repo, token);
    if (!contributorActivity?.data || !Array.isArray(contributorActivity.data)) {
        busFactor = -1
    } else {
        busFactor = calcBusFactorScore(contributorActivity.data);
    }

    return busFactor;
}

export function calcCorrectness(repoData: ApiResponse<GraphQLResponse | null>): number {
    const totalOpenIssues = repoData.data?.data.repository.openIssues;
    const totalClosedIssues = repoData.data?.data.repository.closedIssues;

    if (!totalOpenIssues || !totalClosedIssues) {
        return -1;
    }
    const correctness = calcCorrectnessScore(totalOpenIssues.totalCount, totalClosedIssues.totalCount);

    return correctness;
}

export function calcResponsiveness(repoData: ApiResponse<GraphQLResponse | null>): number {
    const recentPullRequests = repoData.data?.data.repository.pullRequests;
    const isArchived = repoData.data?.data.repository.isArchived;
    const totalOpenIssues = repoData.data?.data.repository.openIssues;
    const totalClosedIssues = repoData.data?.data.repository.closedIssues;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    if (!recentPullRequests?.nodes || !totalClosedIssues?.nodes || !totalOpenIssues?.nodes) {
        return -1;
    }
    const responsiveness = calcResponsivenessScore(totalClosedIssues.nodes, totalOpenIssues.nodes, recentPullRequests.nodes, oneMonthAgo, isArchived ?? false);

    return responsiveness;
}

export async function calcLicense(owner: string, repo: string, repoURL: string): Promise<number> {
    const localDir = path.join("./repos", `${owner}_${repo}`);
    const license = await calcLicenseScore(repoURL, localDir);

    return license;
}

export async function calcRampUp(repoData: ApiResponse<GraphQLResponse | null>): Promise<number> {
    const readmeKeys = [
        'READMEMD', 'READMENOEXT', 'READMETXT', 'READMERDOC', 'READMEHTML', 'READMEADOC', 
        'READMEMARKDOWN', 'READMEYAML', 'READMERST', 'READMETEXTILE', 'readmemd', 
        'readmenoext', 'readmetxt', 'readmerdoc', 'readmehtml', 'readmeadoc', 
        'readmemarkdown', 'readmeyaml', 'readmerst', 'readmetextile', 'readMemd', 
        'readMenoext', 'readMetxt', 'readMerdoc', 'readMehtml', 'readMeadoc', 
        'readMemarkdown', 'readMeyaml', 'readMerst', 'readMetextile', 'ReadMemd', 
        'ReadMenoext', 'ReadMetxt', 'ReadMerdoc', 'ReadMehtml', 'ReadMeadoc', 
        'ReadMemarkdown', 'ReadMeyaml', 'ReadMerst', 'ReadMetextile', 'Readmemd', 
        'Readmenoext', 'Readmetxt', 'Readmerdoc', 'Readmehtml', 'Readmeadoc', 
        'Readmemarkdown', 'Readmeyaml', 'Readmerst', 'Readmetextile'
    ];

    const examplesKeys = ['examplesFolder', 'exampleFolder', 'ExamplesFolder', 'ExampleFolder'];

    const repository = repoData.data?.data.repository;

    // Find the README content
    let readMe = readmeKeys.map(key => repository?.[key]).find(readme => readme?.text);

    // Find the examples folder
    let exFolder = examplesKeys.map(key => repository?.[key]).find(folder => folder != null);

    // Set rampUp value
    let rampUp = readMe?.text ? await getReadmeDetails(readMe.text, exFolder) : 0.9;

    return rampUp;
}

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
    const pullRequests = repoData.data?.data.repository.pullRequests.nodes || [];
    
    let totalPRs = 0;
    let reviewedPRs = 0;

    for (const pr of pullRequests) {
        totalPRs++;
        if (pr.reviews?.totalCount > 0) {
            reviewedPRs++;
        }
    }

    if (totalPRs === 0) {
        logToFile(`Error: No pull requests found in`, 1);
        return 1.0; // No PRs, return full score
    }

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

    // parse metric scores and latencies
    const busFactor = parseFloat(results[0].score.toFixed(3));
    const correctness = parseFloat(results[1].score.toFixed(3));
    const rampUp = parseFloat(results[2].score.toFixed(3));
    const responsiveness = parseFloat(results[3].score.toFixed(3));
    const license = parseFloat(results[4].score.toFixed(3));
    const pinnedDeps = parseFloat(results[5].score.toFixed(3));
    const reviewedCode = parseFloat(results[6].score.toFixed(3));

    const busFactorLatency = parseFloat(results[0].latency.toFixed(3));
    const correctnessLatency = parseFloat(results[1].latency.toFixed(3));
    const rampUpLatency = parseFloat(results[2].latency.toFixed(3));
    const responsivenessLatency = parseFloat(results[3].latency.toFixed(3));
    const licenseLatency = parseFloat(results[4].latency.toFixed(3));
    const pinnedDepsLatency = parseFloat(results[5].latency.toFixed(3));
    const reviewedCodeLatency = parseFloat(results[6].latency.toFixed(3));

    // calculate net score
    const begin = Date.now();
    const netScore = parseFloat(((busFactor*0.25) + (correctness*0.30) + (rampUp*0.20) + (responsiveness*0.15) + (license*0.10)).toFixed(3));
    const end = Date.now();
    const netScore_Latency = parseFloat(((end - begin) / 1000).toFixed(3))
    
    const metrics: Metrics = {
        URL: inputURL,
        NetScore: netScore,
        NetScore_Latency: netScore_Latency,
        RampUp: rampUp,
        RampUp_Latency: rampUpLatency,
        Correctness: correctness,
        Correctness_Latency: correctnessLatency,
        BusFactor: busFactor,
        BusFactor_Latency: busFactorLatency,
        ResponsiveMaintainer: responsiveness,
        ResponsiveMaintainer_Latency: responsivenessLatency,
        License: license,
        License_Latency: licenseLatency,
        PinnedDependencies: pinnedDeps,  // New metric
        PinnedDependencies_Latency: pinnedDepsLatency,
        ReviewedCode: reviewedCode,       // New metric
        ReviewedCode_Latency: reviewedCodeLatency
    };

    return metrics;
}
