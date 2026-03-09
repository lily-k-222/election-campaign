import React from 'react';

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    ...props
}) => {
    const baseClass = 'btn';
    const variantClass = variant === 'primary' ? 'btn-primary'
        : variant === 'outline' ? 'btn-outline'
            : variant === 'danger' ? 'btn-danger'
                : '';

    const sizeClass = size === 'sm' ? 'text-sm p-2 py-1'
        : size === 'lg' ? 'text-lg p-4 py-3'
            : '';

    return (
        <button
            className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
