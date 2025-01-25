const fetch = require("node-fetch");

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = "https://strava-at-integration.netlify.app/.netlify/functions/strava-auth";
const APP_ID = "n2K9ttt658yMmwBYpTZ0";

const GLIDE_API_BASE = "https://api.glideapp.io/api/function";

// Funktion för att skicka förfrågningar till Glide API
async function fetchFromGlide(endpoint, payload) {
  console.log(`Sending request to Glide: ${endpoint}`, payload);
  const response = await fetch(`${GLIDE_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GLIDE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`Glide API Error: ${error.message}`);
    throw new Error(`Glide API Error: ${error.message}`);
  }

  const data = await response.json();
  console.log(`Response from Glide: ${endpoint}`, data);
  return data;
}

// Lägg till eller uppdatera användare i Glide-tabellen
async function upsertStravaUser(userData) {
  console.log("Upserting Strava user:", userData);
  const mutation = {
    appID: APP_ID,
    mutations: [
      {
        kind: "add-row-to-table",
        tableName: "native-table-15ae5727-336f-46d7-be40-5719a7f77f17",
        columnValues: {
          stravaId: userData.stravaId,
          refresh: userData.refresh,
          access: userData.access,
          expiry: userData.expiry,
          lastSync: userData.lastSync || new Date().toISOString(),
          name: userData.name,
          email: userData.email || "",
          active: userData.active || true,
          created: userData.created || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        },
      },
    ],
  };

  return fetchFromGlide("mutateTables", mutation);
}

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

    if (event.httpMethod === "POST") {
      console.log("Processing POST request...");
      // Lägg till logik här för att hantera POST-förfrågningar om det behövs.
      return {
        statusCode: 200,
        body: "POST request processed successfully.",
      };
    }

    return { statusCode: 405, body: "Method not allowed. Please use GET or POST." };
  } catch (error) {
    console.error("Error in function handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
