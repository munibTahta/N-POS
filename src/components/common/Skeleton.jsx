// src/components/common/Skeleton.jsx
import React from 'react';

const Skeleton = ({
  className = '',
  variant = 'rectangle',
  width,
  height,
  rounded = true
}) => {
  const baseClasses = 'animate-pulse bg-gray-200';

  const variantClasses = {
    rectangle: rounded ? 'rounded' : '',
    circle: 'rounded-full',
    text: 'rounded h-4',
    title: 'rounded h-6',
    avatar: 'rounded-full'
  };

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

export default Skeleton;