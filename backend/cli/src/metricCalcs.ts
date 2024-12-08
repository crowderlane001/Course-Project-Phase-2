// This file contains the metric calculation functions for the ratePackage function.

import { ApiResponse, GraphQLResponse } from './types';
import { runWorker } from './indexSRC';
import { Metrics, WorkerResult } from './types'
import { clone } from 'isomorphic-git';
import * as fs from 'fs';
import http from 'isomorphic-git/http/node';
import * as path from 'path';

const listAllFoldersInTmp = (dir: string): void => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const directories = items.filter(item => item.isDirectory()).map(item => item.name);
    console.log("Folders in /tmp:");
    directories.forEach(folder => {
        console.log(folder);
    });
};

export const cloner = async (repoUrl: string, repo: string): Promise<null> => {
    const tmpDir = '/tmp';
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
    }
    listAllFoldersInTmp(tmpDir);

    const fullPath = path.join(tmpDir, repo);  // Combine /tmp with the provided localDir

    try {
        // Check if the directory exists (do not delete or alter contents)
        const dirExists = fs.existsSync(fullPath);
        
        // If the directory exists, skip cloning
        if (dirExists) {
            console.log(`Directory ${fullPath} already exists. Skipping clone.`);
            return null; // Skip cloning if directory already exists
        }

        // Clone the repository into the local directory
        await clone({
            fs,
            http,
            dir: fullPath,
            url: repoUrl,
            singleBranch: true,
            depth: 1
        });
        listAllFoldersInTmp(tmpDir);
        
        console.log(`Repository cloned into ${fullPath}`);
    } catch (err) {
        console.error(`Error handling the repository at ${fullPath}:`, err);
    }

    return null;
}

// Modifying the calculateMetrics function to include the new metrics
export async function calculateMetrics(owner: string, repo: string, token: string, repoURL: string, repoData: ApiResponse<GraphQLResponse | null>, inputURL: string): Promise<Metrics | null> {
    await cloner(repoURL, repo);

    const busFactorWorker = runWorker(owner, repo, token, repoURL, repoData, "busFactor");
    const correctnessWorker = runWorker(owner, repo, token, repoURL, repoData, "correctness");
    const rampUpWorker = runWorker(owner, repo, token, repoURL, repoData, "rampUp");
    const responsivenessWorker = runWorker(owner, repo, token, repoURL, repoData, "responsiveness");
    const licenseWorker = runWorker(owner, repo, token, repoURL, repoData, "license"); // needs repoURL
    const pinnedDepsWorker = runWorker(owner, repo, token, repoURL, repoData, "pinnedDeps"); // needs repoURL
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
        BusFactor: busFactor,
        BusFactorLatency: busFactorLatency,
        Correctness: correctness,
        CorrectnessLatency: correctnessLatency,
        RampUp: rampUp,
        RampUpLatency: rampUpLatency,
        ResponsiveMaintainer: responsiveness,
        ResponsiveMaintainerLatency: responsivenessLatency,
        LicenseScore: license,
        LicenseScoreLatency: licenseLatency,
        GoodPinningPractice: pinnedDeps,
        GoodPinningPracticeLatency: pinnedDepsLatency,  // New metric
        PullRequest: reviewedCode,       // New metric
        PullRequestLatency: reviewedCodeLatency,
        NetScore: netScore,
        NetScoreLatency: netScore_Latency
    };

    return metrics;
}
