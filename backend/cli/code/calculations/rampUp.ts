import { ApiResponse, GraphQLResponse } from '.././types';
import { getReadmeDetails } from ".././api/githubApi";

interface Repository {
    [key: string]: { text: string } | null | undefined;
    examplesFolder?: any;
    exampleFolder?: any;
    ExamplesFolder?: any;
    ExampleFolder?: any;
  }


export async function calcRampUp(repoData: ApiResponse<GraphQLResponse | null>): Promise<number> {
    const readmeKeys = [
        'READMEMD', 'READMENOEXT', 'READMETXT', 'READMERDOC', 'READMEHTML', 'READMEADOC', 
        'READMEMARKDOWN', 'READMEYAML', 'READMERST', 'READMETEXTILE', 'readmemd', 
        'readmenoext', 'readmetxt', 'readmerdoc', 'readmehtml', 'readmeadoc', 
        'readmemarkdown', 'readmeyaml', 'readmerst', 'readmetextile', 'readMemd', 
        'readMenoext', 'readMetxt', 'readMerdoc', 'readMehtml', 'readMeadoc', 
        'readMemarkdown', 'readMeyaml', 'readMerst', 'readMetextile', 'ReadMemd', 
        'ReadMenoext', 'ReadMetxt', 'ReadMerdoc', 'ReadMehtml', 'ReadMeadoc', 
        'ReadMemarkdown', 'ReadMeyaml', 'ReadMerst', 'ReadMetextile', 'Readmemd', 
        'Readmenoext', 'Readmetxt', 'Readmerdoc', 'Readmehtml', 'Readmeadoc', 
        'Readmemarkdown', 'Readmeyaml', 'Readmerst', 'Readmetextile'
    ];

    const examplesKeys = ['examplesFolder', 'exampleFolder', 'ExamplesFolder', 'ExampleFolder'];

    const repository = repoData.data?.data.repository as Repository | null | undefined;

    // Find the README content
    let readMe = readmeKeys.map(key => repository?.[key]).find(readme => readme?.text);

    // Find the examples folder
    let exFolder = examplesKeys.map(key => repository?.[key]).find(folder => folder != null);

    // Set rampUp value
    let rampUp = readMe?.text ? await getReadmeDetails(readMe.text, exFolder) : 0.9;

    return rampUp;
}