// Updated cron schedule
const cron = require('node-cron');

// Run every Monday at 14:00 (6:00 AM PST)
cron.schedule('0 14 * * 1', () => {
    console.log('Cron job executed on Monday at 6:00 AM PST');
});

// Rest of the bot.js code
