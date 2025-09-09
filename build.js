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
    
    // Environment variables to inject
    const envVars = {
        'FIREBASE_API_KEY': process.env.VITE_FIREBASE_API_KEY,
        'FIREBASE_AUTH_DOMAIN': process.env.VITE_FIREBASE_AUTH_DOMAIN,
        'FIREBASE_DATABASE_URL': process.env.VITE_FIREBASE_DATABASE_URL,
        'FIREBASE_PROJECT_ID': process.env.VITE_FIREBASE_PROJECT_ID,
        'FIREBASE_STORAGE_BUCKET': process.env.VITE_FIREBASE_STORAGE_BUCKET,
        'FIREBASE_MESSAGING_SENDER_ID': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        'FIREBASE_APP_ID': process.env.VITE_FIREBASE_APP_ID,
        'FIREBASE_MEASUREMENT_ID': process.env.VITE_FIREBASE_MEASUREMENT_ID
    };
    
    // Process HTML files
    const htmlFiles = ['index.html', 'fbstationtest.html'];
    
    htmlFiles.forEach(fileName => {
        const filePath = path.join(__dirname, fileName);
        if (fs.existsSync(filePath)) {
            console.log(`📄 Processing ${fileName}...`);
            let htmlContent = fs.readFileSync(filePath, 'utf8');
            
            // Replace placeholder values with environment variables
            Object.entries(envVars).forEach(([key, value]) => {
                if (value) {
                    const placeholder = `"{{${key}}}"`;
                    htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), `"${value}"`);
                    console.log(`✅ Injected ${key} into ${fileName}`);
                }
            });
            
            // Write the updated HTML file
            fs.writeFileSync(filePath, htmlContent);
        }
    });
    
    console.log('✅ Environment variables injected successfully');
} else {
    console.log('🔧 Development build - using local configuration');
}

console.log('🎉 Build completed successfully!');
console.log('📁 Ready to serve from:', __dirname);
