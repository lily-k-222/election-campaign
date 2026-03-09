import React from 'react';

export const Badge = ({ children, variant = 'info', className = '' }) => {
    const baseStyle = {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600'
    };

    const variants = {
        info: { backgroundColor: 'var(--color-primary-light)', color: 'white' },
        success: { backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' },
        warning: { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--color-warning)' },
        error: { backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)' },
        default: { backgroundColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
    };

    const currentStyle = variants[variant] || variants.default;

    return (
        <span
            className={`badge ${className}`}
            style={{ ...baseStyle, ...currentStyle }}
        >
            {children}
        </span>
    );
};
