import React from 'react';

export const Card = ({ children, className = '', ...props }) => {
    return (
        <div className={`glass-panel p-6 ${className}`} {...props}>
            {children}
        </div>
    );
};
