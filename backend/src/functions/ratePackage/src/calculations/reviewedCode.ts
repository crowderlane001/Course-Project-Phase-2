//This file contains utility functions for calculating the reviewed code metric.

import { ApiResponse, GraphQLResponse } from '../types';

export async function calcReviewedCode (repoData: ApiResponse<GraphQLResponse | null>): Promise<number> {
    const pullRequests = repoData.data?.data.repository.pullRequests.nodes || [];
    
    let totalPRs = 0.0;
    let reviewedPRs = 0.0;

    for (const pr of pullRequests) {
        if(pr.closedAt){
            totalPRs++;
        }
        // Check if `reviews` exists and is an empty array
        if (Array.isArray(pr.reviews) && pr.reviews.length === 0) {
            reviewedPRs++;
        }
    }

    console.log(pullRequests[0], pullRequests[1], pullRequests[2], pullRequests[3], pullRequests[4]);

    console.log('PRs:', reviewedPRs, totalPRs);

    if (totalPRs === 0) {
        return 0.0; // No closed PRs, 0
    }

    return reviewedPRs / totalPRs;
};