import { createContext, useContext, useState, useRef } from "react";

const MessageBoxContext = createContext();

export function useMessageBox() {
    return useContext(MessageBoxContext);
}

export function MessageBoxProvider({ children }) {
    const [isVisible, setIsVisible] = useState(false);
    const [config, setConfig] = useState({
        title: "",
        content: "",
        type: "alert", // 'alert' or 'confirm'
        onConfirm: null,
        onCancel: null,
        showPasswordInput: false,
    });
    const [password, setPassword] = useState("");
    const passwordInputRef = useRef(null);

    function showMessageBox(title, content, type = 'alert', onConfirm = null, onCancel = null, showPasswordInput = false, expectedPassword = "usama123") {
        setConfig({
            title,
            content,
            type,
            onConfirm,
            onCancel,
            showPasswordInput,
            expectedPassword
        });
        setPassword("");
        setIsVisible(true);
        if (showPasswordInput) {
            setTimeout(() => passwordInputRef.current?.focus(), 100);
        }
    }

    function handleConfirm() {
        // Simple check logic
        if (config.showPasswordInput) {
            if (password === config.expectedPassword) {
                setIsVisible(false);
                if (config.onConfirm) config.onConfirm();
            } else {
                alert("Incorrect password.");
                setPassword("");
            }
        } else {
            setIsVisible(false);
            if (config.onConfirm) config.onConfirm();
        }
    }

    function handleCancel() {
        setIsVisible(false);
        if (config.onCancel) config.onCancel();
    }

    return (
        <MessageBoxContext.Provider value={{ showMessageBox }}>
            {children}
            {isVisible && (
                <div className="message-box-overlay" style={{ display: 'flex' }}>
                    <div className="message-box">
                        <h3>{config.title}</h3>
                        <p>{config.content}</p>
                        {config.showPasswordInput && (
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
                                <input
                                    type="password"
                                    ref={passwordInputRef}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                                />
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            {config.type === 'confirm' ? (
                                <>
                                    <button className="btn btn-success" onClick={handleConfirm}>Confirm</button>
                                    <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                                </>
                            ) : (
                                <button className="btn" onClick={handleConfirm}>OK</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </MessageBoxContext.Provider>
    );
}
