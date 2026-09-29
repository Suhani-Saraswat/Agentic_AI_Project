import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { DatasetProfile, UploadResponse } from '../types';

interface DatasetUploadProps {
  onDatasetUploaded: (profile: DatasetProfile) => void;
  currentDataset: DatasetProfile | null;
}

export const DatasetUpload: React.FC<DatasetUploadProps> = ({ onDatasetUploaded, currentDataset }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data: UploadResponse = await response.json();
      onDatasetUploaded(data.profile);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error uploading dataset. Please check format.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  const loadSampleDataset = async () => {
    setIsUploading(true);
    setErrorMessage(null);
    try {
      // Create a Blob from sample CSV data for instant testing
      const sampleCsvContent = `order_id,order_date,region,product_category,customer_segment,sales_amount,discount_rate,profit,units_sold,customer_rating
ORD-1001,2024-01-05,North America,Electronics,Corporate,1250.50,0.05,312.60,2,4.8
ORD-1002,2024-01-07,Europe,Furniture,Consumer,480.00,0.15,72.00,1,3.9
ORD-1003,2024-01-10,Asia Pacific,Office Supplies,Small Business,150.25,0.00,45.00,5,4.5
ORD-1004,2024-01-12,North America,Technology,Corporate,2800.00,0.10,700.00,4,4.9
ORD-1005,2024-01-15,Latin America,Furniture,Consumer,320.00,0.20,16.00,2,3.2
ORD-1006,2024-01-18,Europe,Electronics,Corporate,1890.75,0.05,472.50,3,4.7
ORD-1007,2024-01-20,North America,Office Supplies,Consumer,85.50,0.00,28.20,3,4.1
ORD-1008,2024-01-22,Asia Pacific,Technology,Small Business,3400.00,0.15,850.00,5,5.0
ORD-1009,2024-01-25,Europe,Office Supplies,Corporate,210.00,0.05,63.00,4,4.0
ORD-1010,2024-01-28,North America,Furniture,Small Business,950.00,0.10,142.50,2,3.8
ORD-1011,2024-02-02,Asia Pacific,Electronics,Consumer,780.00,0.08,156.00,1,4.3
ORD-1012,2024-02-05,Latin America,Technology,Corporate,1950.00,0.12,390.00,2,4.4
ORD-1013,2024-02-08,Europe,Furniture,Corporate,1120.00,0.05,224.00,3,4.2
ORD-1014,2024-02-12,North America,Technology,Consumer,4200.00,0.15,1050.00,6,4.9
ORD-1015,2024-02-15,Asia Pacific,Office Supplies,Consumer,120.00,0.00,36.00,2,4.0
ORD-1016,2024-02-18,North America,Electronics,Small Business,1450.00,0.10,290.00,2,4.6
ORD-1017,2024-02-22,Europe,Technology,Corporate,3100.00,0.08,775.00,4,4.8
ORD-1018,2024-02-25,Latin America,Office Supplies,Small Business,95.00,0.00,28.50,3,3.7
ORD-1019,2024-02-28,North America,Furniture,Consumer,650.00,0.15,65.00,1,3.5
ORD-1020,2024-03-02,Asia Pacific,Electronics,Corporate,2200.00,0.05,550.00,3,4.7`;

      const file = new File([sampleCsvContent], "sales_performance_2024.csv", { type: "text/csv" });
      await handleUpload(file);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading sample dataset');
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition-all duration-300">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.json,.sqlite,.db"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-purple-400" />
            Dataset Source
          </h2>
          <p className="text-xs text-slate-400">
            Upload CSV, Excel, JSON, or SQLite to auto-generate schema & profile
          </p>
        </div>

        <button
          onClick={loadSampleDataset}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Load Demo Sales Dataset
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-purple-500 bg-purple-500/10 scale-[0.99]'
            : currentDataset
            ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
            : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-3">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
            <p className="text-sm font-medium text-purple-300">Profiling dataset & computing statistics...</p>
            <p className="text-xs text-slate-500 mt-1">Analyzing columns, missing ratios, and numeric distributions</p>
          </div>
        ) : currentDataset ? (
          <div className="flex items-center justify-center gap-4 py-1">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-100">{currentDataset.filename}</p>
              <p className="text-xs text-slate-400">
                {currentDataset.row_count.toLocaleString()} rows • {currentDataset.column_count} columns • {currentDataset.memory_usage_kb} KB
              </p>
            </div>
            <span className="ml-auto text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700">
              Replace File
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-200">
              Click to browse or drop your dataset here
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports .csv, .xlsx, .json, .sqlite up to 50MB
            </p>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
