import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAKG-JpfyGP_h_efAPbL0duGrUVDhgtheI",
    authDomain: "ecoexpresswater.firebaseapp.com",
    projectId: "ecoexpresswater",
    storageBucket: "ecoexpresswater.firebasestorage.app",
    messagingSenderId: "86029449483",
    appId: "1:86029449483:web:235a762bfb3eb509ae8a0e",
    measurementId: "G-81FL6EXMSE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
