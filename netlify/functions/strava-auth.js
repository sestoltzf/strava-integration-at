const fetch = require('node-fetch');
const glide = require('@glideapps/tables');

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = 'https://strava-at-integration.netlify.app/.netlify/functions/strava-auth';

const stravaTable = glide.table({
   token: GLIDE_TOKEN,
   app: "n2K9ttt658yMmwBYpTZ0",
   table: "native-table-77d1be7d-8c64-400d-82f4-bacb0934187e"
}).useKey('Lmyqo');

const usersTable = glide.table({
   token: GLIDE_TOKEN,
   app: "n2K9ttt658yMmwBYpTZ0",
   table: "native-table-15ae5727-336f-46d7-be40-5719a7f77f17"
}).useKey('stravaId');

exports.handler = async (event) => {
 if (event.queryStringParameters?.code) {
   try {
     const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         client_id: STRAVA_CLIENT_ID,
         client_secret: STRAVA_CLIENT_SECRET,
         code: event.queryStringParameters.code,
         grant_type: 'authorization_code'
       })
     });

     const tokenData = await tokenResponse.json();
     
     const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
       headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
     });
     const athlete = await athleteResponse.json();

     // Check for existing user
     const existingUser = await usersTable.find(athlete.id);

     if (existingUser) {
       await usersTable.update(existingUser.id, {
         refreshToken: tokenData.refresh_token,
         accessToken: tokenData.access_token,
         tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
         lastSyncTime: new Date().toISOString(),
         lastLoginDate: new Date().toISOString()
       });
     } else {
       await usersTable.create({
         stravaId: athlete.id,
         refreshToken: tokenData.refresh_token,
         accessToken: tokenData.access_token,
         tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
         lastSyncTime: new Date().toISOString(),
         athleteName: athlete.firstname + ' ' + athlete.lastname,
         athleteEmail: athlete.email,
         isActive: true,
         createDate: new Date().toISOString(),
         lastLoginDate: new Date().toISOString()
       });
     }
     
     const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
       headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
     });
     
     const activities = await activitiesResponse.json();
     
     for (const activity of activities) {
       const existingActivity = await stravaTable.find(activity.id);

       if (!existingActivity) {
         await stravaTable.create({
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
           snittpuls: activity.average_heartrate,
           maxpuls: activity.max_heartrate
         });
       }
     }

     return {
       statusCode: 302,
       headers: {
         Location: 'https://strava-at-integration.netlify.app/landing.html'
       }
     };

   } catch (error) {
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
     Location: authUrl
   }
 };
};