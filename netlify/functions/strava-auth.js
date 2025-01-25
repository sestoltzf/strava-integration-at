const fetch = require("node-fetch");
const glide = require("@glideapps/tables");

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = "https://strava-at-integration.netlify.app/.netlify/functions/strava-auth";

const stravaUsers = glide.table({
 token: GLIDE_TOKEN,
 app: "n2K9ttt658yMmwBYpTZ0",
 table: "986441.StravaUsers",
 columns: {
   stravaId: { type: "number", name: "stravaId" },
   refresh: { type: "string", name: "refresh" },
   access: { type: "string", name: "access" },
   expiry: { type: "string", name: "expiry" },
   lastSync: { type: "string", name: "lastSync" },
   name: { type: "string", name: "name" },
   email: { type: "string", name: "email" },
   active: { type: "boolean", name: "active" },
   created: { type: "string", name: "created" },
   lastLogin: { type: "string", name: "lastLogin" }
 }
});

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
   image: { type: "string", name: "image" }
 }
});

async function refreshStravaToken(refresh_token) {
 console.log('Refreshing token with refresh token:', refresh_token);
 try {
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
   const data = await response.json();
   console.log('Token refresh response:', data);
   return data;
 } catch (error) {
   console.error('Error refreshing token:', error);
   throw error;
 }
}

async function processActivities(activities, userData) {
 console.log(`Processing ${activities.length} activities for user ${userData.name}`);
 try {
   const existingActivities = await stravaTable.get({
     filterByFormula: `{userID} = '${userData.stravaId}'`
   });
   console.log(`Found ${existingActivities.length} existing activities`);

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
           firstname: userData.name.split(' ')[0],
           lastname: userData.name.split(' ')[1] || '',
           userID: userData.stravaId,
           elevation: activity.total_elevation_gain || 0,
           image: userData.image || ''
         };

         console.log(`Adding new activity:`, newActivity);
         const result = await stravaTable.add(newActivity);
         console.log(`Activity added:`, result);
       }
     } catch (error) {
       console.error(`Error processing activity ${activity.id}:`, error);
     }
   }
 } catch (error) {
   console.error('Error in processActivities:', error);
   throw error;
 }
}

exports.handler = async (event) => {
 console.log("Function started", { event: JSON.stringify(event, null, 2) });

 if (event.headers["x-netlify-event"] === "schedule") {
   console.log("Starting scheduled sync");
   try {
     console.log('Attempting to fetch users...');
     let users;
     try {
       users = await stravaUsers.get();
       console.log('Users data:', JSON.stringify(users, null, 2));
     } catch (getError) {
       console.error('Error fetching users:', getError);
       console.error('Error details:', {
         message: getError.message,
         stack: getError.stack,
         response: getError.response
       });
       throw getError;
     }

     if (!users || !users.length) {
       console.log('No users found');
       return {
         statusCode: 200,
         body: "No users to sync"
       };
     }

     console.log(`Processing ${users.length} users`);
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

       try {
         await stravaUsers.update({
           stravaId: user.stravaId,
           access: tokenData.access_token,
           expiry: new Date(tokenData.expires_at * 1000).toISOString(),
           lastSync: new Date().toISOString()
         });
         console.log(`Updated token for user ${user.stravaId}`);
       } catch (updateError) {
         console.error('Error updating user:', updateError);
         continue;
       }

       try {
         const activitiesResponse = await fetch(
           "https://www.strava.com/api/v3/athlete/activities?per_page=5",
           { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
         );
         const activities = await activitiesResponse.json();
         console.log(`Retrieved ${activities.length} activities`);
         await processActivities(activities, user);
       } catch (activitiesError) {
         console.error('Error fetching activities:', activitiesError);
       }
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
         stack: error.stack,
         details: error
       })
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
     
     await stravaUsers.add({
       stravaId: athlete.id,
       name: `${athlete.firstname} ${athlete.lastname}`,
       refresh: tokenData.refresh_token,
       access: tokenData.access_token,
       expiry: new Date(tokenData.expires_at * 1000).toISOString(),
       created: new Date().toISOString(),
       lastSync: new Date().toISOString(),
       active: true
     });

     const activitiesResponse = await fetch(
       "https://www.strava.com/api/v3/athlete/activities?per_page=5",
       { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
     );

     const activities = await activitiesResponse.json();
     await processActivities(activities, {
       stravaId: athlete.id,
       name: `${athlete.firstname} ${athlete.lastname}`,
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