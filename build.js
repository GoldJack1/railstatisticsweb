#!/usr/bin/env node

// Build script for Netlify deployment
// This script injects environment variables into the HTML file

const fs = require('fs');
const path = require('path');

console.log('🔨 Building for production...');

// Read the original index.html
const indexPath = path.join(__dirname, 'index.html');
let htmlContent = fs.readFileSync(indexPath, 'utf8');

// Get environment variables
const envVars = {
    VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_DATABASE_URL: process.env.VITE_FIREBASE_DATABASE_URL,
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MEASUREMENT_ID: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Check if we have the required environment variables
const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_DATABASE_URL',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MEASUREMENT_ID'
];
const missingVars = requiredVars.filter(varName => !envVars[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n📋 To fix this:');
    console.error('1. Go to your Netlify dashboard');
    console.error('2. Navigate to Site settings > Environment variables');
    console.error('3. Add the missing variables listed above');
    console.error('4. See netlify-env-setup.md for the exact values to use');
    console.error('\n🔗 Quick setup guide: https://docs.netlify.com/environment-variables/overview/');
    process.exit(1);
}

// Inject environment variables into the HTML
const envScript = `
    <script>
        // Injected environment variables for production
        window.VITE_FIREBASE_API_KEY = "${envVars.VITE_FIREBASE_API_KEY}";
        window.VITE_FIREBASE_AUTH_DOMAIN = "${envVars.VITE_FIREBASE_AUTH_DOMAIN}";
        window.VITE_FIREBASE_DATABASE_URL = "${envVars.VITE_FIREBASE_DATABASE_URL}";
        window.VITE_FIREBASE_PROJECT_ID = "${envVars.VITE_FIREBASE_PROJECT_ID}";
        window.VITE_FIREBASE_STORAGE_BUCKET = "${envVars.VITE_FIREBASE_STORAGE_BUCKET}";
        window.VITE_FIREBASE_MESSAGING_SENDER_ID = "${envVars.VITE_FIREBASE_MESSAGING_SENDER_ID}";
        window.VITE_FIREBASE_APP_ID = "${envVars.VITE_FIREBASE_APP_ID}";
        window.VITE_FIREBASE_MEASUREMENT_ID = "${envVars.VITE_FIREBASE_MEASUREMENT_ID}";
    </script>`;

// Insert the environment variables script before the Firebase SDK script
htmlContent = htmlContent.replace(
    '<!-- Firebase SDK -->',
    envScript + '\n    <!-- Firebase SDK -->'
);

// Write the modified HTML
fs.writeFileSync(indexPath, htmlContent);

console.log('✅ Build completed successfully!');
console.log('📦 Environment variables injected into index.html');
console.log('🚀 Ready for deployment');
