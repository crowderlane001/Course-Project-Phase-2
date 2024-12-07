import { ApiResponse, GraphQLResponse } from '../types';

export async function calcReviewedCode (repoData: ApiResponse<GraphQLResponse | null>): Promise<number> {
    // const pullRequests = repoData.data?.data.repository.pullRequests.nodes || [];
    
    let totalPRs = 0;
    let reviewedPRs = 0;

    // for (const pr of pullRequests) {
    //     totalPRs++;
    //     if (pr.reviews?.totalCount > 0) {
    //         reviewedPRs++;
    //     }
    // }

    if (totalPRs === 0) {
        return 1.0; // No PRs, return full score
    }

    return reviewedPRs / totalPRs;
};