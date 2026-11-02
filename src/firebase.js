import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAU0AAPQyBdWDfDRw_ByPSG0ldlAWij3SE",
  authDomain: "brandsinvent-599bb.firebaseapp.com",
  projectId: "brandsinvent-599bb",
  storageBucket: "brandsinvent-599bb.firebasestorage.app",
  messagingSenderId: "699751340705",
  appId: "1:699751340705:web:dbfafbf154dffd3f7b2ee0",
  measurementId: "G-9061VJ7ZD1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
