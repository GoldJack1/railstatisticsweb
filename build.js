#!/usr/bin/env node

// Build script for Netlify deployment
// This script injects environment variables into the HTML file

const fs = require('fs');
const path = require('path');

console.log('🔨 Building for production...');
console.log('📦 Node.js version:', process.version);
console.log('📁 Working directory:', process.cwd());

// Check if we're in a Netlify environment
if (process.env.NETLIFY) {
    console.log('🌐 Running in Netlify environment');
}

// List of HTML files to process
const htmlFiles = [
    'index.html',
    'upload.html', 
    'review.html',
    'matching.html',
    'export.html',
    'debug.html',
    'test-simplified-parser.html'
];

console.log('📄 Processing HTML files:', htmlFiles.join(', '));

// Load environment variables from .env.local for local testing
if (fs.existsSync('.env.local')) {
    require('dotenv').config({ path: '.env.local' });
    console.log('📄 Loaded local environment variables from .env.local');
}

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

// Process each HTML file
let processedFiles = 0;
for (const htmlFile of htmlFiles) {
    const filePath = path.join(__dirname, htmlFile);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  ${htmlFile} not found, skipping...`);
        continue;
    }
    
    let htmlContent = fs.readFileSync(filePath, 'utf8');
    
    // Insert the environment variables script before the closing </head> tag
    if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', envScript + '\n</head>');
        fs.writeFileSync(filePath, htmlContent);
        processedFiles++;
        console.log(`✅ Injected environment variables into ${htmlFile}`);
    } else {
        console.log(`⚠️  ${htmlFile} doesn't have a </head> tag, skipping...`);
    }
}

console.log('✅ Build completed successfully!');
console.log(`📦 Environment variables injected into ${processedFiles} HTML files`);
console.log('🚀 Ready for deployment');
