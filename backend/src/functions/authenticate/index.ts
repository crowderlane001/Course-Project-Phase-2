import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
//take in USER and secret
// User:
//       description: ""
//       required:
//       - name
//       - isAdmin
//       type: object
//       properties:
//         name:
//           description: ""
//           type: string
//           example: Alfalfa
//         isAdmin:
//           description: Is this user an admin?
//           type: boolean
// SECRET:
// UserAuthenticationInfo:
// description: Authentication info for a user
// required:
// - password
// type: object
// properties:
//   password:
//     description: "Password for a user. Per the spec, this should be a \"strong\"\
//       \ password."
//     type: string




export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('helloss');
    try {
      return {
        statusCode: 501,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify("This system does not support authentication.")
      };
    } catch (error) {
      console.error('Error retrieving tracks:', error);
      
      return {
        statusCode: 501,
        body: JSON.stringify("This system does not support authentication.")
      };
    }
  };