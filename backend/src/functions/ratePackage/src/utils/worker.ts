const { parentPort } = require('worker_threads');
const { calcBusFactor, calcCorrectness, calcLicense, calcPinnedDependencies, calcRampUp, calcReviewedCode, calcResponsiveness} = require('../imports');
import { GraphQLResponse } from './../types';

// Define the structure of params
interface Params {
    owner: string;
    repo: string;
    token: string;
    repoURL: string;
    repoData: GraphQLResponse; // Replace with a more specific type if available
    metric: string;
}

// Worker function that computes something
parentPort?.on('message', async (params: Params) => {
    const begin = Date.now();

    // PARSE PARAMETERS
    const { owner, repo, token, repoURL, repoData, metric } = params;

    // COMPUTE SOMETHING
    let result;
    if (metric === "busFactor") {
        result = await calcBusFactor(owner, repo, token);
    } else if (metric === "correctness") {
        result = calcCorrectness(repoData);
    } else if (metric === "rampUp") {
        result = await calcRampUp(repoData);
    } else if (metric === "responsiveness") {
        result = calcResponsiveness(repoData);
    } else if (metric === "license") {
        result = await calcLicense(owner, repo, repoURL);
    } else if (metric === "pinnedDeps") {
        result = await calcPinnedDependencies(owner, repo, repoURL);
    } else if (metric === "reviewedCode") {
        result = await calcReviewedCode(repoData);
    }

    const end = Date.now();
    // RETURN SOMETHING
    parentPort?.postMessage({
        score: result,
        latency: (end - begin) / 1000 // in seconds
    });
});