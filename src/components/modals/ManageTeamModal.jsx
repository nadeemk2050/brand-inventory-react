import { useState, useEffect } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { db } from "../../firebase";
import { FaEdit, FaTrash, FaUserShield, FaUserPlus, FaTimes, FaArrowLeft, FaUsers, FaBuilding, FaCheck } from "react-icons/fa";

export default function ManageTeamModal({ isOpen, onClose }) {
    const { currentUser, userProfile } = useAuth();
    const { appId } = useData();
    const { showMessageBox } = useMessageBox();

    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("form"); // "form" | "list"

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

    // Config for creating secondary app instance to add users without logging out admin
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
            const currentCompany = userProfile?.companyName || "";
            const memberData = {
                name: name.trim(),
                email: email.trim(),
                password,
                role,
                companyName: currentCompany,
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

                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
                const newUid = userCredential.user.uid;

                // 1. Store Owner Mapping in the User's ROOT document
                // Path: artifacts/{appId}/users/{newUid}
                await setDoc(doc(secondaryDb, `artifacts/${appId}/users`, newUid), {
                    ownerId: currentUser.uid,
                    companyName: currentCompany,
                    role: role,
                    email: email.trim(),
                    name: name.trim(),
                    isTeamMember: true
                }, { merge: true });

                // 2. Add to Admin's team list (using main db as Admin)
                memberData.uid = newUid;
                memberData.createdAt = serverTimestamp();
                await addDoc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/team_members`), memberData);

                showMessageBox("Success", "User created successfully. They can now log in.");
            }

            resetForm();
            setActiveTab("list"); // Switch to list view so user immediately sees results on mobile
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
        setName(member.name || "");
        setEmail(member.email || "");
        setPassword(member.password || "");
        setRole(member.role || "Sales Person");
        setActiveTab("form"); // Switch to form tab so user can immediately edit on mobile
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

    const companyDisplayName = userProfile?.companyName || "NAD STOCK";

    return (
        <div className="manage-team-fullpage" onClick={onClose}>
            <div className="manage-team-container" onClick={e => e.stopPropagation()}>
                {/* Full-Bleed Top Header */}
                <div className="manage-team-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <button
                            onClick={onClose}
                            className="btn-icon"
                            style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '50%',
                                width: '38px',
                                height: '38px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#1e293b',
                                flexShrink: 0
                            }}
                            title="Back / Close"
                            aria-label="Back"
                        >
                            <FaArrowLeft size={16} />
                        </button>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <h2 style={{
                                    margin: 0,
                                    fontSize: '1.25rem',
                                    color: '#0f172a',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <FaUsers color="#2563eb" /> Manage Team / Users
                                </h2>
                                <span style={{
                                    backgroundColor: '#dbeafe',
                                    color: '#1d4ed8',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {teamMembers.length} {teamMembers.length === 1 ? 'Member' : 'Members'}
                                </span>
                            </div>
                            <div style={{
                                fontSize: '0.8rem',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                marginTop: '2px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                <span>🏢 Company:</span>
                                <strong style={{ color: '#0f172a' }}>{companyDisplayName}</strong>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="btn-icon"
                        style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '50%',
                            width: '38px',
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748b',
                            flexShrink: 0
                        }}
                        title="Close"
                        aria-label="Close"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* Mobile Responsive Navigation Tabs */}
                <div className="manage-team-tabs">
                    <button
                        className={`manage-team-tab-btn ${activeTab === 'form' ? 'active' : ''}`}
                        onClick={() => setActiveTab('form')}
                    >
                        <FaUserPlus /> {editingId ? "Edit User" : "Add User"}
                    </button>
                    <button
                        className={`manage-team-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveTab('list')}
                    >
                        <FaUsers /> Team List ({teamMembers.length})
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="manage-team-content">

                    {/* Column 1: Create / Edit User Form */}
                    <div className={`manage-team-col-form ${activeTab === 'form' ? 'tab-active' : ''}`}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            padding: '20px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '16px',
                                borderBottom: '2px solid #eff6ff',
                                paddingBottom: '10px'
                            }}>
                                <h3 style={{
                                    margin: 0,
                                    color: '#1d4ed8',
                                    fontSize: '1.1rem',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <FaUserPlus size={16} />
                                    {editingId ? "EDIT TEAM MEMBER" : "CREATE NEW USER"}
                                </h3>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        style={{
                                            fontSize: '0.8rem',
                                            color: '#dc2626',
                                            background: '#fee2e2',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '4px 10px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                        }}
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label style={{ color: '#334155', fontWeight: '600', fontSize: '0.9rem', marginBottom: '6px' }}>
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Enter member's full name"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '16px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label style={{ color: '#334155', fontWeight: '600', fontSize: '0.9rem', marginBottom: '6px' }}>
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="Enter member's login email"
                                        required
                                        disabled={Boolean(editingId)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '16px',
                                            boxSizing: 'border-box',
                                            backgroundColor: editingId ? '#f1f5f9' : '#fff'
                                        }}
                                    />
                                    {editingId && (
                                        <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                                            Email cannot be modified once registered.
                                        </small>
                                    )}
                                </div>

                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label style={{ color: '#334155', fontWeight: '600', fontSize: '0.9rem', marginBottom: '6px' }}>
                                        {editingId ? "Password (Leave blank to keep current)" : "Password *"}
                                    </label>
                                    <input
                                        type="text"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder={editingId ? "Enter new password or leave blank" : "Enter minimum 6 characters"}
                                        required={!editingId}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '16px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ color: '#334155', fontWeight: '600', fontSize: '0.9rem', marginBottom: '6px' }}>
                                        Role / Designation *
                                    </label>
                                    <select
                                        value={role}
                                        onChange={e => setRole(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '16px',
                                            boxSizing: 'border-box',
                                            backgroundColor: '#fff'
                                        }}
                                    >
                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>

                                <div style={{
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    marginBottom: '20px',
                                    fontSize: '0.82rem',
                                    color: '#166534',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <FaBuilding color="#16a34a" size={14} style={{ flexShrink: 0 }} />
                                    <span>
                                        This user will be linked under <strong>{companyDisplayName}</strong> and can view/manage shared inventory.
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="submit"
                                        className="btn"
                                        style={{
                                            flex: 1,
                                            backgroundColor: '#2563eb',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            padding: '14px',
                                            fontSize: '1rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                                        }}
                                        disabled={loading}
                                    >
                                        {loading ? "Processing..." : (editingId ? "Update User" : "Create User")}
                                    </button>
                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="btn btn-secondary"
                                            style={{
                                                padding: '14px 20px',
                                                borderRadius: '8px'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Column 2: Team Members List */}
                    <div className={`manage-team-col-list ${activeTab === 'list' ? 'tab-active' : ''}`}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px'
                        }}>
                            <h3 style={{
                                margin: 0,
                                color: '#334155',
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <FaUsers color="#64748b" /> TEAM MEMBERS
                            </h3>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setActiveTab('form');
                                }}
                                style={{
                                    backgroundColor: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '0.82rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <FaUserPlus size={12} /> Add New
                            </button>
                        </div>

                        {/* Current User (Owner/Admin) Card */}
                        <div style={{
                            backgroundColor: '#ffffff',
                            padding: '16px',
                            borderRadius: '12px',
                            border: '2px solid #2563eb',
                            marginBottom: '14px',
                            boxShadow: '0 2px 6px rgba(37,99,235,0.08)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{
                                    fontWeight: 'bold',
                                    fontSize: '1.05rem',
                                    color: '#0f172a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {userProfile?.name || currentUser?.displayName || "Admin / Owner"}
                                    </span>
                                    <span style={{
                                        height: '9px',
                                        width: '9px',
                                        backgroundColor: '#10b981',
                                        borderRadius: '50%',
                                        display: 'inline-block',
                                        flexShrink: 0
                                    }} title="Active Administrator"></span>
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '3px', wordBreak: 'break-all' }}>
                                    {currentUser?.email}
                                </div>
                                <div style={{
                                    color: '#1e40af',
                                    fontSize: '0.82rem',
                                    fontWeight: '600',
                                    marginTop: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <FaBuilding size={12} /> {companyDisplayName}
                                </div>
                                <div style={{ marginTop: '8px' }}>
                                    <span style={{
                                        backgroundColor: '#2563eb',
                                        color: '#ffffff',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        fontWeight: '700',
                                        letterSpacing: '0.5px'
                                    }}>
                                        ADMIN / OWNER
                                    </span>
                                </div>
                            </div>
                            <div style={{
                                background: '#eff6ff',
                                color: '#2563eb',
                                padding: '10px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <FaUserShield size={20} />
                            </div>
                        </div>

                        {/* Team Members List */}
                        {teamMembers.map(member => (
                            <div
                                key={member.id}
                                style={{
                                    backgroundColor: '#ffffff',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    marginBottom: '12px',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: '10px'
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        fontWeight: '700',
                                        fontSize: '1rem',
                                        color: '#1e293b',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {member.name}
                                        </span>
                                        <span style={{
                                            height: '8px',
                                            width: '8px',
                                            backgroundColor: '#94a3b8',
                                            borderRadius: '50%',
                                            display: 'inline-block',
                                            flexShrink: 0
                                        }}></span>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '3px', wordBreak: 'break-all' }}>
                                        {member.email}
                                    </div>
                                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            backgroundColor: '#f1f5f9',
                                            color: '#334155',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            textTransform: 'uppercase'
                                        }}>
                                            {member.role}
                                        </span>
                                        {member.password && (
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                Password: ••••••••
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    <button
                                        onClick={() => handleEdit(member)}
                                        style={{
                                            background: '#eff6ff',
                                            border: '1px solid #bfdbfe',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            color: '#1d4ed8',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.82rem',
                                            fontWeight: '600'
                                        }}
                                        title="Edit Member"
                                        aria-label="Edit Member"
                                    >
                                        <FaEdit size={14} /> <span>Edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(member)}
                                        style={{
                                            background: '#fef2f2',
                                            border: '1px solid #fecaca',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            color: '#b91c1c',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.82rem',
                                            fontWeight: '600'
                                        }}
                                        title="Delete Member"
                                        aria-label="Delete Member"
                                    >
                                        <FaTrash size={14} /> <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {teamMembers.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                color: '#64748b',
                                padding: '40px 20px',
                                backgroundColor: '#ffffff',
                                borderRadius: '12px',
                                border: '2px dashed #cbd5e1'
                            }}>
                                <FaUsers size={36} color="#94a3b8" style={{ marginBottom: '10px' }} />
                                <div style={{ fontWeight: '600', fontSize: '1rem', color: '#334155' }}>
                                    No team members added yet
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '8px 0 16px' }}>
                                    Add members so they can log in from their own devices and manage inventory.
                                </p>
                                <button
                                    onClick={() => setActiveTab('form')}
                                    style={{
                                        backgroundColor: '#2563eb',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '10px 18px',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    + Add First Team Member
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
