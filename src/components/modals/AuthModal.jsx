import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { FaEye, FaEyeSlash, FaKey, FaArrowLeft, FaEnvelope } from "react-icons/fa";

export default function AuthModal({ isOpen, onClose, onOpenProfile }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { login, signup, currentUser, userProfile, logout, resetPassword } = useAuth();
    const { showMessageBox } = useMessageBox();

    if (!isOpen) return null;

    function getErrorMessage(error) {
        console.error("Auth Error:", error);
        switch (error.code) {
            case 'auth/invalid-email':
                return "Invalid email address.";
            case 'auth/user-disabled':
                return "This user has been disabled.";
            case 'auth/user-not-found':
                return "No account found with this email. Please check the spelling or Sign Up.";
            case 'auth/wrong-password':
                return "Incorrect password.";
            case 'auth/weak-password':
                return "Password should be at least 6 characters.";
            case 'auth/email-already-in-use':
                return "Email is already in use by another account.";
            case 'auth/invalid-credential':
                return "Invalid credentials. Please verify your email and password.";
            case 'auth/too-many-requests':
                return "Too many failed attempts. Please try again later or reset your password.";
            default:
                return error.message || "An authentication error occurred.";
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        if (!email.trim() || !password) return showMessageBox("Error", "Please fill in all fields.");

        setIsLoading(true);
        try {
            await login(email.trim(), password);
            onClose();
        } catch (error) {
            console.error("Login Handler Error:", error);
            const msg = error.code === 'auth/invalid-credential'
                ? "Invalid credentials. Please check for typos in your email or password."
                : getErrorMessage(error);

            showMessageBox("Login Error", msg);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSignup(e) {
        e.preventDefault();
        if (!email.trim() || !password) return showMessageBox("Error", "Please fill in all fields.");
        if (password.length < 6) return showMessageBox("Error", "Password must be at least 6 characters.");

        setIsLoading(true);
        try {
            await signup(email.trim(), password);
            showMessageBox("Success", "Account created successfully! You are now logged in.");
            onClose();
        } catch (error) {
            showMessageBox("Signup Error", getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }

    async function handleForgotPassword(e) {
        e.preventDefault();
        if (!email.trim()) {
            return showMessageBox("Email Required", "Please enter your email address to receive the password reset link.");
        }

        setIsLoading(true);
        try {
            await resetPassword(email.trim());
            showMessageBox(
                "Reset Link Sent",
                `A password reset email has been sent to ${email.trim()}. Please check your inbox (and spam folder) to set your new password.`
            );
            setIsForgotPassword(false);
        } catch (error) {
            showMessageBox("Reset Password Error", getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }

    async function handleLogout() {
        setIsLoading(true);
        try {
            await logout();
            showMessageBox("Success", "Logged out successfully.");
            onClose();
        } catch (error) {
            showMessageBox("Logout Error", error.message);
        } finally {
            setIsLoading(false);
        }
    }

    // When already logged in
    if (currentUser) {
        const displayName = userProfile?.name || (userProfile?.isOwner ? "Owner" : "User");
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                    <h2 style={{ marginBottom: '15px', color: '#1a237e' }}>User Account</h2>
                    <div id="user-info" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                        <div style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '50%',
                            backgroundColor: userProfile?.isOwner ? '#fff8e1' : '#e3f2fd',
                            color: userProfile?.isOwner ? '#f57f17' : '#1976d2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.6rem',
                            fontWeight: 'bold',
                            border: '2px solid currentColor'
                        }}>
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.15rem', color: '#333' }}>
                                {displayName}
                            </div>
                            <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '2px' }}>
                                {currentUser.email}
                            </div>
                            <div style={{ marginTop: '6px' }}>
                                <span style={{
                                    backgroundColor: userProfile?.isOwner ? '#e65100' : '#1565c0',
                                    color: '#fff',
                                    padding: '3px 8px',
                                    borderRadius: '10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase'
                                }}>
                                    {userProfile?.role || (userProfile?.isOwner ? "Owner" : "User")}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '15px' }}>
                            {onOpenProfile && (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ flex: 1, backgroundColor: '#1976d2' }}
                                    onClick={() => {
                                        onClose();
                                        onOpenProfile();
                                    }}
                                >
                                    My Profile & Security
                                </button>
                            )}
                            <button
                                className="btn btn-danger"
                                id="logout-btn"
                                onClick={handleLogout}
                                disabled={isLoading}
                                style={{ flex: 1 }}
                            >
                                {isLoading ? "Logging Out..." : "Log Out"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>

                {isForgotPassword ? (
                    /* FORGOT PASSWORD VIEW */
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <button
                                type="button"
                                onClick={() => setIsForgotPassword(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#1976d2',
                                    fontSize: '1.1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px'
                                }}
                                title="Back to Login"
                            >
                                <FaArrowLeft />
                            </button>
                            <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1a237e' }}>Reset Password</h2>
                        </div>

                        <p style={{ fontSize: '0.88rem', color: '#555', marginBottom: '20px', lineHeight: '1.4' }}>
                            Enter your registered email address below. We will send you an email containing a link to reset your password.
                        </p>

                        <form onSubmit={handleForgotPassword}>
                            <div className="form-group">
                                <label htmlFor="reset-email" style={{ fontWeight: '600', color: '#37474f' }}>
                                    Your Email Address:
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="email"
                                        id="reset-email"
                                        placeholder="Enter your registered email"
                                        required
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        style={{ width: '100%', paddingLeft: '36px' }}
                                    />
                                    <FaEnvelope style={{
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: '#888'
                                    }} />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn"
                                style={{
                                    width: '100%',
                                    marginTop: '15px',
                                    backgroundColor: '#e65100',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    padding: '12px'
                                }}
                                disabled={isLoading}
                            >
                                {isLoading ? "Sending Reset Email..." : "Send Reset Link to Email"}
                            </button>

                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsForgotPassword(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#1976d2',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Remembered your password? Back to Login
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    /* MAIN LOGIN VIEW */
                    <div>
                        <h2 style={{ textAlign: 'center', color: '#1a237e', marginBottom: '20px' }}>User Authentication</h2>
                        <form id="auth-form" onSubmit={handleLogin}>
                            <div className="form-group">
                                <label htmlFor="auth-email" style={{ fontWeight: '600', color: '#37474f' }}>Email:</label>
                                <input
                                    type="email"
                                    id="auth-email"
                                    placeholder="Enter your email"
                                    required
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label htmlFor="auth-password" style={{ fontWeight: '600', color: '#37474f' }}>Password:</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotPassword(true)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#d32f2f',
                                            fontSize: '0.82rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="auth-password"
                                        placeholder="Enter your password"
                                        required
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ width: '100%', paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex="-1"
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#666',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: 0
                                        }}
                                        title={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div id="auth-buttons" style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    id="signup-btn"
                                    onClick={handleSignup}
                                    disabled={isLoading}
                                    style={{ flex: 1 }}
                                >
                                    {isLoading ? "Please wait..." : "Sign Up"}
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    id="login-btn"
                                    disabled={isLoading}
                                    style={{ flex: 1, backgroundColor: '#2962ff' }}
                                >
                                    {isLoading ? "Logging In..." : "Log In"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
