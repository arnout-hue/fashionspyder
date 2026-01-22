import * as XLSX from 'xlsx';
import { Product } from '@/data/mockData';

interface ExportProduct extends Product {
  supplier_name?: string;
}

function escapeCSV(value: string | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCSV(products: ExportProduct[], filename: string = 'products') {
  const headers = [
    'Name',
    'Price',
    'Competitor',
    'Status',
    'Supplier',
    'Product URL',
    'Image URL',
    'Notes',
    'SKU',
    'Added Date',
  ];

  const rows = products.map((p) => [
    escapeCSV(p.name),
    escapeCSV(p.price !== null && p.price !== undefined ? String(p.price) : ''),
    escapeCSV(p.competitor),
    escapeCSV(p.status),
    escapeCSV(p.supplier_name),
    escapeCSV(p.product_url),
    escapeCSV(p.image_url),
    escapeCSV(p.notes),
    escapeCSV(p.sku),
    new Date(p.created_at).toLocaleDateString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

export function exportToExcel(products: ExportProduct[], filename: string = 'products') {
  const data = products.map((p) => ({
    Name: p.name,
    Price: p.price || '',
    Competitor: p.competitor,
    Status: p.status,
    Supplier: p.supplier_name || '',
    'Product URL': p.product_url,
    'Image URL': p.image_url || '',
    Notes: p.notes || '',
    SKU: p.sku || '',
    'Added Date': new Date(p.created_at).toLocaleDateString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  const columnWidths = [
    { wch: 40 }, // Name
    { wch: 12 }, // Price
    { wch: 20 }, // Competitor
    { wch: 10 }, // Status
    { wch: 20 }, // Supplier
    { wch: 50 }, // Product URL
    { wch: 50 }, // Image URL
    { wch: 30 }, // Notes
    { wch: 15 }, // SKU
    { wch: 12 }, // Added Date
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadFile(excelBuffer, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// Helper to add supplier names to products for export
export function enrichProductsForExport(
  products: Product[],
  suppliers: { id: string; name: string }[]
): ExportProduct[] {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  return products.map((p) => ({
    ...p,
    supplier_name: p.supplier_id ? supplierMap.get(p.supplier_id) : undefined,
  }));
}
