// config.js - Configuration that works without build tools
const CONFIG = {
    firebase: {
        apiKey: "AIzaSyDMRi-j71wruX5UPFg1kB2pbB99q0Sp9qk",
        authDomain: "b-buddy-4c0a7.firebaseapp.com",
        databaseURL: "https://b-buddy-4c0a7-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "b-buddy-4c0a7",
        storageBucket: "b-buddy-4c0a7.firebasestorage.app",
        messagingSenderId: "1046417860101",
        appId: "1:1046417860101:web:80dd34f12c5dc06dd65e6c",
        measurementId: "G-39M5NFMMMQ"
    },
    
    gemini: {
        apiKey: "AIzaSyBqF5J9rGpKAZo0uIUnXonyHDMHRcsMT9M"
    },
    
    // Automatically detect if running locally or on Vercel
    getApiUrl: function() {
        if (typeof window !== 'undefined') {
            return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000'
                : 'https://vercel-backend-mu-two.vercel.app';
        }
        return 'https://vercel-backend-mu-two.vercel.app';
    }
};