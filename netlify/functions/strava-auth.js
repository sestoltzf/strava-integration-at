const fetch = require("node-fetch");

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = "https://strava-at-integration.netlify.app/.netlify/functions/strava-auth";
const APP_ID = "n2K9ttt658yMmwBYpTZ0";

const GLIDE_API_BASE = "https://api.glideapp.io/api/function";

async function fetchFromGlide(endpoint, payload) {
  console.log(`Fetching from Glide: ${endpoint}`, payload);
  const response = await fetch(`${GLIDE_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GLIDE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Glide API Error:", data);
    throw new Error(`Glide API Error: ${data.message}`);
  }

  console.log("Glide API Response:", data);
  return data;
}

async function getStravaUsers() {
  console.log("Fetching Strava users...");
  const query = {
    appID: APP_ID,
    queries: [
      {
        tableName: "native-table-15ae5727-336f-46d7-be40-5719a7f77f17",
      },
    ],
  };

  const result = await fetchFromGlide("queryTables", query);
  console.log("Fetched users:", result.rows);
  return result.rows || [];
}

async function updateStravaUser(rowID, updates) {
  console.log(`Updating user: ${rowID} with updates:`, updates);
  const mutation = {
    appID: APP_ID,
    mutations: [
      {
        kind: "set-columns-in-row",
        tableName: "native-table-15ae5727-336f-46d7-be40-5719a7f77f17",
        rowID,
        columnValues: updates,
      },
    ],
  };

  const response = await fetchFromGlide("mutateTables", mutation);
  console.log(`User updated: ${rowID}`, response);
  return response;
}

async function refreshStravaToken(refreshToken) {
  console.log("Refreshing Strava token...");
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Strava Token Refresh Error:", data);
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  console.log("Refreshed Strava token:", data);
  return data;
}

exports.handler = async (event) => {
  console.log("Function started with event:", event);

  if (event.headers["x-netlify-event"] === "schedule") {
    try {
      console.log("Scheduled sync started...");
      const users = await getStravaUsers();
      console.log(`Found ${users.length} users`);

      for (const user of users) {
        console.log(`Processing user: ${user.name} (${user.stravaId})`);
        if (!user.refresh) {
          console.warn(`No refresh token for user ${user.stravaId}, skipping.`);
          continue;
        }

        try {
          const tokenData = await refreshStravaToken(user.refresh);
          console.log(`Token refreshed for user ${user.stravaId}:`, tokenData);

          await updateStravaUser(user.$rowID, {
            access: tokenData.access_token,
            expiry: new Date(tokenData.expires_at * 1000).toISOString(),
            lastSync: new Date().toISOString(),
          });

          console.log(`Updated token for user ${user.stravaId}`);
        } catch (error) {
          console.error(`Error processing user ${user.stravaId}:`, error.message);
        }
      }

      console.log("Scheduled sync completed successfully.");
      return { statusCode: 200, body: "Scheduled sync completed" };
    } catch (error) {
      console.error("Error during scheduled sync:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  return { statusCode: 400, body: "Invalid event" };
};
