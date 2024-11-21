import { ApiResponse, GraphQLResponse } from './types';
import { runWorker } from './index';
import { Metrics, WorkerResult } from './types'
import { clone } from 'isomorphic-git';
import * as fs from 'fs';
import http from 'isomorphic-git/http/node';
import * as path from 'path';


export const cloner = async (repoUrl: string, localDir: string): Promise<null> => {
    await clone({
        fs,
        http,
        dir: localDir,
        url: repoUrl,
        singleBranch: true,
        depth: 1,
        
    });

    return null;
}

// Modifying the calculateMetrics function to include the new metrics
export async function calculateMetrics(owner: string, repo: string, token: string, repoURL: string, repoData: ApiResponse<GraphQLResponse | null>, inputURL: string): Promise<Metrics | null> {
    await cloner(repoURL, path.join('/tmp'));
    
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
