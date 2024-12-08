// Default index file containing handler for tracks endpoint. This file just retrieves the planned tracks for the project.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
  
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('helloss');
    try {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plannedTracks: ["Access control track"]
        })
      };
    } catch (error) {
      console.error('Error retrieving tracks:', error);
      
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Internal server error while retrieving tracks'
        })
      };
    }
  };