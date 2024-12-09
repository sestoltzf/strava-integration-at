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
      console.log('Getting token from Strava...');
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
      if (!tokenData.access_token) {
        console.error('Token response:', tokenData);
        throw new Error('Failed to get access token');
      }
      
      console.log('Getting activities from Strava...');
      const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      
      const activities = await activitiesResponse.json();
      if (!Array.isArray(activities)) {
        console.error('Activities response:', activities);
        throw new Error('Failed to get activities');
      }
      
      console.log(`Got ${activities.length} activities, saving to Airtable...`);
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
        } catch (airtableError) {
          console.error('Airtable error:', airtableError);
          throw new Error('Failed to save to Airtable');
        }
      }

      console.log('Success! Redirecting...');
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
          details: error.message 
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