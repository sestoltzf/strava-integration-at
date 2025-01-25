exports.handler = async (event) => {
  console.log("Function started with event:", JSON.stringify(event, null, 2));

  try {
    if (event.httpMethod === "POST") {
      console.log("Received POST request. This endpoint does not process POST.");
      return {
        statusCode: 400,
        body: "This endpoint only supports GET requests for authentication.",
      };
    }

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

        await upsertStravaUser({
          stravaId: tokenData.athlete.id,
          refresh: tokenData.refresh_token,
          access: tokenData.access_token,
          expiry: new Date(tokenData.expires_at * 1000).toISOString(),
          name: `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`,
        });

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

    return { statusCode: 400, body: "Invalid request method." };
  } catch (error) {
    console.error("Error in function handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
