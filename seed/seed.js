const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || 'http://driver-service:3002';
const RIDER_SERVICE_URL = process.env.RIDER_SERVICE_URL || 'http://rider-service:3003';
const SEED_RIDERS = parseInt(process.env.SEED_RIDERS || '200');
const SEED_DRIVERS = parseInt(process.env.SEED_DRIVERS || '100');

// Tallinn bounding box for realistic coordinates
const TALLINN_BOUNDS = {
    minLat: 59.35,
    maxLat: 59.50,
    minLng: 24.60,
    maxLng: 24.90,
};

function randomLat() {
    return parseFloat((Math.random() * (TALLINN_BOUNDS.maxLat - TALLINN_BOUNDS.minLat) + TALLINN_BOUNDS.minLat).toFixed(6));
}

function randomLng() {
    return parseFloat((Math.random() * (TALLINN_BOUNDS.maxLng - TALLINN_BOUNDS.minLng) + TALLINN_BOUNDS.minLng).toFixed(6));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function registerUser(email, password, name, role) {
    const response = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, {
        email,
        password,
        name,
        role,
    });
    return response.data;
}

async function createDriver(userId, name, email) {
    const response = await axios.post(`${DRIVER_SERVICE_URL}/drivers`, {
        userId,
        name,
        email,
        lat: randomLat(),
        lng: randomLng(),
    });
    return response.data;
}

async function createRider(userId, name, email) {
    const response = await axios.post(`${RIDER_SERVICE_URL}/riders`, {
        userId,
        name,
        email,
    });
    return response.data;
}

async function seedDrivers() {
    console.log(`Seeding ${SEED_DRIVERS} drivers...`);
    const results = [];

    for (let i = 1; i <= SEED_DRIVERS; i++) {
        try {
            const email = `driver${i}@fakebolt.com`;
            const name = `Driver-${i}`;
            const password = 'Password123!';

            const { token, user } = await registerUser(email, password, name, 'driver');
            await createDriver(user.id, name, email);

            results.push({ email, password, token, userId: user.id });
            console.log(`Driver ${i}/${SEED_DRIVERS} created`);

            // small delay to avoid overwhelming services
            await sleep(50);
        } catch (error) {
            console.error(`Failed to create driver ${i}:`, error.response?.data || error.message);
        }
    }

    return results;
}

async function seedRiders() {
    console.log(`Seeding ${SEED_RIDERS} riders...`);
    const results = [];

    for (let i = 1; i <= SEED_RIDERS; i++) {
        try {
            const email = `rider${i}@fakebolt.com`;
            const name = `Rider-${i}`;
            const password = 'Password123!';

            const { token, user } = await registerUser(email, password, name, 'rider');
            await createRider(user.id, name, email);

            results.push({ email, password, token, userId: user.id });
            console.log(`Rider ${i}/${SEED_RIDERS} created`);

            await sleep(50);
        } catch (error) {
            console.error(`Failed to create rider ${i}:`, error.response?.data || error.message);
        }
    }

    return results;
}

async function main() {
    console.log('Starting seed...');
    console.log(`AUTH_SERVICE_URL: ${AUTH_SERVICE_URL}`);
    console.log(`DRIVER_SERVICE_URL: ${DRIVER_SERVICE_URL}`);
    console.log(`RIDER_SERVICE_URL: ${RIDER_SERVICE_URL}`);

    try {
        await seedDrivers();
        await seedRiders();
        console.log('Seed completed successfully!');
    } catch (error) {
        console.error('Seed failed:', error.message);
        process.exit(1);
    }
}

main();