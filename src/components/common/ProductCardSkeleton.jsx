// src/components/common/ProductCardSkeleton.jsx
import React from 'react';
import Skeleton from './Skeleton';

const ProductCardSkeleton = () => {
  return (
    <div className="border rounded-lg p-3 bg-white">
      {/* Image skeleton */}
      <Skeleton className="aspect-square w-full mb-2" />

      {/* Title skeleton */}
      <Skeleton variant="title" className="w-3/4 mb-2" />

      {/* Price and stock skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="w-16 h-5" />
        <Skeleton className="w-12 h-4" />
      </div>
    </div>
  );
};

export default ProductCardSkeleton;