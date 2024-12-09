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
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code: event.queryStringParameters.code,
          grant_type: 'eae06e243b625a661509b325b4a2202d46e9f205'
        })
      });

      const tokenData = await tokenResponse.json();
      
      const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      
      const activities = await activitiesResponse.json();
      
      const base = new Airtable({apiKey: AIRTABLE_API_KEY}).base(AIRTABLE_BASE_ID);
      
      for (const activity of activities) {
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
      }

      return {
        statusCode: 302,
        headers: {
          Location: 'https://strava-at-integration.netlify.app'
        }
      };

    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to process Strava authentication' })
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