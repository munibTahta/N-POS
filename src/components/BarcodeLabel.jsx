import React from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Printable barcode label component
 * Renders a single or batch of product barcode labels in print-friendly format
 */
const BarcodeLabel = React.forwardRef(({ products = [] }, ref) => {
  // Ensure products is always an array
  const safeProducts = Array.isArray(products) ? products : [];
  
  if (safeProducts.length === 0) {
    return (
      <div ref={ref} style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <p>Tidak ada produk untuk dicetak</p>
      </div>
    );
  }

  return (
    <div 
      ref={ref}
      style={{
        padding: '10mm',
        fontFamily: 'Arial, sans-serif',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10mm',
      }}
    >
      {safeProducts.map((product, idx) => (
          <div 
            key={idx}
            style={{
              width: '80mm',
              height: '60mm',
              border: '1px solid #ccc',
              padding: '4mm',
              boxSizing: 'border-box',
              pageBreakInside: 'avoid',
              fontFamily: 'Arial, sans-serif',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2mm', maxHeight: '12mm', overflow: 'hidden' }}>
              {product.nama_produk}
            </div>
            <BarcodeBarSvg kodeProduk={product.kode_produk} />
            <div style={{ fontSize: '9px', marginTop: '1mm' }}>
              {product.kode_produk}
            </div>
            <div style={{ fontSize: '8px', fontWeight: 'bold', marginTop: '1mm' }}>
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(product.harga_jual || 0)}
            </div>
          </div>
        ))}
    </div>
  );
});

BarcodeLabel.displayName = 'BarcodeLabel';

/**
 * Barcode SVG renderer component
 */
const BarcodeBarSvg = ({ kodeProduk }) => {
  const svgRef = React.useRef(null);

  React.useEffect(() => {
    if (svgRef.current && kodeProduk) {
      try {
        JsBarcode(svgRef.current, kodeProduk, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 12,
          margin: 5,
        });
      } catch (error) {
        console.error('Error rendering barcode:', error);
      }
    }
  }, [kodeProduk]);

  return (
    <svg 
      ref={svgRef}
      style={{ 
        maxWidth: '100%', 
        maxHeight: '50px',
        display: 'flex',
        justifyContent: 'center',
        margin: '1mm 0'
      }}
    />
  );
};

export default BarcodeLabel;
