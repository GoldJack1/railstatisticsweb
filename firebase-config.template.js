// Firebase Configuration Template for Rail Statistics Migration Tool
// 
// This is a template file. Copy this to firebase-config.js and replace the values
// with your actual Firebase project configuration.
// 
// To get your Firebase web app config:
// 1. Go to https://console.firebase.google.com/
// 2. Select your "rail-statistics" project
// 3. Go to Project Settings > General > Your apps
// 4. Add a web app if you haven't already (look for the </> icon)
// 5. Copy the config object and replace the values below

export const firebaseConfig = {
    // Replace these with your actual Firebase web app configuration
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.region.firebasedatabase.app",
    projectId: "your-project-id",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890",
    measurementId: "G-XXXXXXXXXX"
};

// Firebase Security Rules
// Make sure your Firestore security rules allow read access to the stations collection:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /stations/{document} {
//       allow read: if true; // Allow public read access for migration tool
//     }
//   }
// }
