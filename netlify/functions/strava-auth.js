const fetch = require("node-fetch");

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = "https://strava-at-integration.netlify.app/.netlify/functions/strava-auth";
const APP_ID = "n2K9ttt658yMmwBYpTZ0";

const GLIDE_API_BASE = "https://api.glideapp.io/api/function";

// Allmän funktion för Glide API-anrop
async function fetchFromGlide(endpoint, payload) {
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
    throw new Error(`Glide API Error: ${error.message}`);
  }

  return response.json();
}

// Hämta alla användare från Glide-tabellen
async function getStravaUsers() {
  const query = {
    appID: APP_ID,
    queries: [
      {
        tableName: "native-table-15ae5727-336f-46d7-be40-5719a7f77f17",
      },
    ],
  };

  const result = await fetchFromGlide("queryTables", query);
  return result.rows || [];
}

// Uppdatera en användare i Glide-tabellen
async function updateStravaUser(rowID, updates) {
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

  return fetchFromGlide("mutateTables", mutation);
}

// Lägg till en ny användare i Glide-tabellen
async function addStravaUser(user) {
  const mutation = {
    appID: APP_ID,
    mutations: [
      {
        kind: "add-row-to-table",
        tableName: "native-table-15ae5727-336f-46d7-be40-5719a7f77f17",
        columnValues: user,
      },
    ],
  };

  return fetchFromGlide("mutateTables", mutation);
}

// Hämta Strava-aktiviteter
async function fetchStravaActivities(accessToken) {
  const response = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=5",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Strava API Error: ${response.statusText}`);
  }

  return response.json();
}

// Bearbeta aktiviteter och lägg till nya i Glide-tabellen
async function processActivities(activities, userData) {
  console.log(`Processing ${activities.length} activities for user ${userData.name}`);

  for (const activity of activities) {
    const newActivity = {
      aktivitetsId: activity.id,
      namn: activity.name,
      typ: activity.type,
      datum: activity.start_date,
      distans: activity.distance.toString(),
      tid: activity.moving_time.toString(),
      snittfart: activity.average_speed.toString(),
      totaltTid: activity.elapsed_time.toString(),
      hJdmeter: activity.total_elevation_gain,
      maxfart: activity.max_speed.toString(),
      snittpuls: activity.average_heartrate || null,
      maxpuls: activity.max_heartrate || null,
      firstname: userData.name.split(" ")[0],
      lastname: userData.name.split(" ")[1] || "",
      userId: userData.stravaId,
    };

    await addStravaUser(newActivity);
    console.log(`Added activity: ${activity.name}`);
  }
}

// Uppdatera Strava-token
async function refreshStravaToken(refreshToken) {
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

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  return response.json();
}

// Netlify-funktionens hanterare
exports.handler = async (event) => {
  console.log("Function started", { event: JSON.stringify(event) });

  if (event.headers["x-netlify-event"] === "schedule") {
    try {
      const users = await getStravaUsers();
      console.log(`Found ${users.length} users`);

      for (const user of users) {
        if (!user.refresh) {
          console.log(`No refresh token for user ${user.stravaId}, skipping`);
          continue;
        }

        const tokenData = await refreshStravaToken(user.refresh);

        if (!tokenData.access_token) {
          console.error(`Failed to refresh token for user ${user.stravaId}`);
          continue;
        }

        await updateStravaUser(user.$rowID, {
          access: tokenData.access_token,
          expiry: new Date(tokenData.expires_at * 1000).toISOString(),
          lastSync: new Date().toISOString(),
        });

        const activities = await fetchStravaActivities(tokenData.access_token);
        await processActivities(activities, user);
      }

      return { statusCode: 200, body: "Scheduled sync completed" };
    } catch (error) {
      console.error("Error during sync:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  return { statusCode: 400, body: "Invalid event" };
};
