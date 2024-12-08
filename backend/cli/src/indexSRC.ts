//This file contains the main function for the ratePackage function.

import 'dotenv/config';
import { fetchRepoData } from "./api/githubApi";
import { getRepoDetails } from './utils/urlHandler';
import { WorkerResult } from './types';
import { ApiResponse, GraphQLResponse } from './types';
import { Worker } from 'worker_threads';
import { calculateMetrics } from './metricCalcs';

// Function to create and manage worker threads
export function runWorker(owner: string, repo: string, token: string, repoURL: string, repoData: ApiResponse<GraphQLResponse | null>, metric: string): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
        // PATH TO WORKER SCRIPT
        const worker = new Worker('./src/utils/worker.js');
        
        // SEND DATA TO WORKER AND START THE WORKER
        worker.postMessage({owner, repo, token, repoURL, repoData, metric});

        // GET THE WORKER'S RESULT
        worker.on('message', (result: WorkerResult) => {
            resolve(result);
            worker.terminate();
        });

        // HANDLE ERRORS
        worker.on('error', (error) => {
            reject(error);
            worker.terminate();
        });

        // EXIT
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}


export const main = async (url: string): Promise<any> => { // Specify the return type
    const token: string = process.env.GITHUB_TOKEN || "";
    const inputURL: string = url;
    
    // Get repo details
    const repoDetails = await getRepoDetails(token, inputURL);
    const [owner, repo, repoURL]: [string, string, string] = repoDetails;

    // Fetch repository data from GitHub API
    const repoData = await fetchRepoData(owner, repo, token);
    if (!repoData.data) {
        console.log('Unable to fetch repository data');
        return null; // Return null or an appropriate error value
    }
    console.log('Fetched repository data');

    // Calculate all metrics (concurrently)
    const metrics = await calculateMetrics(owner, repo, token, repoURL, repoData, inputURL);
    if (metrics == null) {
        console.log('Unable to calculate metrics');
        return null; // Return null if metrics calculation fails
    }
    console.log('Calculated metrics:', metrics);

    return metrics; // Return the calculated metrics at the end
};
