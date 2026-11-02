import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useMessageBox } from "../context/MessageBoxContext";
import { useData } from "../context/DataContext";
import { FiMenu, FiHome, FiLogOut, FiLogIn, FiDownload, FiSearch, FiX } from "react-icons/fi";
import { FaBoxOpen, FaBook, FaFileInvoice, FaDatabase, FaChartBar, FaFilePdf, FaFileExcel, FaArrowLeft, FaSortAmountDown, FaUsers, FaHistory, FaUserCircle } from "react-icons/fa";

export default function Header({
    activeView,
    onBack,
    onOpenAuth,
    onOpenProfile,
    onOpenManageProducts,
    onOpenProductLedger,
    onOpenManageTeam,
    onOpenLogHistory,

    onOpenAllInvoices,
    onOpenPurchaseRegister,
    onOpenSalesRegister,
    onOpenStatistics,

    // Inventory Props
    showSearch,
    isSearchOpen,
    searchTerm,
    onSearchToggle,
    onSearchChange,
    onDownloadPDF,
    onDownloadExcel,

    // Invoices Props
    isInvoiceSearchOpen,
    invoiceSearchTerm,
    onInvoiceSearchToggle,
    onInvoiceSearchChange,
    invoiceSortOption,
    onInvoiceSortChange
}) {
    const { currentUser, userProfile, logout } = useAuth();
    const { showMessageBox } = useMessageBox();
    const { products, purchaseInvoices, salesVouchers } = useData();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const sortDropdownRef = useRef(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
                setIsSortDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef, sortDropdownRef]);

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(display-mode: standalone)');
        setIsStandalone(mq.matches);

        const changeHandler = (e) => setIsStandalone(e.matches);
        if (mq.addEventListener) {
            mq.addEventListener('change', changeHandler);
        } else {
            mq.addListener(changeHandler);
        }

        return () => {
            if (mq.removeEventListener) {
                mq.removeEventListener('change', changeHandler);
            } else {
                mq.removeListener(changeHandler);
            }
        };
    }, []);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    async function handleInstallClick() {
        if (!deferredPrompt) {
            showMessageBox("Install Instructions", "To install this app:\n1. Open your browser menu (⋮ or Share icon).\n2. Select 'Add to Home Screen' or 'Install App'.");
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setDeferredPrompt(null);
    }

    function handleDropdownToggle() {
        setIsDropdownOpen(!isDropdownOpen);
    }

    function handleBackup() {
        if (!currentUser) return showMessageBox("Auth Required", "Please login to backup data.");

        const backupData = {
            timestamp: new Date().toISOString(),
            appId: "brandsinvent",
            user: currentUser.email,
            data: {
                products: products || [],
                purchaseInvoices: purchaseInvoices || [],
                salesVouchers: salesVouchers || []
            }
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        link.download = `brandsinvent_backup_${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsDropdownOpen(false);
        showMessageBox("Success", "Backup file downloaded.");
    }

    // Determine current user display name
    const isOwner = userProfile?.isOwner;
    const profileDisplayName = (userProfile?.name && userProfile.name.trim() !== "")
        ? userProfile.name
        : (isOwner ? "Owner" : "User");

    return (
        <header className="modern-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div className="menu-container" ref={dropdownRef}>
                    <button
                        className={`menu-toggle-btn ${isDropdownOpen ? 'active' : ''}`}
                        aria-label="Options Menu"
                        onClick={handleDropdownToggle}
                    >
                        <FiMenu size={24} />
                    </button>

                    <div className={`modern-dropdown-menu ${isDropdownOpen ? 'show' : ''}`}>
                        <div className="dropdown-header">
                            <span>Menu</span>
                        </div>

                        {currentUser && (
                            <div
                                onClick={() => {
                                    if (onOpenProfile) onOpenProfile();
                                    setIsDropdownOpen(false);
                                }}
                                style={{
                                    padding: '10px 14px',
                                    fontSize: '0.85em',
                                    backgroundColor: '#f1f8e9',
                                    marginBottom: '6px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    border: '1px solid #c8e6c9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'background 0.2s'
                                }}
                                title="Click to view & edit Profile / Change Password"
                            >
                                <div>
                                    <div style={{ fontWeight: 'bold', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {profileDisplayName}
                                        <span style={{
                                            fontSize: '0.7em',
                                            backgroundColor: isOwner ? '#e65100' : '#1565c0',
                                            color: '#fff',
                                            padding: '1px 5px',
                                            borderRadius: '8px'
                                        }}>
                                            {userProfile?.role || (isOwner ? "Owner" : "User")}
                                        </span>
                                    </div>
                                    <div style={{ color: '#555', fontSize: '0.82em', marginTop: '2px' }}>{currentUser.email}</div>
                                </div>
                                <FaUserCircle size={20} color="#2e7d32" />
                            </div>
                        )}

                        <button onClick={() => {
                            if (currentUser && onOpenProfile) onOpenProfile();
                            else onOpenAuth();
                            setIsDropdownOpen(false);
                        }}>
                            <FaUserCircle className="menu-icon" /> My Profile & Security
                        </button>

                        <button onClick={() => { if (currentUser) onOpenManageProducts(); else showMessageBox("Auth Required", "Please login."); setIsDropdownOpen(false); }}>
                            <FaBoxOpen className="menu-icon" /> Manage Products
                        </button>
                        <button onClick={() => { if (currentUser) onOpenProductLedger(); else showMessageBox("Auth Required", "Please login."); setIsDropdownOpen(false); }}>
                            <FaBook className="menu-icon" /> Product Ledgers
                        </button>
                        <button onClick={() => { if (currentUser) onOpenManageTeam(); else showMessageBox("Auth Required", "Please login."); setIsDropdownOpen(false); }}>
                            <FaUsers className="menu-icon" /> Manage Team / Users
                        </button>
                        <button onClick={() => { if (currentUser) onOpenLogHistory(); else showMessageBox("Auth Required", "Please login."); setIsDropdownOpen(false); }}>
                            <FaHistory className="menu-icon" /> Log History
                        </button>
                        <button onClick={() => { if (currentUser) onOpenAllInvoices(); else showMessageBox("Auth Required", "Please login."); setIsDropdownOpen(false); }}>
                            <FaFileInvoice className="menu-icon" /> All Invoice Details
                        </button>
                        <button onClick={() => { if (currentUser) onOpenPurchaseRegister(); else showMessageBox("Auth Required", "Please login."); setIsDropdownOpen(false); }}>
                            <FaFileInvoice className="menu-icon" /> Purchase Register
                        </button>
                        <button onClick={() => { if (currentUser) onOpenSalesRegister(); else showMessageBox("Auth Required", "Please login."); setIsDropdownOpen(false); }}>
                            <FaFileInvoice className="menu-icon" /> Sales Register
                        </button>
                        <button onClick={() => { if (currentUser) onOpenStatistics(); else showMessageBox("Auth Required", "Please login."); setIsDropdownOpen(false); }}>
                            <FaChartBar className="menu-icon" /> Statistics
                        </button>
                        <div className="dropdown-divider"></div>
                        <button onClick={handleBackup}>
                            <FaDatabase className="menu-icon" /> Backup Data
                        </button>

                        <div className="dropdown-divider"></div>

                        <button onClick={() => { if (currentUser) logout(); else onOpenAuth(); setIsDropdownOpen(false); }}>
                            {currentUser ? <><FiLogOut className="menu-icon" /> Logout</> : <><FiLogIn className="menu-icon" /> Login</>}
                        </button>
                    </div>
                </div>

                {/* APP NAME AND USER PROFILE BADGE UNDER IT */}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1', marginLeft: '6px' }}>
                    <span style={{
                        fontFamily: "'Times New Roman', serif",
                        fontWeight: 'bold',
                        fontStyle: 'italic',
                        fontSize: '1.45rem',
                        textTransform: 'uppercase',
                        background: 'linear-gradient(to right, #d32f2f, #f57f17)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '1px',
                        filter: 'drop-shadow(1px 1px 0px rgba(0,0,0,0.1))'
                    }}>
                        Nadstockapp
                    </span>

                    {/* SUB-LINE: VERSION + USER PROFILE BADGE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span style={{ fontSize: '0.65rem', color: '#546e7a', fontWeight: 'bold', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                            v2.1
                        </span>

                        {currentUser ? (
                            <button
                                onClick={onOpenProfile}
                                title="Click to view & edit Profile Details or Change Password"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backgroundColor: isOwner ? '#fff8e1' : '#e8f0fe',
                                    color: isOwner ? '#b78103' : '#1565c0',
                                    border: isOwner ? '1px solid #ffe082' : '1px solid #90caf9',
                                    borderRadius: '12px',
                                    padding: '2px 8px',
                                    fontSize: '0.72rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    lineHeight: '1.2',
                                    maxWidth: '140px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                                }}
                            >
                                <FaUserCircle size={12} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {profileDisplayName}
                                </span>
                            </button>
                        ) : (
                            <button
                                onClick={onOpenAuth}
                                title="Click to Login"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    backgroundColor: '#eceff1',
                                    color: '#455a64',
                                    border: '1px solid #cfd8dc',
                                    borderRadius: '12px',
                                    padding: '2px 7px',
                                    fontSize: '0.68rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    lineHeight: '1.2'
                                }}
                            >
                                <FaUserCircle size={11} />
                                <span>Login</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="header-center">
                {activeView === 'inventory' ? (
                    <>
                        <button className="nav-btn home-btn" onClick={() => window.location.reload()}>
                            <FiHome size={18} /> <span>Home</span>
                        </button>
                        {!isStandalone && (
                            <button className="nav-btn install-btn" onClick={handleInstallClick} style={{ marginLeft: '10px', backgroundColor: '#e2e8f0' }}>
                                <FiDownload size={18} /> <span>Install App</span>
                            </button>
                        )}
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            className="nav-btn"
                            onClick={onBack}
                            style={{ padding: '8px', borderRadius: '50%', minWidth: 'auto' }}
                            title="Back"
                        >
                            <FaArrowLeft size={18} />
                        </button>
                        <span style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#333' }}>
                            {activeView === 'invoices' ? 'All Invoices' :
                                activeView === 'sales-on-demand' ? 'Sales on Demand' : 'Details'}
                        </span>
                    </div>
                )}
            </div>

            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {showSearch && activeView === 'inventory' && (
                    <>
                        {/* Inventory Search Input */}
                        <div style={{
                            width: isSearchOpen ? '200px' : '0px',
                            overflow: 'hidden',
                            transition: 'width 0.3s ease',
                            display: 'flex'
                        }}>
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={onSearchChange}
                                className="search-input-styled"
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '20px',
                                    border: '1px solid #ddd',
                                    outline: 'none',
                                    fontSize: '0.9em'
                                }}
                            />
                        </div>

                        <button className="btn-icon" onClick={onSearchToggle} title="Toggle Search">
                            {isSearchOpen ? <FiX size={20} /> : <FiSearch size={20} />}
                        </button>

                        <button className="btn-icon" onClick={onDownloadPDF} title="Download PDF">
                            <FaFilePdf size={20} color="#e53e3e" />
                        </button>

                        <button className="btn-icon" onClick={onDownloadExcel} title="Download Excel">
                            <FaFileExcel size={20} color="#2f855a" />
                        </button>
                    </>
                )}

                {activeView === 'invoices' && (
                    <>
                        {/* Invoices Search Input */}
                        <div style={{
                            width: isInvoiceSearchOpen ? '200px' : '0px',
                            overflow: 'hidden',
                            transition: 'width 0.3s ease',
                            display: 'flex'
                        }}>
                            <input
                                type="text"
                                placeholder="Search invoices..."
                                value={invoiceSearchTerm}
                                onChange={onInvoiceSearchChange}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '20px',
                                    border: '1px solid #ddd',
                                    outline: 'none',
                                    fontSize: '0.9em'
                                }}
                            />
                        </div>

                        <button className="btn-icon" onClick={onInvoiceSearchToggle} title="Toggle Search">
                            {isInvoiceSearchOpen ? <FiX size={20} /> : <FiSearch size={20} />}
                        </button>

                        <div style={{ position: 'relative' }} ref={sortDropdownRef}>
                            <button className="btn-icon" onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)} title="Sort Invoices">
                                <FaSortAmountDown size={20} color="#555" />
                            </button>
                            {isSortDropdownOpen && (
                                <div className="modern-dropdown-menu show" style={{
                                    right: 0,
                                    left: 'auto',
                                    width: '200px',
                                    marginTop: '10px'
                                }}>
                                    <div className="dropdown-header">Sort By</div>
                                    <button onClick={() => { onInvoiceSortChange('dateDesc'); setIsSortDropdownOpen(false); }}>Date (Newest)</button>
                                    <button onClick={() => { onInvoiceSortChange('dateAsc'); setIsSortDropdownOpen(false); }}>Date (Oldest)</button>
                                    <button onClick={() => { onInvoiceSortChange('refOrBuyerAsc'); setIsSortDropdownOpen(false); }}>Buyer/Ref (A-Z)</button>
                                    <button onClick={() => { onInvoiceSortChange('refOrBuyerDesc'); setIsSortDropdownOpen(false); }}>Buyer/Ref (Z-A)</button>
                                    <button onClick={() => { onInvoiceSortChange('totalQuantityDesc'); setIsSortDropdownOpen(false); }}>Qty (High-Low)</button>
                                    <button onClick={() => { onInvoiceSortChange('totalQuantityAsc'); setIsSortDropdownOpen(false); }}>Qty (Low-High)</button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </header>
    );
}
