import { doc, setDoc, updateDoc, getDoc, increment } from "firebase/firestore";
import { db, auth } from "./firebaseConfig";

export async function updateUsage(featureName: string) {
  const user = auth.currentUser;
  
  if (!user) {
    console.error("[dbUsage] Error: No authenticated user found. Update cancelled.");
    return;
  }

  console.log(`[dbUsage] Starting update for: ${featureName}, UserID: ${user.uid}`);

  const ref = doc(db, "userStats", user.uid);
  
  try {
    const snap = await getDoc(ref);

    // If the user document doesn't exist, create it with initial values
    if (!snap.exists()) {
      console.log("[dbUsage] Creating new user stats document");
      await setDoc(ref, {
        codeAnalysis: 0,
        documentSummarizer: 0,
        policyQA: 0,
        reportGenerator: 0,
        totalUsage: 0,
        updatedAt: new Date(),
      });
    }

    await updateDoc(ref, {
      [featureName]: increment(1),
      totalUsage: increment(1),
      updatedAt: new Date(),
    });
    
    console.log("[dbUsage] Database updated");
  } catch (e) {
    console.error("[dbUsage] Database write error:", e);
  }
}