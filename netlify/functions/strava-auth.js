const fetch = require('node-fetch');
const Airtable = require('airtable');

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const REDIRECT_URI = 'https://strava-at-integration.netlify.app/.netlify/functions/strava-auth';

exports.handler = async (event) => {
 if (event.queryStringParameters?.code) {
   try {
     console.log('Starting Strava token exchange...');
     console.log('Using code:', event.queryStringParameters.code);
     
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
     console.log('Token response:', tokenData);

     const accessToken = tokenData.access_token || tokenData.token;
     if (!accessToken) {
       console.error('Token data:', tokenData);
       throw new Error('No access token in response: ' + JSON.stringify(tokenData));
     }
     
     console.log('Getting activities from Strava...');
     const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
       headers: { 'Authorization': `Bearer ${accessToken}` }
     });
     
     const activities = await activitiesResponse.json();
     console.log(`Retrieved ${activities.length} activities`);
     
     if (!Array.isArray(activities)) {
       console.error('Activities response:', activities);
       throw new Error('Failed to get activities: ' + JSON.stringify(activities));
     }
     
     console.log('Saving to Airtable...');
     const base = new Airtable({apiKey: AIRTABLE_API_KEY}).base(AIRTABLE_BASE_ID);
     
     for (const activity of activities) {
       try {
         await base('Activities').create([
           {
             fields: {
               'Aktivitets ID': activity.id.toString(),
               'Namn': activity.name,
               'Typ': activity.type,
               'Datum': activity.start_date,
               'Distans': activity.distance,
               'Tid': activity.moving_time,
               'Höjdmeter': activity.total_elevation_gain,
               'Snittfart': activity.average_speed,
               'Maxfart': activity.max_speed,
               'Snittpuls': activity.average_heartrate,
               'Maxpuls': activity.max_heartrate
             }
           }
         ]);
         console.log('Saved activity:', activity.name);
       } catch (airtableError) {
         console.error('Airtable error for activity', activity.name, ':', airtableError);
         throw new Error('Failed to save to Airtable: ' + airtableError.message);
       }
     }

     console.log('All done! Redirecting...');
     return {
       statusCode: 302,
       headers: {
         Location: 'https://strava-at-integration.netlify.app'
       }
     };

   } catch (error) {
     console.error('Detailed error:', error);
     return {
       statusCode: 500,
       body: JSON.stringify({ 
         error: 'Failed to process Strava authentication',
         details: error.message,
         stack: error.stack
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