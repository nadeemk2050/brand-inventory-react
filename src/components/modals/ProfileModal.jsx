import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import {
    FaUserCircle,
    FaLock,
    FaUnlock,
    FaKey,
    FaEye,
    FaEyeSlash,
    FaPhone,
    FaMapMarkerAlt,
    FaEnvelope,
    FaBuilding,
    FaExclamationTriangle
} from "react-icons/fa";

export default function ProfileModal({ isOpen, onClose }) {
    const { currentUser, userProfile, saveUserProfileData, changeUserPassword } = useAuth();
    const { showMessageBox } = useMessageBox();

    // Profile form states
    const [name, setName] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Password form states
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOldPass, setShowOldPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const isNameLocked = Boolean(userProfile?.name && userProfile.name.trim() !== "");
    const isOwner = Boolean(userProfile?.isOwner);

    useEffect(() => {
        if (isOpen && currentUser) {
            setName(userProfile?.name || "");
            setCompanyName(userProfile?.companyName || "");
            setPhone(userProfile?.phone || "");
            setAddress(userProfile?.address || "");
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setShowPasswordSection(false);
        }
    }, [isOpen, currentUser, userProfile]);

    if (!isOpen || !currentUser) return null;

    async function handleSaveProfile(e) {
        e.preventDefault();

        // If name wasn't set, validate it
        if (!isNameLocked && !name.trim()) {
            return showMessageBox("User Name Required", "Please enter a valid User Name before saving.");
        }

        setIsSavingProfile(true);
        try {
            await saveUserProfileData({
                name: !isNameLocked ? name.trim() : userProfile.name,
                companyName: isOwner ? companyName.trim() : userProfile?.companyName,
                phone: phone.trim(),
                address: address.trim()
            });

            showMessageBox(
                "Profile Updated",
                !isNameLocked
                    ? `Profile saved successfully! User Name "${name.trim()}" is now permanently locked and linked to your activity log history.`
                    : "Profile details updated successfully."
            );
        } catch (error) {
            console.error("Error saving profile:", error);
            showMessageBox("Save Error", error.message || "Failed to update profile.");
        } finally {
            setIsSavingProfile(false);
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();

        if (!oldPassword) {
            return showMessageBox("Old Password Required", "Please enter your current (old) password.");
        }
        if (!newPassword || newPassword.length < 6) {
            return showMessageBox("Password Length", "New password must be at least 6 characters long.");
        }
        if (newPassword !== confirmPassword) {
            return showMessageBox("Password Mismatch", "New password and Confirm password do not match.");
        }

        setIsUpdatingPassword(true);
        try {
            await changeUserPassword(oldPassword, newPassword);

            showMessageBox(
                "Password Changed",
                "Your password has been changed and updated successfully! Please use this new password next time you log in."
            );
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setShowPasswordSection(false);
        } catch (error) {
            console.error("Change password error:", error);
            let msg = error.message;
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                msg = "The old/current password you entered is incorrect. Please recheck and try again.";
            } else if (error.code === 'auth/weak-password') {
                msg = "The new password is too weak. Please use at least 6 characters.";
            }
            showMessageBox("Password Update Failed", msg);
        } finally {
            setIsUpdatingPassword(false);
        }
    }

    const roleBadge = userProfile?.role || (isOwner ? "Owner" : "User");

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '560px',
                    width: '92%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: '24px',
                    borderRadius: '14px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                }}
            >
                <button className="modal-close-btn" onClick={onClose}>&times;</button>

                {/* Profile Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid #e0e0e0',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        backgroundColor: isOwner ? '#fff8e1' : '#e8f0fe',
                        color: isOwner ? '#e65100' : '#1967d2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        fontWeight: 'bold',
                        border: isOwner ? '2px solid #ffb300' : '2px solid #90caf9',
                        flexShrink: 0
                    }}>
                        <FaUserCircle />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1a237e' }}>
                                User Profile Details
                            </h2>
                            <span style={{
                                backgroundColor: isOwner ? '#e65100' : '#1565c0',
                                color: '#fff',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                            }}>
                                {roleBadge}
                            </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#607d8b' }}>
                            Manage company name, profile details, and account security
                        </p>
                    </div>
                </div>

                {/* Profile Info Form */}
                <form onSubmit={handleSaveProfile}>
                    {/* Company Name Field */}
                    <div className="form-group" style={{ marginBottom: '18px' }}>
                        <label style={{ fontWeight: '600', color: '#1565c0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FaBuilding /> Company / Organization Name:
                        </label>
                        {isOwner ? (
                            <div>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Enter your Company Name (e.g. NAD TRADING)"
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '6px',
                                        border: '2px solid #90caf9',
                                        fontWeight: '600',
                                        color: '#0d47a1',
                                        backgroundColor: '#f5f9ff'
                                    }}
                                />
                                <small style={{ color: '#546e7a', fontSize: '0.78rem', display: 'block', marginTop: '4px' }}>
                                    🏢 All team members are linked under this Company Name to share products, inventory & invoices.
                                </small>
                            </div>
                        ) : (
                            <div style={{
                                padding: '10px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#e3f2fd',
                                border: '1px solid #90caf9',
                                color: '#0d47a1',
                                fontWeight: 'bold',
                                fontSize: '0.95rem'
                            }}>
                                🏢 {userProfile?.companyName || "Main Organization"}
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#546e7a', fontWeight: 'normal', marginTop: '2px' }}>
                                    (Managed by Company Administrator)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* User Name Field (Locked or One-Time) */}
                    <div className="form-group" style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontWeight: '600', color: '#37474f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                User Name:
                                {isNameLocked ? (
                                    <span style={{ color: '#2e7d32', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <FaLock size={12} /> Permanently Locked
                                    </span>
                                ) : (
                                    <span style={{ color: '#e65100', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <FaUnlock size={12} /> Set Once Only
                                    </span>
                                )}
                            </label>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full user name"
                                disabled={isNameLocked}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    border: isNameLocked ? '1px solid #cfd8dc' : '1px solid #ff9800',
                                    backgroundColor: isNameLocked ? '#f5f5f5' : '#fff',
                                    color: isNameLocked ? '#455a64' : '#000',
                                    fontWeight: isNameLocked ? '600' : 'normal',
                                    cursor: isNameLocked ? 'not-allowed' : 'text'
                                }}
                            />
                        </div>

                        {isNameLocked ? (
                            <small style={{ color: '#546e7a', fontSize: '0.78rem', display: 'block', marginTop: '4px' }}>
                                🔒 This user name cannot be changed because it is linked to all audit and log history records.
                            </small>
                        ) : (
                            <div style={{
                                backgroundColor: '#fff3e0',
                                border: '1px solid #ffe0b2',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                marginTop: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <FaExclamationTriangle color="#e65100" size={16} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.78rem', color: '#bf360c', lineHeight: '1.3' }}>
                                    <strong>Important:</strong> You can only enter your User Name <strong>ONE TIME</strong>. Once saved, it will be permanently locked and recorded in all transaction history.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Email Field (Always Read-Only) */}
                    <div className="form-group" style={{ marginBottom: '18px' }}>
                        <label style={{ fontWeight: '600', color: '#37474f' }}>
                            Email Address: <span style={{ color: '#78909c', fontSize: '0.8rem' }}>(Cannot be changed)</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="email"
                                value={currentUser.email}
                                disabled
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    paddingLeft: '34px',
                                    borderRadius: '6px',
                                    border: '1px solid #cfd8dc',
                                    backgroundColor: '#f5f5f5',
                                    color: '#546e7a',
                                    fontWeight: '500',
                                    cursor: 'not-allowed'
                                }}
                            />
                            <FaEnvelope style={{
                                position: 'absolute',
                                left: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#90a4ae'
                            }} />
                        </div>
                    </div>

                    {/* Mobile Number Field (Editable) */}
                    <div className="form-group" style={{ marginBottom: '18px' }}>
                        <label style={{ fontWeight: '600', color: '#37474f' }}>Mobile Number:</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+971 50 1234567"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    paddingLeft: '34px',
                                    borderRadius: '6px',
                                    border: '1px solid #b0bec5'
                                }}
                            />
                            <FaPhone style={{
                                position: 'absolute',
                                left: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#90a4ae'
                            }} />
                        </div>
                    </div>

                    {/* Address Field (Editable) */}
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label style={{ fontWeight: '600', color: '#37474f' }}>Address / Location:</label>
                        <div style={{ position: 'relative' }}>
                            <textarea
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Enter your business address or location"
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    paddingLeft: '34px',
                                    borderRadius: '6px',
                                    border: '1px solid #b0bec5',
                                    fontFamily: 'inherit',
                                    fontSize: '0.9rem',
                                    resize: 'vertical'
                                }}
                            />
                            <FaMapMarkerAlt style={{
                                position: 'absolute',
                                left: '10px',
                                top: '14px',
                                color: '#90a4ae'
                            }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSavingProfile}
                            style={{
                                flex: 1,
                                padding: '11px',
                                backgroundColor: '#1565c0',
                                fontWeight: 'bold',
                                fontSize: '0.95rem'
                            }}
                        >
                            {isSavingProfile ? "Saving Details..." : "Save Profile Details"}
                        </button>
                    </div>
                </form>

                {/* SECURITY & CHANGE PASSWORD SECTION */}
                <div style={{
                    borderTop: '2px dashed #cfd8dc',
                    paddingTop: '18px'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: showPasswordSection ? '15px' : '0'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaKey style={{ color: '#d32f2f' }} />
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#263238' }}>
                                Account Security & Password
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowPasswordSection(!showPasswordSection)}
                            style={{
                                background: showPasswordSection ? '#ffebee' : '#e8f0fe',
                                color: showPasswordSection ? '#c62828' : '#1967d2',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600'
                            }}
                        >
                            {showPasswordSection ? "Hide Password Form" : "Change Password"}
                        </button>
                    </div>

                    {showPasswordSection && (
                        <form onSubmit={handleChangePassword} style={{
                            backgroundColor: '#fafafa',
                            padding: '16px',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            marginTop: '10px'
                        }}>
                            {/* Old Password */}
                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label style={{ fontWeight: '600', color: '#37474f', fontSize: '0.88rem' }}>
                                    Current / Old Password:
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showOldPass ? "text" : "password"}
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                        placeholder="Enter your current password"
                                        required
                                        style={{ width: '100%', paddingRight: '38px', padding: '9px 12px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowOldPass(!showOldPass)}
                                        tabIndex="-1"
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#666',
                                            display: 'flex',
                                            padding: 0
                                        }}
                                    >
                                        {showOldPass ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label style={{ fontWeight: '600', color: '#37474f', fontSize: '0.88rem' }}>
                                    New Password: <span style={{ fontSize: '0.78rem', color: '#78909c' }}>(Min 6 characters)</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showNewPass ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new strong password"
                                        required
                                        style={{ width: '100%', paddingRight: '38px', padding: '9px 12px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPass(!showNewPass)}
                                        tabIndex="-1"
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#666',
                                            display: 'flex',
                                            padding: 0
                                        }}
                                    >
                                        {showNewPass ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: '600', color: '#37474f', fontSize: '0.88rem' }}>
                                    Confirm New Password:
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPass ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter new password"
                                        required
                                        style={{ width: '100%', paddingRight: '38px', padding: '9px 12px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                                        tabIndex="-1"
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#666',
                                            display: 'flex',
                                            padding: 0
                                        }}
                                    >
                                        {showConfirmPass ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn"
                                disabled={isUpdatingPassword}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    backgroundColor: '#2e7d32',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {isUpdatingPassword ? "Updating Password..." : "Save & Update Password"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
