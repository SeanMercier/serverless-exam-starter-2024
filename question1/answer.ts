import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event));

    const awardBody = event?.pathParameters?.awardBody;
    const movieId = event?.pathParameters?.movieId ? parseInt(event.pathParameters.movieId) : undefined;
    const minAwards = event?.queryStringParameters?.min ? parseInt(event.queryStringParameters.min) : undefined;

    if (!awardBody || !movieId) {
      console.error("Missing Parameters: awardBody or movieId");
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing awardBody or movieId" }),
      };
    }

    const commandInput: QueryCommandInput = {
      TableName: process.env.AWARDS_TABLE_NAME,
      KeyConditionExpression: "movieId = :m AND awardBody = :a",
      ExpressionAttributeValues: {
        ":m": movieId,
        ":a": awardBody,
      },
    };

    console.log("DynamoDB Query Input: ", JSON.stringify(commandInput));

    const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));

    if (!commandOutput.Items || commandOutput.Items.length === 0) {
      console.error("No awards found for the specified movie and award body.");
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "No awards found for the specified movie and award body." }),
      };
    }

    const awardDetails = commandOutput.Items[0];
    const numAwards = awardDetails.numAwards;

    // Checks number of awards meets the minimum threshold
    if (minAwards !== undefined && numAwards <= minAwards) {
      console.log(`Number of awards (${numAwards}) does not exceed minimum (${minAwards}).`);
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Request failed" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: awardDetails }),
    };
  } catch (error: any) {
    console.error("Error: ", error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
};

function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  return DynamoDBDocumentClient.from(ddbClient);
}
