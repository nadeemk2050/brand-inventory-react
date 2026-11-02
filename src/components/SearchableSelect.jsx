import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown, FaSearch, FaHistory, FaPlus } from "react-icons/fa";

export default function SearchableSelect({ options, value, onChange, placeholder = "Select Item", storageKey, onAddNew, addNewLabel = "New (Ctrl+C)" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [recentIds, setRecentIds] = useState([]);
    const searchInputRef = useRef(null);

    // Get selected item name
    const selectedItem = options.find(opt => opt.id === value);

    // Load Recents
    useEffect(() => {
        if (storageKey) {
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // Deduplicate
                    const unique = [...new Set(parsed)];
                    setRecentIds(unique);
                }
            } catch (e) {
                console.error("Failed to load recent items", e);
            }
        }
    }, [storageKey]);

    // Save Recent
    function addToRecent(id) {
        if (!storageKey) return;

        let newRecent = [id, ...recentIds.filter(rid => rid !== id)];
        if (newRecent.length > 20) {
            newRecent = newRecent.slice(0, 20);
        }
        setRecentIds(newRecent);
        localStorage.setItem(storageKey, JSON.stringify(newRecent));
    }

    // derived lists
    const recentItems = recentIds.map(id => options.find(opt => opt.id === id)).filter(Boolean);

    // Filter Logic
    const filteredOptions = options.filter(opt => {
        if (!searchTerm) return true;
        const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        const nameLower = opt.name.toLowerCase();
        return terms.every(term => nameLower.includes(term));
    });

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            // Small timeout to ensure render
            setTimeout(() => searchInputRef.current.focus(), 50);
        }
        if (!isOpen) {
            setSearchTerm(""); // Reset search on close
        }
    }, [isOpen]);

    // Handle Keyboard Events
    useEffect(() => {
        function handleKeyDown(e) {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                setIsOpen(false);
                return;
            }

            // Ctrl+C to Add New (Only if onAddNew is provided)
            if (onAddNew && (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault(); // Prevent copy
                onAddNew(searchTerm);
                return;
            }
        }

        // We attach to window to catch it globally when modal is open
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onAddNew]);

    function handleSelect(id) {
        onChange(id);
        addToRecent(id);
        setIsOpen(false);
        setSearchTerm("");
    }

    const renderOption = (opt, isRecent = false) => (
        <div
            key={`${isRecent ? 'recent-' : ''}${opt.id}`}
            onClick={() => handleSelect(opt.id)}
            style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: value === opt.id ? '#eff6ff' : 'transparent',
                color: value === opt.id ? '#1d4ed8' : '#374151',
                display: 'flex',
                justifyContent: 'space-between',
                transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => {
                if (value !== opt.id) e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
            onMouseLeave={(e) => {
                if (value !== opt.id) e.currentTarget.style.backgroundColor = 'transparent';
            }}
        >
            <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isRecent && <FaHistory size={12} color="#9ca3af" />}
                {opt.name}
            </span>
            {opt.stock !== undefined && (
                <span style={{ fontSize: '0.9em', color: opt.stock > 0 ? '#10b981' : '#ef4444' }}>
                    {opt.stock} in stock
                </span>
            )}
        </div>
    );

    const dropdownContent = (
        <div
            className="searchable-select-overlay"
            onMouseDown={() => setIsOpen(false)} // Close on backdrop click
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                zIndex: 99999,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start', // Align to top
                paddingTop: '8vh', // Spacer from top
                backdropFilter: 'blur(2px)'
            }}
        >
            <div
                className="searchable-select-modal"
                onMouseDown={(e) => e.stopPropagation()} // Prevent close on content click
                style={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    width: '90%',
                    maxWidth: '600px',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideDown 0.2s ease-out'
                }}
            >
                {/* Search Header */}
                <div style={{
                    padding: '16px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backgroundColor: '#fdfdfd'
                }}>
                    <FaSearch color="#9ca3af" size={18} />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            border: 'none',
                            outline: 'none',
                            fontSize: '1.1rem',
                            flex: 1,
                            background: 'transparent',
                            color: '#374151'
                        }}
                    />
                    {onAddNew && (
                        <button
                            type="button"
                            onClick={() => onAddNew(searchTerm)}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: '#e0e7ff',
                                color: '#3730a3',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap'
                            }}
                            title="Add New Item (Ctrl+C)"
                        >
                            <FaPlus size={10} /> {addNewLabel}
                        </button>
                    )}

                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.2rem',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                padding: '0 5px'
                            }}
                        >
                            &times;
                        </button>
                    )}
                </div>

                {/* Results List */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '0' }}>
                    {/* Recent Items Section */}
                    {(!searchTerm && recentItems.length > 0) && (
                        <>
                            <div style={{
                                padding: '8px 16px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                color: '#9ca3af',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                backgroundColor: '#f9fafb'
                            }}>
                                Recent Items
                            </div>
                            {recentItems.map(opt => renderOption(opt, true))}
                            <div style={{
                                padding: '8px 16px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                color: '#9ca3af',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                backgroundColor: '#f9fafb',
                                borderTop: '1px solid #eee'
                            }}>
                                All Products
                            </div>
                        </>
                    )}

                    {/* Filtered/All options */}
                    {filteredOptions.length > 0 ? (
                        filteredOptions
                            // Note: We show ALL products here even if they are in recents, 
                            // to ensure standard alphabetical sorting or order is preserved if needed.
                            // If user preferred to hide recents from this list, we could filter.
                            // However, filtering them out might confuse if looking for them alphabetically.
                            // Let's filter them out ONLY if we are showing the Recents section (i.e., no search term).
                            .filter(opt => !searchTerm && recentItems.some(r => r.id === opt.id) ? false : true)
                            .map(opt => renderOption(opt, false))
                    ) : (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                            We couldn't find anything matching "{searchTerm}"
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '10px 16px',
                    backgroundColor: '#f9fafb',
                    borderTop: '1px solid #eee',
                    fontSize: '0.85rem',
                    color: '#6b7280',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}>
                    <span>{filteredOptions.length} results</span>
                    <span>Press <b>ESC</b> to close{onAddNew ? `, Ctrl+C to Add New` : ''}</span>
                </div>
            </div>
            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );

    return (
        <div className="searchable-select-container" style={{ position: 'relative', width: '100%' }}>
            {/* The Trigger Button */}
            <div
                className="searchable-select-trigger"
                onClick={() => setIsOpen(true)}
                style={{
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '42px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'border-color 0.2s',
                    color: selectedItem ? '#111' : '#6b7280'
                }}
            >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%' }}>
                    {selectedItem ? selectedItem.name : placeholder}
                </span>
                <FaChevronDown size={12} color="#6b7280" />
            </div>

            {/* Render Portal when Open */}
            {isOpen && createPortal(dropdownContent, document.body)}
        </div>
    );
}
