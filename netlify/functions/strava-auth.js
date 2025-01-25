const fetch = require("node-fetch");
const glide = require("@glideapps/tables");

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = "https://strava-at-integration.netlify.app/.netlify/functions/strava-auth";

const stravaUsers = glide.table({
  token: GLIDE_TOKEN,
  app: "n2K9ttt658yMmwBYpTZ0",
  table: "native-table-15ae5727-336f-46d7-be40-5719a7f77f17",
  columns: {
    stravaId: { type: "number", name: "Name" },
    refresh: { type: "string", name: "aUPNj" },
    access: { type: "string", name: "t1JyI" },
    expiry: { type: "date-time", name: "W0V7j" },
    lastSync: { type: "date-time", name: "2lTug" },
    name: { type: "string", name: "xhMIV" },
    email: { type: "string", name: "QGza6" },
    active: { type: "boolean", name: "gISDF" },
    created: { type: "date-time", name: "nroWZ" },
    lastLogin: { type: "date-time", name: "dOBxT" }
  },
});

const stravaActivities = glide.table({
  token: GLIDE_TOKEN,
  app: "n2K9ttt658yMmwBYpTZ0",
  table: "native-table-77d1be7d-8c64-400d-82f4-bacb0934187e",
  columns: {
    aktivitetsId: { type: "number", name: "Lmyqo" },
    firstname: { type: "string", name: "sqxGe" },
    lastname: { type: "string", name: "wNE13" },
    userId: { type: "string", name: "SHC1a" },
    namn: { type: "string", name: "1ii4R" },
    typ: { type: "string", name: "jWa0Z" },
    datum: { type: "date-time", name: "mpzK7" },
    place: { type: "string", name: "eBBrN" },
    distans: { type: "string", name: "KBAnt" },
    tid: { type: "string", name: "uLKKx" },
    snittfart: { type: "string", name: "c4k85" },
    totaltTid: { type: "string", name: "fKDsu" },
    hJdmeter: { type: "number", name: "jzDoP" },
    maxfart: { type: "string", name: "Wh5px" },
    snittpuls: { type: "number", name: "p9Sin" },
    maxpuls: { type: "number", name: "EjfhF" },
    elevation: { type: "string", name: "D2Z2P" },
    image: { type: "uri", name: "K7dKS" }
  },
});

async function refreshStravaToken(refresh_token) {
  console.log("Refreshing token...");
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refresh_token,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json();
  console.log("Token refreshed successfully");
  return data;
}

async function processActivities(activities, userData) {
  console.log(`Processing ${activities.length} activities for user ${userData.name}`);
  try {
    const existingActivities = await stravaActivities.get({
      filterByFormula: `{userID} = '${userData.stravaId}'`
    });

    for (const activity of activities) {
      const existingActivity = existingActivities.find(
        row => row.aktivitetsId === parseInt(activity.id)
      );

      if (!existingActivity) {
        const newActivity = {
          aktivitetsId: parseInt(activity.id),
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
          userID: userData.stravaId,
          elevation: activity.total_elevation_gain || 0,
          image: userData.image || ""
        };

        await stravaActivities.add(newActivity);
        console.log(`Added activity: ${activity.name}`);
      } else {
        console.log(`Activity ${activity.name} already exists.`);
      }
    }
  } catch (error) {
    console.error("Error processing activities:", error);
    throw error;
  }
}

exports.handler = async event => {
  console.log("Function started", { event: JSON.stringify(event) });

  if (event.headers["x-netlify-event"] === "schedule") {
    console.log("Starting scheduled sync");
    try {
      const users = await stravaUsers.get();
      console.log(`Found ${users.length} users`);

      for (const user of users) {
        if (!user.refresh) {
          console.log(`No refresh token for user ${user.stravaId}, skipping`);
          continue;
        }

        console.log(`Processing user: ${user.name}`);
        const tokenData = await refreshStravaToken(user.refresh);

        if (!tokenData.access_token) {
          console.error(`Failed to refresh token for user ${user.stravaId}`);
          continue;
        }

        const userRow = users.find(u => u.stravaId === user.stravaId);
        if (!userRow) {
          console.warn(`User with stravaId ${user.stravaId} not found, adding new row.`);
          await stravaUsers.add({
            stravaId: user.stravaId,
            name: user.name,
            access: tokenData.access_token,
            expiry: new Date(tokenData.expires_at * 1000).toISOString(),
            lastSync: new Date().toISOString(),
            created: new Date().toISOString(),
            active: true
          });
          continue;
        }

        await stravaUsers.update(
          userRow.id,
          {
            access: tokenData.access_token,
            expiry: new Date(tokenData.expires_at * 1000).toISOString(),
            lastSync: new Date().toISOString()
          }
        );

        const activitiesResponse = await fetch(
          "https://www.strava.com/api/v3/athlete/activities?per_page=5",
          { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
        );

        const activities = await activitiesResponse.json();
        await processActivities(activities, user);
        console.log(`Completed sync for user: ${user.name}`);
      }

      return {
        statusCode: 200,
        body: "Scheduled sync completed"
      };
    } catch (error) {
      console.error("Sync error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: error.message,
          details: error.toString()
        })
      };
    }
  }

  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=activity:read_all`;
  return {
    statusCode: 302,
    headers: {
      Location: authUrl
    }
  };
};
