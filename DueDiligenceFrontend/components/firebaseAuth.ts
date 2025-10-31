// firebaseAuth.ts
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { app } from "./firebaseConfig";

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Sign up with email and password, update display name, and save extra profile in Firestore
export const signUp = async (
  email: string,
  password: string,
  fullName?: string,
  extraData?: { role?: string; company?: string; phone?: string; location?: string }
) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  if (fullName && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: fullName });
  }

  if (userCredential.user.uid) {
    const userDocRef = doc(db, "users", userCredential.user.uid);
    await setDoc(userDocRef, {
      fullName,
      email,
      ...extraData,
      createdAt: new Date(),
    });
  }

  return userCredential;
};

// Sign in with email and password
export const signIn = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// Sign in with Google popup and save extra details if first time login
export const signInWithGoogle = async () => {
  const userCredential = await signInWithPopup(auth, googleProvider);
  const user = userCredential.user;

  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);

  // If user's Firestore profile does not exist, create it
  if (!userDocSnap.exists()) {
    await setDoc(userDocRef, {
      fullName: user.displayName || "",
      email: user.email || "",
      createdAt: new Date(),
    });
  }

  return userCredential;
};

// Fetch user profile from Firestore by UID
export const getUserProfile = async (uid: string) => {
  const userDocRef = doc(db, "users", uid);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    return userDocSnap.data();
  } else {
    return null;
  }
};

// Update user profile in Firestore
export const updateUserProfile = async (uid: string, updatedData: any) => {
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, updatedData);
};
