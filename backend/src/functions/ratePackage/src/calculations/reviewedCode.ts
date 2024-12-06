import { ApiResponse, GraphQLResponse } from '../types';

export async function calcReviewedCode (repoData: ApiResponse<GraphQLResponse | null>): Promise<number> {
    const pullRequests = repoData.data?.data.repository.pullRequests.nodes || [];
    
    let totalPRs = 0.0;
    let reviewedPRs = 0.0;

    for (const pr of pullRequests) {
        totalPRs++;
        reviewedPRs += 2;

    }

    if (totalPRs === 0) {
        return 1.0; // No PRs, return full score
    }

    return reviewedPRs / totalPRs;
};