import { useState } from 'react';

export default function PasswordModal({ isOpen, onClose, onSubmit }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        // Determine validity immediately or pass to parent? 
        // Parent logic is requested: "talha"
        // But to keep component clean, parent decides. 
        // I'll assume onSubmit returns true if success, false if fail?
        // Or simpler: Parent handles everything.
        onSubmit(password, (isValid) => {
            if (isValid) {
                setPassword('');
                setError('');
                onClose(); // Parent might close it, but good to reset.
            } else {
                setError('Incorrect password');
                setPassword('');
            }
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                backgroundColor: 'white', padding: '30px', borderRadius: '12px',
                width: '100%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
                <h3 style={{ marginTop: 0, color: '#333', fontSize: '1.5rem', marginBottom: '10px' }}>Security Check</h3>
                <p style={{ color: '#666', marginBottom: '20px' }}>Please enter the password to access this section.</p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        placeholder="Enter Password"
                        style={{
                            width: '100%', padding: '12px', borderRadius: '6px',
                            border: error ? '1px solid red' : '1px solid #ddd',
                            fontSize: '16px', marginBottom: '15px', outline: 'none'
                        }}
                        autoFocus
                    />
                    {error && <p style={{ color: 'dc3545', fontSize: '14px', marginTop: '-10px', marginBottom: '15px' }}>{error}</p>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>Access</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
