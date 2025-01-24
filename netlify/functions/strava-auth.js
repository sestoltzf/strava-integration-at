const fetch = require("node-fetch");
const glide = require("@glideapps/tables");

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = "https://strava-at-integration.netlify.app/.netlify/functions/strava-auth";

const stravaTable = glide.table({
  token: GLIDE_TOKEN,
  app: "n2K9ttt658yMmwBYpTZ0",
  table: "native-table-77d1be7d-8c64-400d-82f4-bacb0934187e",
  columns: {
    aktivitetsId: { type: "number", name: "Lmyqo" },
    namn: { type: "string", name: "1ii4R" },
    typ: { type: "string", name: "jWa0Z" },
    datum: { type: "string", name: "mpzK7" },
    distans: { type: "string", name: "KBAnt" },
    tid: { type: "string", name: "uLKKx" },
    snittfart: { type: "string", name: "c4k85" },
    totaltTid: { type: "string", name: "fKDsu" },
    hJdmeter: { type: "number", name: "jzDoP" },
    maxfart: { type: "string", name: "Wh5px" },
    snittpuls: { type: "number", name: "p9Sin" },
    maxpuls: { type: "number", name: "EjfhF" },
  },
});

exports.handler = async (event) => {
  if (event.queryStringParameters?.code) {
    try {
      // Hämta token från Strava
      const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code: event.queryStringParameters.code,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();

      // Hämta aktiviteter från Strava
      const activitiesResponse = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=5",
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      const activities = await activitiesResponse.json();

      // Hämta alla rader från Glide-tabellen
      const allRows = await stravaTable.get();

      // Filtrera och lägg bara till aktiviteter som inte redan finns
      for (const activity of activities) {
        const existingActivity = allRows.find(
          (row) => row.aktivitetsId === parseInt(activity.id)
        );

        if (!existingActivity) {
          // Lägg till ny aktivitet
          await stravaTable.add({
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
          });
          console.log(`Ny aktivitet tillagd: ${activity.name}`);
        } else {
          console.log(`Aktivitet med ID ${activity.id} finns redan.`);
        }
      }

      return {
        statusCode: 302,
        headers: {
          Location: "https://strava-at-integration.netlify.app/landing.html",
        },
      };
    } catch (error) {
      console.error("Error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=activity:read_all`;

  return {
    statusCode: 302,
    headers: {
      Location: authUrl,
    },
  };
};
