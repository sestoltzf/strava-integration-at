const fetch = require('node-fetch');
const glide = require('@glideapps/tables');

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const GLIDE_TOKEN = process.env.GLIDE_TOKEN;
const REDIRECT_URI = 'https://strava-at-integration.netlify.app/.netlify/functions/strava-auth';

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
        maxpuls: { type: "number", name: "EjfhF" }
    }
});

const usersTable = glide.table({
    token: GLIDE_TOKEN,
    app: "n2K9ttt658yMmwBYpTZ0",
    table: "native-table-15ae5727-336f-46d7-be40-5719a7f77f17",
    columns: {
        stravaUserId: { type: "number", name: "stravaId" },
        refreshToken: { type: "string", name: "refresh" },
        accessToken: { type: "string", name: "access" },
        tokenExpiresAt: { type: "date", name: "expiry" },
        lastSyncTime: { type: "date", name: "lastSync" },
        athleteName: { type: "string", name: "name" },
        athleteEmail: { type: "string", name: "email" },
        isActive: { type: "boolean", name: "active" },
        createDate: { type: "date", name: "created" },
        lastLoginDate: { type: "date", name: "lastLogin" }
    }
});

exports.handler = async (event) => {
    console.log('Step 1: Function triggered with event:', JSON.stringify(event, null, 2));

    if (event.queryStringParameters?.code) {
        try {
            console.log('Step 2: Received code:', event.queryStringParameters.code);

            // Fetch token from Strava
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

            console.log('Step 3: Token response status:', tokenResponse.status);

            const tokenData = await tokenResponse.json();
            console.log('Step 4: Token data:', tokenData);

            // Fetch athlete information
            const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });

            console.log('Step 5: Athlete response status:', athleteResponse.status);

            const athlete = await athleteResponse.json();
            console.log('Step 6: Athlete data:', athlete);

            // Add user to Glide table
            console.log('Step 7: Adding user to Glide users table...');
            await usersTable.add({
                stravaUserId: athlete.id,
                refreshToken: tokenData.refresh_token,
                accessToken: tokenData.access_token,
                tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
                lastSyncTime: new Date().toISOString(),
                athleteName: `${athlete.firstname} ${athlete.lastname}`,
                athleteEmail: athlete.email || '',
                isActive: true,
                createDate: new Date().toISOString(),
                lastLoginDate: new Date().toISOString()
            });
            console.log('Step 8: User added successfully.');

            // Fetch activities from Strava
            console.log('Step 9: Fetching athlete activities...');
            const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });

            console.log('Step 10: Activities response status:', activitiesResponse.status);

            const activities = await activitiesResponse.json();
            console.log('Step 11: Activities data:', activities);

            // Add activities to Glide table
            for (const activity of activities) {
                console.log(`Step 12: Adding activity to Glide table - ID: ${activity.id}`);
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
                    maxpuls: activity.max_heartrate || null
                });
                console.log(`Step 13: Activity ID: ${activity.id} added successfully.`);
            }

            return {
                statusCode: 302,
                headers: {
                    Location: 'https://strava-at-integration.netlify.app/landing.html'
                }
            };

        } catch (error) {
            console.error('Error occurred during Strava OAuth process:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: error.message })
            };
        }
    }

    // Redirect to Strava OAuth
    console.log('Step 14: Redirecting to Strava OAuth...');
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=activity:read_all`;
    return {
        statusCode: 302,
        headers: {
            Location: authUrl
        }
    };
};
