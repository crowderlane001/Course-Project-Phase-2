import { ApiResponse, GraphQLResponse } from '../types';

export const calcCorrectnessScore = (totalOpenIssuesCount: number, totalClosedIssuesCount: number): number => {
    const totalIssues = totalOpenIssuesCount + totalClosedIssuesCount;
    if (totalIssues == 0) {
        return 1.0;
    }

    return totalClosedIssuesCount / totalIssues;
}

export function calcCorrectness(repoData: ApiResponse<GraphQLResponse | null>): number {
    if (!repoData.data?.data.repository) {
        return 0.0;
    }

    const OpenIssues = repoData.data?.data.repository.openIssues;
    const ClosedIssues = repoData.data?.data.repository.closedIssues;

    if(!OpenIssues){
        return 1.0;
    }

    if (!ClosedIssues) {
        return 0.0;
    }

    const correctness = calcCorrectnessScore(OpenIssues.totalCount, ClosedIssues.totalCount);

    return correctness;
}