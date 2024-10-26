const { parentPort } = require('worker_threads');
const { logToFile } = require('./log');
const { calcBusFactor, calcCorrectness, calcResponsiveness, calcLicense, calcRampUp, calcPinnedDependencies, calcReviewedCode } = require('../metricCalcs');


// Worker function that computes something
interface WorkerParams {
    owner: string;
    repo: string;
    token: string;
    repoURL: string;
    repoData: any;
    metric: string;
}

interface WorkerResult {
    score: any;
    latency: number;
}

parentPort?.on('message', async (params: WorkerParams) => {
    const begin = Date.now();

    // PARSE PARAMETERS
    const { owner, repo, token, repoURL, repoData, metric } = params;
    logToFile(`Worker: ${owner}, ${repo}, ${repoURL}, ${metric}`, 2);
    
    // COMPUTE SOMETHING
    let result: any;
    if (metric == "busFactor") {
        result = await calcBusFactor(owner, repo, token);
    } else if (metric == "correctness") {
        result = calcCorrectness(repoData);
    } else if (metric == "rampUp") {
        result = await calcRampUp(repoData);
    } else if (metric == "responsiveness") {
        result = calcResponsiveness(repoData);
    } else if (metric == "license") { // license
        result = await calcLicense(owner, repo, repoURL);
    } else if (metric == "pinnedDeps") { // license
        result = await calcPinnedDependencies(owner, repo, repoURL);
    } else if (metric == "reviewedCode") { // license
        result = await calcReviewedCode(repoData);
    }

    const end = Date.now();
    // RETURN SOMETHING
    const workerResult: WorkerResult = {
        score: result,
        latency: (end - begin) / 1000 // in seconds
    };
    parentPort?.postMessage(workerResult);
});