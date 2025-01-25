const fetch = require("node-fetch");

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = "https://strava-at-integration.netlify.app/.netlify/functions/strava-auth";

exports.handler = async (event) => {
  console.log("Function started with event:", JSON.stringify(event, null, 2));

  try {
    if (event.httpMethod === "GET") {
      if (event.queryStringParameters && event.queryStringParameters.code) {
        console.log("Processing OAuth redirect from Strava...");

        const response = await fetch("https://www.strava.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code: event.queryStringParameters.code,
            grant_type: "authorization_code",
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to exchange code for token: ${response.statusText}`);
        }

        const tokenData = await response.json();
        console.log("Authentication successful, token data:", tokenData);

        return {
          statusCode: 200,
          body: "Authentication successful! You can close this window.",
        };
      }

      console.log("Redirecting to Strava OAuth page...");
      const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=activity:read_all`;
      return {
        statusCode: 302,
        headers: { Location: authUrl },
      };
    }

    // Hantera POST eller andra typer av förfrågningar
    console.warn("Received non-GET request. Returning error.");
    return {
      statusCode: 405,
      body: "Method not allowed. Please use GET.",
    };
  } catch (error) {
    console.error("Error in function handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
