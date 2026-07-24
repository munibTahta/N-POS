// src/components/common/ListSkeleton.jsx
import React from 'react';
import Skeleton from './Skeleton';

const ListSkeleton = ({
  items = 5,
  showAvatar = false,
  linesPerItem = 2
}) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="flex items-center space-x-4 p-4 bg-white rounded-lg border">
          {showAvatar && (
            <Skeleton variant="circle" className="w-10 h-10 flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton variant="title" className="w-3/4" />
            {Array.from({ length: linesPerItem - 1 }, (_, lineIndex) => (
              <Skeleton key={lineIndex} className="h-3 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ListSkeleton;