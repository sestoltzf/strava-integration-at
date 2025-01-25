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

// Lägg till eller uppdatera en användare i Glide-tabellen
async function upsertStravaUser(userData) {
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
          lastSync: userData.lastSync,
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

// Lägg till en ny aktivitet i Glide-tabellen
async function addStravaActivity(activityData) {
  const mutation = {
    appID: APP_ID,
    mutations: [
      {
        kind: "add-row-to-table",
        tableName: "native-table-77d1be7d-8c64-400d-82f4-bacb0934187e",
        columnValues: {
          aktivitetsId: activityData.aktivitetsId,
          firstname: activityData.firstname,
          lastname: activityData.lastname,
          userId: activityData.userId,
          namn: activityData.namn,
          typ: activityData.typ,
          datum: activityData.datum,
          distans: activityData.distans,
          tid: activityData.tid,
          snittfart: activityData.snittfart,
          totaltTid: activityData.totaltTid,
          hJdmeter: activityData.hJdmeter,
          maxfart: activityData.maxfart,
          snittpuls: activityData.snittpuls,
          maxpuls: activityData.maxpuls,
          elevation: activityData.elevation,
          image: activityData.image || "",
        },
      },
    ],
  };

  return fetchFromGlide("mutateTables", mutation);
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

// Bearbeta aktiviteter från Strava och lägg till i Glide
async function processActivities(activities, userData) {
  console.log(`Processing ${activities.length} activities for user ${userData.name}`);

  for (const activity of activities) {
    const activityData = {
      aktivitetsId: activity.id,
      namn: activity.name,
      typ: activity.type,
      datum: activity.start_date,
      distans: activity.distance,
      tid: activity.moving_time,
      snittfart: activity.average_speed,
      totaltTid: activity.elapsed_time,
      hJdmeter: activity.total_elevation_gain,
      maxfart: activity.max_speed,
      snittpuls: activity.average_heartrate || null,
      maxpuls: activity.max_heartrate || null,
      firstname: userData.name.split(" ")[0],
      lastname: userData.name.split(" ")[1] || "",
      userId: userData.stravaId,
    };

    await addStravaActivity(activityData);
    console.log(`Added activity: ${activity.name}`);
  }
}

// Hanterare för Netlify-funktion
exports.handler = async (event) => {
  console.log("Function started with event:", JSON.stringify(event));

  if (event.httpMethod === "GET" && !event.queryStringParameters.code) {
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=activity:read_all`;
    return {
      statusCode: 302,
      headers: { Location: authUrl },
    };
  }

  if (event.queryStringParameters.code) {
    try {
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
    } catch (error) {
      console.error("Error during authentication:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  return { statusCode: 400, body: "Invalid request" };
};
