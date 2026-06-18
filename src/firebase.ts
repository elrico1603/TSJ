import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

export const firebaseConfig = {
    apiKey: "AIzaSyA4J1TVcpqNBvBoq242vXWwguAAnh3G6ks",
    authDomain: "timbersmithapp.firebaseapp.com",
    projectId: "timbersmithapp",
    storageBucket: "timbersmithapp.appspot.com",
    messagingSenderId: "1056525791334",
    appId: "1:1056525791334:web:0f4a86071477439775f0f3"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();

export const APP_ID_PATH = 'timbersmith-terminal-v1';
export const APP_MOBILE_LINK = 'https://elrico1603.github.io/TSJApp/';
