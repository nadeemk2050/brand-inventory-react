import { useState, useEffect } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { db } from "../../firebase";
import { FaEdit, FaTrash, FaUserShield, FaUserPlus, FaTimes, FaExpand, FaCompress } from "react-icons/fa";

export default function ManageTeamModal({ isOpen, onClose }) {
    // ...
    const { currentUser } = useAuth();
    const { appId } = useData();
    const { showMessageBox } = useMessageBox();

    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("Sales Person");
    const [editingId, setEditingId] = useState(null);

    const roles = [
        "Sales Person",
        "Accountant",
        "Purchaser",
        "Partner (View Only)",
        "Data Entry 1",
        "Data Entry 2",
        "Data Entry 3"
    ];

    useEffect(() => {
        if (!isOpen || !currentUser) return;

        const q = query(
            collection(db, `artifacts/${appId}/users/${currentUser.uid}/team_members`),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const members = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTeamMembers(members);
        });

        return () => unsubscribe();
    }, [isOpen, currentUser, appId]);

    if (!isOpen) return null;

    // Config for creating secondary app instance to adding users without logging out admin
    const firebaseConfig = {
        apiKey: "AIzaSyAU0AAPQyBdWDfDRw_ByPSG0ldlAWij3SE",
        authDomain: "brandsinvent-599bb.firebaseapp.com",
        projectId: "brandsinvent-599bb",
        storageBucket: "brandsinvent-599bb.firebasestorage.app",
        messagingSenderId: "699751340705",
        appId: "1:699751340705:web:dbfafbf154dffd3f7b2ee0",
        measurementId: "G-9061VJ7ZD1"
    };

    async function handleSubmit(e) {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !role) {
            return showMessageBox("Error", "Please fill in all required fields.");
        }

        setLoading(true);
        let secondaryApp = null;

        try {
            const memberData = {
                name,
                email,
                password,
                role,
                updatedAt: serverTimestamp()
            };

            if (editingId) {
                // Update existing member record
                await updateDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/team_members`, editingId), memberData);
                showMessageBox("Success", "User updated successfully.");
            } else {
                // Create new Auth User using secondary app
                secondaryApp = initializeApp(firebaseConfig, "Secondary");
                const secondaryAuth = getAuth(secondaryApp);
                const secondaryDb = getFirestore(secondaryApp);

                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                const newUid = userCredential.user.uid;

                // 1. Store Owner Mapping in the User's ROOT document
                // Path: artifacts/{appId}/users/{newUid}
                // We use setDoc with merge: true just in case, though it's a new user.
                await setDoc(doc(secondaryDb, `artifacts/${appId}/users`, newUid), {
                    ownerId: currentUser.uid,
                    role: role,
                    email: email,
                    name: name,
                    isTeamMember: true
                }, { merge: true });

                // 2. Add to Admin's team list (using main db as Admin)
                memberData.uid = newUid;
                memberData.createdAt = serverTimestamp();
                await addDoc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/team_members`), memberData);

                showMessageBox("Success", "User created successfully. They can now log in.");
            }

            resetForm();
        } catch (error) {
            console.error("Error creating user:", error);
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') {
                msg = "This email is already in use by another account.";
            } else if (error.code === 'auth/weak-password') {
                msg = "Password should be at least 6 characters.";
            }
            showMessageBox("Error", "Failed to create user: " + msg);
        } finally {
            if (secondaryApp) {
                try {
                    await deleteApp(secondaryApp);
                } catch (err) {
                    console.error("Cleanup error", err);
                }
            }
            setLoading(false);
        }
    }

    function handleEdit(member) {
        setEditingId(member.id);
        setName(member.name);
        setEmail(member.email);
        setPassword(member.password || "");
        setRole(member.role);
    }

    function handleDelete(member) {
        showMessageBox(
            "Confirm Delete",
            `Are you sure you want to delete ${member.name}?`,
            "confirm",
            async () => {
                try {
                    await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/team_members`, member.id));
                    showMessageBox("Success", "User deleted.");
                } catch (error) {
                    showMessageBox("Error", "Delete failed: " + error.message);
                }
            }
        );
    }

    function resetForm() {
        setName("");
        setEmail("");
        setPassword("");
        setRole("Sales Person");
        setEditingId(null);
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '50px' }}>
            <div
                className="modal-content"
                onClick={e => e.stopPropagation()}
                style={{
                    width: isFullscreen ? '100vw' : '95%',
                    height: isFullscreen ? '100vh' : '85vh',
                    maxWidth: isFullscreen ? 'none' : '1100px',
                    margin: 0,
                    borderRadius: isFullscreen ? 0 : '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    overflow: 'hidden',
                    backgroundColor: '#f8f9fa'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '15px 25px',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#fff'
                }}>
                    <h2 style={{ margin: 0, color: '#1a237e', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaUserPlus /> Manage Team / Users
                    </h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setIsFullscreen(!isFullscreen)} className="icon-btn" title="Toggle Fullscreen">
                            {isFullscreen ? <FaCompress /> : <FaExpand />}
                        </button>
                        <button onClick={onClose} className="icon-btn" title="Close"><FaTimes /></button>
                    </div>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>

                    {/* Left Column: Create/Edit Form */}
                    <div style={{
                        flex: '1 1 400px',
                        padding: '25px',
                        overflowY: 'auto',
                        borderRight: '1px solid #e0e0e0',
                        backgroundColor: '#fff'
                    }}>
                        <h3 style={{ color: '#1565c0', marginBottom: '20px', borderBottom: '2px solid #e3f2fd', paddingBottom: '10px' }}>
                            {editingId ? "EDIT USER" : "CREATE NEW USER"}
                        </h3>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label style={{ color: '#546e7a', fontWeight: '600' }}>Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Enter full name"
                                    required
                                    style={{ borderColor: '#cfd8dc', padding: '12px' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ color: '#546e7a', fontWeight: '600' }}>Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="Enter email address"
                                    required
                                    style={{ borderColor: '#cfd8dc', padding: '12px' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ color: '#546e7a', fontWeight: '600' }}>Password</label>
                                <input
                                    type="text"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    required={!editingId}
                                    style={{ borderColor: '#cfd8dc', padding: '12px' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ color: '#546e7a', fontWeight: '600' }}>Role</label>
                                <select
                                    value={role}
                                    onChange={e => setRole(e.target.value)}
                                    style={{ borderColor: '#cfd8dc', padding: '12px', width: '100%', borderRadius: '6px', border: '1px solid #ccc' }}
                                >
                                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>

                            <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
                                <button
                                    type="submit"
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#2962ff',
                                        fontWeight: 'bold',
                                        padding: '12px',
                                        fontSize: '1em'
                                    }}
                                    disabled={loading}
                                >
                                    {loading ? "Saving..." : (editingId ? "Update User" : "Create User")}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="btn btn-secondary"
                                        style={{ width: 'auto' }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Right Column: User List */}
                    <div style={{ flex: '1 1 400px', padding: '25px', overflowY: 'auto', backgroundColor: '#f5f7fa' }}>
                        <h3 style={{ color: '#455a64', marginBottom: '20px', borderBottom: '1px solid #cfd8dc', paddingBottom: '10px' }}>
                            YOUR TEAM
                        </h3>

                        {/* Current User Card */}
                        <div style={{
                            backgroundColor: '#fff',
                            padding: '15px',
                            borderRadius: '8px',
                            border: '1px solid #1a237e',
                            marginBottom: '15px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        }}>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#1a237e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {currentUser?.displayName || currentUser?.email || "Admin"}
                                    <span style={{ height: '10px', width: '10px', backgroundColor: '#00e676', borderRadius: '50%', display: 'inline-block' }}></span>
                                </div>
                                <div style={{ color: '#78909c', fontSize: '0.9em', marginTop: '4px' }}>{currentUser?.email}</div>
                                <div style={{ marginTop: '8px' }}>
                                    <span style={{ backgroundColor: '#2962ff', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75em', fontWeight: 'bold' }}>ADMIN / OWNER</span>
                                </div>
                            </div>
                            <button className="icon-btn" style={{ color: '#2962ff', backgroundColor: '#e3f2fd' }} disabled><FaUserShield /></button>
                        </div>

                        {/* Team List */}
                        {teamMembers.map(member => (
                            <div key={member.id} style={{
                                backgroundColor: '#fff',
                                padding: '15px',
                                borderRadius: '8px',
                                border: '1px solid #e0e0e0',
                                marginBottom: '15px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                transition: 'transform 0.2s',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.05em', color: '#37474f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {member.name}
                                        <span style={{ height: '8px', width: '8px', backgroundColor: '#cfd8dc', borderRadius: '50%', display: 'inline-block' }}></span>
                                    </div>
                                    <div style={{ color: '#78909c', fontSize: '0.9em', marginTop: '4px' }}>{member.email}</div>
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '5px' }}>
                                        <span style={{ backgroundColor: '#eceff1', color: '#455a64', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75em', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            {member.role}
                                        </span>
                                        <span style={{ fontSize: '0.75em', color: '#aaa', alignSelf: 'center' }}>
                                            {member.password ? '•'.repeat(8) : ''}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleEdit(member)}
                                        style={{
                                            background: '#e3f2fd',
                                            border: 'none',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            color: '#1976d2'
                                        }}
                                        title="Edit"
                                        aria-label="Edit"
                                    >
                                        <FaEdit />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(member)}
                                        style={{
                                            background: '#ffebee',
                                            border: 'none',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            color: '#c62828'
                                        }}
                                        title="Delete"
                                        aria-label="Delete"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {teamMembers.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#b0bec5', padding: '20px', fontStyle: 'italic' }}>
                                No team members added yet.
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
