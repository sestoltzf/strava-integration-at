const fetch = require('node-fetch');
const Airtable = require('airtable');

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY; // Din nya Personal Access Token
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const REDIRECT_URI = 'https://strava-at-integration.netlify.app/.netlify/functions/strava-auth';

exports.handler = async (event) => {
  console.log('Starting handler...');
  console.log('Loaded Environment Variables:');
  console.log('STRAVA_CLIENT_ID:', STRAVA_CLIENT_ID ? 'Present' : 'Missing');
  console.log('STRAVA_CLIENT_SECRET:', STRAVA_CLIENT_SECRET ? 'Present' : 'Missing');
  console.log('AIRTABLE_API_KEY:', AIRTABLE_API_KEY ? 'Present' : 'Missing');
  console.log('AIRTABLE_BASE_ID:', AIRTABLE_BASE_ID ? 'Present' : 'Missing');

  if (event.queryStringParameters?.code) {
    try {
      console.log('Starting Strava token exchange...');
      
      const requestBody = {
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code: event.queryStringParameters.code,
        grant_type: 'authorization_code'
      };

      console.log('Request to Strava:', {
        ...requestBody,
        client_secret: '***hidden***' // Dölj hemligheten i loggen
      });

      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const tokenData = await tokenResponse.json();
      console.log('Token response:', {
        ...tokenData,
        access_token: tokenData.access_token ? '***present***' : '***missing***',
        refresh_token: tokenData.refresh_token ? '***present***' : '***missing***'
      });

      if (!tokenData.access_token) {
        throw new Error('No access token in response: ' + JSON.stringify(tokenData));
      }
      
      console.log('Getting activities from Strava...');
      const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      
      const activities = await activitiesResponse.json();
      console.log(`Retrieved ${activities.length} activities`);
      
      if (!Array.isArray(activities)) {
        console.error('Activities response:', activities);
        throw new Error('Failed to get activities: ' + JSON.stringify(activities));
      }
      
      console.log('Saving activities to Airtable...');
      const base = new Airtable({ personalAccessToken: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
      
      for (const activity of activities) {
        try {
          console.log('Saving activity to Airtable:', activity.name);
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

  console.log('Redirecting to Strava authorization...');
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=activity:read_all`;
  
  return {
    statusCode: 302,
    headers: {
        Location: 'https://strava-at-integration.netlify.app/landing.html'
    }
};

};
