import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAKG-JpfyGP_h_efAPbL0duGrUVDhgtheI",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ecoexpresswater.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ecoexpresswater",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ecoexpresswater.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "86029449483",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:86029449483:web:235a762bfb3eb509ae8a0e",
    measurementId: (import.meta.env as any).VITE_FIREBASE_MEASUREMENT_ID || "G-81FL6EXMSE"
};


const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific settings to avoid hanging
// experimentalForceLongPolling is often required when WebSockets are blocked or unstable
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});
