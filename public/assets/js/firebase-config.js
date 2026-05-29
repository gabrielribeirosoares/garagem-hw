// assets/js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCLT6Uf12Ycznl9eXSvCGvNo7pFbuREpGc",
  

  authDomain: "garagemhw.web.app", 
  
  projectId: "hotwheels-colletcion",
  storageBucket: "hotwheels-colletcion.firebasestorage.app",
  messagingSenderId: "94113385499",
  appId: "1:94113385499:web:72bd2f5d71e10b238cfcbe",
  measurementId: "G-9WFF81NB2T"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);