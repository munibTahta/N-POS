// src/components/common/TableSkeleton.jsx
import React from 'react';
import Skeleton from './Skeleton';

const TableSkeleton = ({
  rows = 5,
  columns = 4,
  showHeader = true
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border">
        {showHeader && (
          <thead className="bg-gray-200">
            <tr>
              {Array.from({ length: columns }, (_, index) => (
                <th key={index} className="py-2 px-4 border-b">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {Array.from({ length: columns }, (_, colIndex) => (
                <td key={colIndex} className="py-2 px-4 border-b">
                  <Skeleton className="h-4 w-full max-w-32" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableSkeleton;