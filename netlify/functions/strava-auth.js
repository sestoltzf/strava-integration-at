import fetch from 'node-fetch';
import * as glide from '@glideapps/tables';

// Hämta miljövariabler
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = 'https://strava-at-integration.netlify.app/.netlify/functions/strava-auth';

// Validera miljövariabler
if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !GLIDE_TOKEN) {
    console.error('ERROR: Missing required environment variables!');
    throw new Error('Missing required environment variables!');
}

// Glide-tabeller
const stravaUsersTable = glide.table({
    token: GLIDE_TOKEN,
    app: 'n2K9ttt658yMmwBYpTZ0',
    table: 'native-table-15ae5727-336f-46d7-be40-5719a7f77f17',
    columns: {
        stravaId: { type: 'number', name: 'Name' },
        refresh: { type: 'string', name: 'aUPNj' },
        access: { type: 'string', name: 't1JyI' },
        expiry: { type: 'date-time', name: 'W0V7j' },
        lastSync: { type: 'date-time', name: '2lTug' },
        name: { type: 'string', name: 'xhMIV' },
        email: { type: 'string', name: 'QGza6' },
        active: { type: 'boolean', name: 'gISDF' },
        created: { type: 'date-time', name: 'nroWZ' },
        lastLogin: { type: 'date-time', name: 'dOBxT' }
    }
});

const stravaTable = glide.table({
    token: GLIDE_TOKEN,
    app: 'n2K9ttt658yMmwBYpTZ0',
    table: 'native-table-77d1be7d-8c64-400d-82f4-bacb0934187e',
    columns: {
        aktivitetsId: { type: 'number', name: 'Lmyqo' },
        firstname: { type: 'string', name: 'sqxGe' },
        lastname: { type: 'string', name: 'wNE13' },
        userId: { type: 'string', name: 'SHC1a' },
        namn: { type: 'string', name: '1ii4R' },
        typ: { type: 'string', name: 'jWa0Z' },
        datum: { type: 'date-time', name: 'mpzK7' },
        place: { type: 'string', name: 'eBBrN' },
        distans: { type: 'string', name: 'KBAnt' },
        tid: { type: 'string', name: 'uLKKx' },
        snittfart: { type: 'string', name: 'c4k85' },
        totaltTid: { type: 'string', name: 'fKDsu' },
        hJdmeter: { type: 'number', name: 'jzDoP' },
        maxfart: { type: 'string', name: 'Wh5px' },
        snittpuls: { type: 'number', name: 'p9Sin' },
        maxpuls: { type: 'number', name: 'EjfhF' },
        elevation: { type: 'string', name: 'D2Z2P' },
        image: { type: 'uri', name: 'K7dKS' }
    }
});

export const handler = async (event) => {
    console.log('Step 1: Function triggered with event:', JSON.stringify(event, null, 2));

    if (event.httpMethod === 'POST' && event.headers['x-netlify-event'] === 'schedule') {
        console.log('Step 2: Skipping processing for scheduled invocation.');
        return {
            statusCode: 200,
            body: 'Scheduled run completed successfully'
        };
    }

    if (event.httpMethod !== 'GET') {
        console.log('Step 3: Unsupported HTTP method:', event.httpMethod);
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    if (event.queryStringParameters?.code) {
        try {
            console.log('Step 4: Received code:', event.queryStringParameters.code);

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

            if (!tokenResponse.ok) {
                console.error(`Step 5: Token request failed with status: ${tokenResponse.status}`);
                throw new Error('Failed to fetch token');
            }

            const tokenData = await tokenResponse.json();
            console.log('Step 6: Token data:', tokenData);

            const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });

            if (!athleteResponse.ok) {
                console.error(`Step 7: Athlete request failed with status: ${athleteResponse.status}`);
                throw new Error('Failed to fetch athlete data');
            }

            const athlete = await athleteResponse.json();
            console.log('Step 8: Athlete data:', athlete);

            await stravaUsersTable.add({
                stravaId: athlete.id,
                refresh: tokenData.refresh_token,
                access: tokenData.access_token,
                expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
                lastSync: new Date().toISOString(),
                name: `${athlete.firstname} ${athlete.lastname}`,
                email: athlete.email || '',
                active: true,
                created: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            });
            console.log('Step 9: User added successfully.');

            const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });

            if (!activitiesResponse.ok) {
                console.error(`Step 10: Activities request failed with status: ${activitiesResponse.status}`);
                throw new Error('Failed to fetch activities');
            }

            const activities = await activitiesResponse.json();
            console.log('Step 11: Activities data:', activities);

            for (const activity of activities) {
                await stravaTable.add({
                    aktivitetsId: parseInt(activity.id),
                    firstname: athlete.firstname,
                    lastname: athlete.lastname,
                    userId: athlete.id.toString(),
                    namn: activity.name,
                    typ: activity.type,
                    datum: activity.start_date,
                    place: 'Unknown',
                    distans: activity.distance.toString(),
                    tid: activity.moving_time.toString(),
                    snittfart: activity.average_speed.toString(),
                    totaltTid: activity.elapsed_time.toString(),
                    hJdmeter: activity.total_elevation_gain,
                    maxfart: activity.max_speed.toString(),
                    snittpuls: activity.average_heartrate || null,
                    maxpuls: activity.max_heartrate || null,
                    elevation: activity.elev_high?.toString() || '',
                    image: ''
                });
                console.log(`Step 12: Activity ID ${activity.id} added.`);
            }

            return {
                statusCode: 302,
                headers: { Location: 'https://strava-at-integration.netlify.app/landing.html' }
            };
        } catch (error) {
            console.error('Error during OAuth process:', error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: error.message })
            };
        }
    }

    console.log('Step 13: Redirecting to Strava OAuth...');
    return {
        statusCode: 302,
        headers: {
            Location: `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=activity:read_all`
        }
    };
};
