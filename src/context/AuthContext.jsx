import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword,
    updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs, updateDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const appId = "brandsinvent-599bb";

    function signup(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    function logout() {
        return signOut(auth);
    }

    function resetPassword(email) {
        return sendPasswordResetEmail(auth, email);
    }

    async function changeUserPassword(oldPassword, newPassword) {
        if (!auth.currentUser || !auth.currentUser.email) {
            throw new Error("No authenticated user found.");
        }
        // Re-authenticate user with old password
        const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);

        // Update password
        await updatePassword(auth.currentUser, newPassword);

        // If user is a team member, update their password in the team list doc
        if (userProfile?.ownerId && userProfile.ownerId !== auth.currentUser.uid) {
            try {
                const teamRef = collection(db, `artifacts/${appId}/users/${userProfile.ownerId}/team_members`);
                const q = query(teamRef, where("email", "==", auth.currentUser.email));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    await updateDoc(snap.docs[0].ref, {
                        password: newPassword,
                        updatedAt: serverTimestamp()
                    });
                }
            } catch (err) {
                console.warn("Could not sync team member stored password:", err);
            }
        }
    }

    async function saveUserProfileData({ name, companyName, phone, address }) {
        if (!auth.currentUser) throw new Error("User not logged in.");

        const uid = auth.currentUser.uid;
        const userDocRef = doc(db, `artifacts/${appId}/users`, uid);

        const updates = {
            email: auth.currentUser.email,
            phone: phone || "",
            address: address || "",
            updatedAt: serverTimestamp()
        };

        // Company Name
        if (companyName !== undefined) {
            updates.companyName = companyName.trim();
        }

        // Name can only be set ONCE. If it's not locked yet and provided:
        const currentHasName = Boolean(userProfile?.name && userProfile.name.trim() !== "");
        if (!currentHasName && name && name.trim() !== "") {
            updates.name = name.trim();
            updates.nameLocked = true;

            // Also update Firebase Auth displayName
            try {
                await updateProfile(auth.currentUser, { displayName: name.trim() });
            } catch (err) {
                console.warn("Could not update auth displayName:", err);
            }
        }

        // If this is owner's doc and didn't have ownerId set
        if (!userProfile?.ownerId || userProfile.ownerId === uid) {
            updates.ownerId = uid;
            updates.isOwner = true;
        }

        await setDoc(userDocRef, updates, { merge: true });

        // If owner and companyName is updated, propagate companyName to all team members
        if ((!userProfile?.ownerId || userProfile.ownerId === uid) && updates.companyName !== undefined) {
            try {
                const teamRef = collection(db, `artifacts/${appId}/users/${uid}/team_members`);
                const snap = await getDocs(teamRef);
                const batchPromises = snap.docs.map(async (memberDoc) => {
                    await updateDoc(memberDoc.ref, { companyName: updates.companyName });
                    const memberData = memberDoc.data();
                    if (memberData.uid) {
                        const memberUserDoc = doc(db, `artifacts/${appId}/users`, memberData.uid);
                        await setDoc(memberUserDoc, { companyName: updates.companyName }, { merge: true });
                    }
                });
                await Promise.all(batchPromises);
            } catch (err) {
                console.warn("Could not propagate companyName to team:", err);
            }
        }

        // If team member, also update name/phone/address in team_members collection
        if (userProfile?.ownerId && userProfile.ownerId !== uid) {
            try {
                const teamRef = collection(db, `artifacts/${appId}/users/${userProfile.ownerId}/team_members`);
                const q = query(teamRef, where("email", "==", auth.currentUser.email));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const memberUpdates = {
                        phone: phone || "",
                        address: address || "",
                        updatedAt: serverTimestamp()
                    };
                    if (updates.name) memberUpdates.name = updates.name;
                    await updateDoc(snap.docs[0].ref, memberUpdates);
                }
            } catch (err) {
                console.warn("Could not sync team member details:", err);
            }
        }
    }

    useEffect(() => {
        let unsubscribeUserDoc = () => {};

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                const userDocRef = doc(db, `artifacts/${appId}/users`, user.uid);

                // Initial verification: check if this user is a team member by query if doc doesn't exist
                try {
                    const initialSnap = await getDoc(userDocRef);
                    if (!initialSnap.exists() || !initialSnap.data().ownerId) {
                        // Check if this user was created in any owner's team_members list
                        // Search by user email
                        const usersRef = collection(db, `artifacts/${appId}/users`);
                        const ownersSnap = await getDocs(usersRef);
                        for (const oDoc of ownersSnap.docs) {
                            const teamCol = collection(db, `artifacts/${appId}/users/${oDoc.id}/team_members`);
                            const tmQuery = query(teamCol, where("email", "==", user.email));
                            const tmSnap = await getDocs(tmQuery);
                            if (!tmSnap.empty) {
                                const tmData = tmSnap.docs[0].data();
                                const ownerData = oDoc.data();
                                await setDoc(userDocRef, {
                                    ownerId: oDoc.id,
                                    companyName: tmData.companyName || ownerData.companyName || "",
                                    role: tmData.role || "Team Member",
                                    name: tmData.name || "",
                                    isTeamMember: true,
                                    email: user.email
                                }, { merge: true });
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.warn("User auto-link check error:", e);
                }

                unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const isOwner = !data.ownerId || data.ownerId === user.uid;
                        setUserProfile({
                            uid: user.uid,
                            email: user.email,
                            name: data.name || user.displayName || "",
                            companyName: data.companyName || "",
                            nameLocked: Boolean(data.name && data.name.trim() !== ""),
                            role: data.role || (isOwner ? "Owner" : "Team Member"),
                            ownerId: data.ownerId || user.uid,
                            isOwner: isOwner,
                            isTeamMember: Boolean(data.isTeamMember),
                            phone: data.phone || "",
                            address: data.address || "",
                            ...data
                        });
                    } else {
                        // User document doesn't exist yet -> Default to Owner
                        setUserProfile({
                            uid: user.uid,
                            email: user.email,
                            name: user.displayName || "",
                            companyName: "",
                            nameLocked: Boolean(user.displayName && user.displayName.trim() !== ""),
                            role: "Owner",
                            ownerId: user.uid,
                            isOwner: true,
                            isTeamMember: false,
                            phone: "",
                            address: ""
                        });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error listening to user profile:", error);
                    // Fallback to basic profile so the app doesn't break
                    setUserProfile(prev => prev || {
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName || "",
                        companyName: "",
                        role: "Owner",
                        ownerId: user.uid,
                        isOwner: true
                    });
                    setLoading(false);
                });
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeUserDoc();
        };
    }, []);

    const value = {
        currentUser,
        userProfile,
        signup,
        login,
        logout,
        resetPassword,
        changeUserPassword,
        saveUserProfileData
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
