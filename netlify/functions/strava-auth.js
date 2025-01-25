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
   firstname: { type: "string", name: "firstname" },
   lastname: { type: "string", name: "lastname" },
   userID: { type: "number", name: "userID" },
   elevation: { type: "number", name: "elevation" },
   image: { type: "string", name: "image" },
   refresh_token: { type: "string", name: "refresh_token" }
 },
});

async function refreshStravaToken(refresh_token) {
 const response = await fetch('https://www.strava.com/oauth/token', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
     client_id: STRAVA_CLIENT_ID,
     client_secret: STRAVA_CLIENT_SECRET,
     refresh_token: refresh_token,
     grant_type: 'refresh_token'
   })
 });
 return await response.json();
}

async function processActivities(activities, userData) {
 const existingActivities = await stravaTable.get({
   filterByFormula: `{userID} = '${userData.userID}'`
 });

 for (const activity of activities) {
   try {
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
         firstname: userData.firstname,
         lastname: userData.lastname,
         userID: userData.userID,
         elevation: activity.total_elevation_gain || 0,
         image: userData.image
       };

       console.log(`Adding activity:`, newActivity);
       await stravaTable.add(newActivity);
     }
   } catch (error) {
     console.error(`Error processing activity ${activity.id}:`, error);
   }
 }
}

exports.handler = async (event) => {
 console.log("Function started");

 if (event.headers["x-netlify-event"] === "schedule") {
   try {
     const users = await stravaTable.get();
     console.log(`Found ${users.length} users`);

     for (const user of users) {
       if (!user.refresh_token) {
         console.log(`No refresh token for user ${user.userID}, skipping`);
         continue;
       }

       const tokenData = await refreshStravaToken(user.refresh_token);
       
       if (!tokenData.access_token) {
         console.error(`Failed to refresh token for user ${user.userID}`);
         continue;
       }

       const activitiesResponse = await fetch(
         "https://www.strava.com/api/v3/athlete/activities?per_page=5",
         { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
       );

       const activities = await activitiesResponse.json();
       await processActivities(activities, user);
     }

     return {
       statusCode: 200,
       body: "Scheduled sync completed"
     };
   } catch (error) {
     console.error("Sync error:", error);
     return {
       statusCode: 500,
       body: JSON.stringify({ error: error.message })
     };
   }
 }

 if (event.queryStringParameters?.code) {
   try {
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
     
     if (!tokenData.access_token) {
       throw new Error("No access token received");
     }

     const athleteResponse = await fetch("https://www.strava.com/api/v3/athlete", {
       headers: { Authorization: `Bearer ${tokenData.access_token}` }
     });

     const athlete = await athleteResponse.json();
     
     // Store refresh token
     await stravaTable.add({
       userID: athlete.id,
       firstname: athlete.firstname,
       lastname: athlete.lastname,
       image: athlete.profile,
       refresh_token: tokenData.refresh_token
     });

     const activitiesResponse = await fetch(
       "https://www.strava.com/api/v3/athlete/activities?per_page=5",
       { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
     );

     const activities = await activitiesResponse.json();
     await processActivities(activities, {
       userID: athlete.id,
       firstname: athlete.firstname,
       lastname: athlete.lastname,
       image: athlete.profile
     });

     return {
       statusCode: 302,
       headers: {
         Location: "https://strava-at-integration.netlify.app/landing.html",
       },
     };
   } catch (error) {
     console.error("Auth error:", error);
     return {
       statusCode: 500,
       body: JSON.stringify({ error: error.message })
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