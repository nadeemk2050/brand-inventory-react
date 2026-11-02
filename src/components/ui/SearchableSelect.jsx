import { useState, useRef, useEffect } from "react";

export default function SearchableSelect({ options, value, onChange, placeholder = "Select Product", label }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="form-group" style={{ flex: 1 }} ref={containerRef}>
            {label && <label>{label}</label>}
            <div className="custom-select-wrapper" style={{ position: 'relative' }}>
                <input
                    type="text"
                    className="custom-search-input"
                    placeholder={placeholder}
                    value={isOpen ? searchTerm : (selectedOption ? selectedOption.label : "")}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => {
                        setSearchTerm("");
                        setIsOpen(true);
                    }}
                />
                {isOpen && (
                    <div className="custom-options" style={{ display: 'block' }}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <div key={option.value} className="custom-option" onClick={() => {
                                    onChange(option.value);
                                    setSearchTerm("");
                                    setIsOpen(false);
                                }}>
                                    {option.label}
                                </div>
                            ))
                        ) : (
                            <div className="custom-option" style={{ color: '#999' }}>No options found</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
