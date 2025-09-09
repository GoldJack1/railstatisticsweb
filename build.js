#!/usr/bin/env node

/**
 * Simple build script for Rail Statistics Landing Page
 * This script handles environment variable injection for production builds
 */

const fs = require('fs');
const path = require('path');

console.log('🚂 Building Rail Statistics Landing Page...');

// Check if we're in a production environment (Netlify)
const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';

if (isProduction) {
    console.log('📦 Production build detected - injecting environment variables...');
    
    // Read the index.html file
    const indexPath = path.join(__dirname, 'index.html');
    let htmlContent = fs.readFileSync(indexPath, 'utf8');
    
    // Inject environment variables if they exist
    const envVars = {
        'VITE_FIREBASE_API_KEY': process.env.VITE_FIREBASE_API_KEY,
        'VITE_FIREBASE_AUTH_DOMAIN': process.env.VITE_FIREBASE_AUTH_DOMAIN,
        'VITE_FIREBASE_DATABASE_URL': process.env.VITE_FIREBASE_DATABASE_URL,
        'VITE_FIREBASE_PROJECT_ID': process.env.VITE_FIREBASE_PROJECT_ID,
        'VITE_FIREBASE_STORAGE_BUCKET': process.env.VITE_FIREBASE_STORAGE_BUCKET,
        'VITE_FIREBASE_MESSAGING_SENDER_ID': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        'VITE_FIREBASE_APP_ID': process.env.VITE_FIREBASE_APP_ID,
        'VITE_FIREBASE_MEASUREMENT_ID': process.env.VITE_FIREBASE_MEASUREMENT_ID
    };
    
    // Replace placeholder values with environment variables
    Object.entries(envVars).forEach(([key, value]) => {
        if (value) {
            const placeholder = `"YOUR_${key}_HERE"`;
            htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), `"${value}"`);
            console.log(`✅ Injected ${key}`);
        }
    });
    
    // Write the updated HTML file
    fs.writeFileSync(indexPath, htmlContent);
    console.log('✅ Environment variables injected successfully');
} else {
    console.log('🔧 Development build - using local configuration');
}

console.log('🎉 Build completed successfully!');
console.log('📁 Ready to serve from:', __dirname);
