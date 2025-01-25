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
    firstname: { type: "string", name: "firstname" }, // Förnamn
    lastname: { type: "string", name: "lastname" }, // Efternamn
    userID: { type: "number", name: "userID" }, // Användar-ID
    elevation: { type: "number", name: "elevation" }, // Total höjdstigning
    image: { type: "string", name: "image" }, // Bild-URL
  },
});

exports.handler = async (event) => {
  console.log("Funktion startad.");
  console.log("Event:", JSON.stringify(event, null, 2));

  if (event.headers["x-netlify-event"] === "schedule") {
    console.log("Schemalagd synkronisering triggas.");
    try {
      console.log("Hämtar token från Strava...");
      const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token: process.env.STRAVA_REFRESH_TOKEN,
          grant_type: "refresh_token",
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

      let addedActivities = 0;

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
            firstname: "Firstname Placeholder", // Placeholder för att visa att data används
            lastname: "Lastname Placeholder",
            userID: 12345, // Placeholder-ID
            elevation: activity.total_elevation_gain || 0, // Höjdstigning
            image: "https://via.placeholder.com/100", // Placeholder bild
          });
          addedActivities++;
          console.log(`Aktivitet tillagd: ${activity.name}`);
        } else {
          console.log(`Aktivitet med ID ${activity.id} finns redan.`);
        }
      }

      console.log(`${addedActivities} nya aktiviteter har lagts till.`);
      return {
        statusCode: 200,
        body: "Synkronisering klar.",
      };
    } catch (error) {
      console.error("Fel under schemalagd synkronisering:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Fel under schemalagd synkronisering." }),
      };
    }
  }

  console.log("Inget att synkronisera.");
  return {
    statusCode: 200,
    body: "Inget att synkronisera.",
  };
};
