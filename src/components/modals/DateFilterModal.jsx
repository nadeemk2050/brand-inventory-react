import { useState, useEffect, useRef } from "react";

export default function DateFilterModal({ isOpen, onClose, mode, onApply }) {
    // mode: 'single' | 'range'
    const [singleDate, setSingleDate] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setSingleDate("");
            setFromDate("");
            setToDate("");
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const parseDateInput = (input) => {
        // Handle "DD", "DD-MM", "DD-MM-YYYY" or standard YYYY-MM-DD
        if (!input) return null;

        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // 1-12

        // If standard YYYY-MM-DD (from date picker type='date')
        if (input.match(/^\d{4}-\d{2}-\d{2}$/)) return input;

        // Simplify parsing logic for text input (if we used type='text')
        // But for ease, let's stick to type='date' for the actual value, 
        // OR implements a smart text parser. The screenshot shows "DD or DD-MM" with text input look.
        // Let's implement smart text parser.

        const parts = input.split(/[-/.]/);

        let d, m, y;

        if (parts.length === 1) {
            // DD
            d = parseInt(parts[0]);
            m = month;
            y = year;
        } else if (parts.length === 2) {
            // DD-MM
            d = parseInt(parts[0]);
            m = parseInt(parts[1]);
            y = year;
        } else if (parts.length === 3) {
            // DD-MM-YYYY
            d = parseInt(parts[0]);
            m = parseInt(parts[1]);
            // Handle 2 digit year? Let's assume 4 for safety or 2.
            y = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
        }

        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;

        // Format to YYYY-MM-DD for comparison
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (mode === 'single') {
            const date = parseDateInput(singleDate);
            if (date) onApply({ type: 'single', date });
            else alert("Invalid Date Format"); // Or toast
        } else {
            const start = parseDateInput(fromDate);
            const end = parseDateInput(toDate);
            if (start && end) onApply({ type: 'range', start, end });
            else alert("Invalid Date Range");
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999
        }} onClick={onClose}>
            <div className="modal-content" style={{
                backgroundColor: 'white', padding: '0', borderRadius: '8px',
                width: '350px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ backgroundColor: mode === 'single' ? '#1a2e40' : '#007bff', color: 'white', padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1em' }}>
                    {mode === 'single' ? 'CHANGE DATE (F2)' : 'CHANGE PERIOD (ALT+F2)'}
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
                    {mode === 'single' ? (
                        <>
                            <div style={{ marginBottom: '15px', textAlign: 'center' }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="DD or DD-MM"
                                    value={singleDate}
                                    onChange={e => setSingleDate(e.target.value)}
                                    style={{ width: '80%', padding: '8px', textAlign: 'center', fontSize: '1.2em', border: 'none', borderBottom: '2px solid #007bff', outline: 'none' }}
                                />
                                <div style={{ marginTop: '5px', fontSize: '0.8em', color: '#888' }}>Type date & press Enter</div>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontWeight: 'bold', color: '#555', width: '50px' }}>From</label>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="DD/MM/YYYY"
                                    value={fromDate}
                                    onChange={e => setFromDate(e.target.value)}
                                    style={{ flex: 1, padding: '8px', fontSize: '1.1em', border: 'none', borderBottom: '2px solid #28a745', outline: 'none', textAlign: 'center' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontWeight: 'bold', color: '#555', width: '50px' }}>To</label>
                                <input
                                    type="text"
                                    placeholder="DD/MM/YYYY"
                                    value={toDate}
                                    onChange={e => setToDate(e.target.value)}
                                    style={{ flex: 1, padding: '8px', fontSize: '1.1em', border: 'none', borderBottom: '2px solid #28a745', outline: 'none', textAlign: 'center' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Hidden submit to allow Enter key */}
                    <button type="submit" style={{ display: 'none' }} />
                </form>
            </div>
        </div>
    );
}
