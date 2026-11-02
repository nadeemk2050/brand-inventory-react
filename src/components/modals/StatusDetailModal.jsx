import { useState, useEffect } from "react";

export default function StatusDetailModal({ isOpen, onClose, title, data, onSave, isUndo }) {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        remarks: "",
        shippedBy: "",
        charges: "",
        whoPaid: "",
        deliveredBy: "",
        undoCause: ""
    });

    useEffect(() => {
        if (isOpen && data) {
            setFormData(prev => ({ ...prev, ...data, undoCause: "" }));
        } else if (isOpen) {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                remarks: "",
                shippedBy: "",
                charges: "",
                whoPaid: "",
                deliveredBy: "",
                undoCause: ""
            });
        }
    }, [isOpen, data]);

    if (!isOpen) return null;

    const renderFields = () => {
        if (isUndo) {
            return (
                <div className="form-group">
                    <label style={{ color: '#dc3545', fontWeight: 'bold' }}>Reason for Undoing {title}:</label>
                    <textarea
                        value={formData.undoCause}
                        onChange={e => setFormData({ ...formData, undoCause: e.target.value })}
                        placeholder="Enter the cause for unchecking this status..."
                        rows="4"
                        required
                    />
                </div>
            );
        }

        switch (title) {
            case 'Packed':
                return (
                    <>
                        <div className="form-group"><label>Date:</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
                        <div className="form-group"><label>Remarks:</label><textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} /></div>
                    </>
                );
            case 'Shipped':
                return (
                    <>
                        <div className="form-group"><label>Date:</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
                        <div className="form-group"><label>Shipped By:</label><input type="text" value={formData.shippedBy} onChange={e => setFormData({ ...formData, shippedBy: e.target.value })} /></div>
                        <div className="form-group"><label>Charges:</label><input type="number" value={formData.charges} onChange={e => setFormData({ ...formData, charges: e.target.value })} /></div>
                        <div className="form-group"><label>Who Paid:</label><input type="text" value={formData.whoPaid} onChange={e => setFormData({ ...formData, whoPaid: e.target.value })} /></div>
                        <div className="form-group"><label>Remarks:</label><textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} /></div>
                    </>
                );
            case 'Delivered':
                return (
                    <>
                        <div className="form-group"><label>Date:</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
                        <div className="form-group"><label>Who Delivered:</label><input type="text" value={formData.deliveredBy} onChange={e => setFormData({ ...formData, deliveredBy: e.target.value })} /></div>
                        <div className="form-group"><label>Charges:</label><input type="number" value={formData.charges} onChange={e => setFormData({ ...formData, charges: e.target.value })} /></div>
                        <div className="form-group"><label>Who Paid:</label><input type="text" value={formData.whoPaid} onChange={e => setFormData({ ...formData, whoPaid: e.target.value })} /></div>
                        <div className="form-group"><label>Remarks:</label><textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} /></div>
                    </>
                );
            default:
                return <p>No details required.</p>;
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
        }}>
            <div className="modal-content" style={{
                backgroundColor: 'white', padding: '20px', borderRadius: '8px',
                width: '100%', maxWidth: '400px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}>
                <h3>{isUndo ? `Undo "${title}"` : `${title} Details`}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {renderFields()}
                </div>
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button
                        onClick={() => onSave(formData)}
                        className={`btn ${isUndo ? 'btn-danger' : 'btn-primary'}`}
                        disabled={isUndo && !formData.undoCause.trim()}
                    >
                        {isUndo ? 'Confirm Undo' : 'Save Info'}
                    </button>
                </div>
            </div>
        </div>
    );
}

