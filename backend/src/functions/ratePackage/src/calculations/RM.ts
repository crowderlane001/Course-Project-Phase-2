//This file contains utility functions for calculating the responsiveness metric.

import { ContributorResponse, ClosedIssueNode, PullRequestNode, OpenIssueNode } from "../types";
import { ApiResponse, GraphQLResponse } from '../types';

export const calcResponsivenessScore = (
    closedIssues: ClosedIssueNode[], 
    openIssues: OpenIssueNode[], 
    pullRequests: PullRequestNode[],
    sinceDate: Date,
    isArchived: boolean
): number => {
    if (isArchived) {
        // repo is no longer maintained
        console.log("RM, Repository is archived");
        return 0.0;
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

    console.log("RM", openIssueCount, closedIssueCount, openPRCount, closedPRCount);

    const totalRecentIssues = openIssueCount + closedIssueCount;
    const totalRecentPRs = openPRCount + closedPRCount;

    const issueCloseRatio = totalRecentIssues > 0 
        ? closedIssueCount / totalRecentIssues 
        : 0.0;
    const prCloseRatio = totalRecentPRs > 0 
        ? closedPRCount / totalRecentPRs 
        : 0.0;
    
    console.log("RM", issueCloseRatio, prCloseRatio);
    return 0.5 * issueCloseRatio + 0.5 * prCloseRatio
};

export function calcResponsiveness(repoData: ApiResponse<GraphQLResponse | null>): number {
    if(!repoData.data?.data.repository){
        console.log("RM, No repository data found");
        return 0.0;
    }

    const recentPullRequests = repoData.data?.data.repository.pullRequests;
    const isArchived = repoData.data?.data.repository.isArchived;
    const totalOpenIssues = repoData.data?.data.repository.openIssues;
    const totalClosedIssues = repoData.data?.data.repository.closedIssues;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    if (!recentPullRequests?.nodes || !totalClosedIssues?.nodes || !totalOpenIssues?.nodes) {
        console.log("RM, No recent pull requests, closed issues, or open issues found");
        return 1.0;
    }

    if(!recentPullRequests){
        console.log("RM, No recent pull requests found");
        return 0.0;
    }

    if(!totalClosedIssues){
        console.log("RM, No closed issues found");
        return 0.0;
    }

    if(!totalOpenIssues){
        console.log("RM, No open issues found");
        return 1.0;
    }   

    const responsiveness = calcResponsivenessScore(totalClosedIssues.nodes, totalOpenIssues.nodes, recentPullRequests.nodes, oneMonthAgo, isArchived ?? false);
    console.log("RM", responsiveness, totalClosedIssues.nodes.length, totalOpenIssues.nodes.length, recentPullRequests.nodes.length);
    return responsiveness;
}