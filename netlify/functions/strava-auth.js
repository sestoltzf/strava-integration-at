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
  console.log("Funktion startad.");
  console.log("Event:", JSON.stringify(event, null, 2));

  // Hantera schemalagd synkronisering
  if (event.headers["x-netlify-event"] === "schedule") {
    console.log("Schemalagd synkronisering triggas.");
    try {
      console.log("Hämtar alla rader från Glide-tabellen...");
      const allRows = await stravaTable.get();
      console.log("Antal rader i tabellen:", allRows.length);

      // Lägg till din synkroniseringslogik här
      console.log("Synkronisering klar.");
      return {
        statusCode: 200,
        body: "Schemalagd synkronisering klar.",
      };
    } catch (error) {
      console.error("Fel under schemalagd synkronisering:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Fel under schemalagd synkronisering." }),
      };
    }
  }

  // Hantera autentiseringsflödet
  if (event.queryStringParameters?.code) {
    console.log("Query-parameter 'code' hittad:", event.queryStringParameters.code);

    try {
      console.log("Hämtar token från Strava...");
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
      console.log("Token-data mottagen:", tokenData);

      console.log("Hämtar aktiviteter från Strava...");
      const activitiesResponse = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=5",
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      const activities = await activitiesResponse.json();
      console.log("Aktiviteter mottagna:", activities);

      console.log("Hämtar alla rader från Glide-tabellen...");
      const allRows = await stravaTable.get();
      console.log("Antal rader i tabellen:", allRows.length);

      for (const activity of activities) {
        console.log(`Kontrollerar aktivitet med ID ${activity.id}...`);
        const existingActivity = allRows.find(
          (row) => row.aktivitetsId === parseInt(activity.id)
        );

        if (!existingActivity) {
          console.log(`Lägger till ny aktivitet: ${activity.name}`);
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
          console.log(`Aktivitet tillagd: ${activity.name}`);
        } else {
          console.log(`Aktivitet med ID ${activity.id} finns redan.`);
        }
      }

      console.log("Alla aktiviteter har bearbetats.");
      return {
        statusCode: 302,
        headers: {
          Location: "https://strava-at-integration.netlify.app/landing.html",
        },
      };
    } catch (error) {
      console.error("Fel under autentisering:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  // Om inget av ovanstående matchar
  console.log("Ingen 'code' parameter hittades.");
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=activity:read_all`;

  return {
    statusCode: 302,
    headers: {
      Location: authUrl,
    },
  };
};
