/**
 * PDF Text Extraction Utility
 * Extracts text from PDF files using PDF.js in the browser
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for Vite/browser environment
// Use import.meta.url approach which works better with Vite's bundling
if (typeof window !== 'undefined') {
  try {
    // Modern ESM worker (pdfjs-dist >= 3.x)
    // Use new URL with import.meta.url - this works with Vite's module resolution
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    console.log('📄 [PDF-EXTRACT] Worker configured:', pdfjsLib.GlobalWorkerOptions.workerSrc);
  } catch (e) {
    // Fallback: try legacy worker or disable worker
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.js',
        import.meta.url
      ).toString();
      console.log('📄 [PDF-EXTRACT] Worker configured (legacy):', pdfjsLib.GlobalWorkerOptions.workerSrc);
    } catch (fallbackError) {
      console.warn('📄 [PDF-EXTRACT] Worker configuration failed, using main thread:', fallbackError);
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'data:application/javascript,';
    }
  }
}

/**
 * Timeout wrapper for promises
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Extract text from a PDF file
 * @param file - The PDF file to extract text from
 * @param onProgress - Optional callback to report extraction progress
 * @returns Extracted text with page markers
 */
export async function extractTextFromPDF(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<string> {
  console.log('📄 [PDF-EXTRACT] Extracting text from PDF:', file.name);
  console.log('📄 [PDF-EXTRACT] File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
  
  // Warn if file is very large (>10MB)
  if (file.size > 10 * 1024 * 1024) {
    console.warn('📄 [PDF-EXTRACT] Warning: Very large PDF file detected. Extraction may take longer.');
  }
  
  const arrayBuffer = await file.arrayBuffer();
  
  // Load PDF document with optimized settings for better reliability
  console.log('📄 [PDF-EXTRACT] Loading PDF document...');
  
  let pdf;
  let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
  
  try {
    loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      // Options that help certain PDFs load more reliably
      disableFontFace: true,
      useSystemFonts: true,
      verbosity: 0, // Reduce logging
    });
    
    // Add timeout to PDF loading - longer timeout for larger files
    const fileSizeMB = file.size / 1024 / 1024;
    const LOAD_TIMEOUT_MS = Math.max(30000, Math.min(120000, 30000 + (fileSizeMB * 30000))); // 30s to 120s
    console.log(`📄 [PDF-EXTRACT] Starting PDF load with ${LOAD_TIMEOUT_MS / 1000}s timeout (file: ${fileSizeMB.toFixed(2)} MB)...`);
    
    // Log progress periodically during loading
    const loadingStartTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = ((Date.now() - loadingStartTime) / 1000).toFixed(1);
      console.log(`📄 [PDF-EXTRACT] Still loading PDF... (${elapsed}s elapsed)`);
    }, 10000); // Every 10 seconds
    
    try {
      pdf = await withTimeout(
        loadingTask.promise,
        LOAD_TIMEOUT_MS,
        `PDF loading timed out after ${LOAD_TIMEOUT_MS / 1000} seconds. The PDF may be too complex for browser extraction. File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`
      );
    } finally {
      clearInterval(progressInterval);
    }
    
    console.log(`📄 [PDF-EXTRACT] PDF loaded successfully: ${pdf.numPages} pages`);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error('📄 [PDF-EXTRACT] Error loading PDF:', errorMessage);
    
    // Cleanup loading task on error
    try {
      await loadingTask?.destroy();
    } catch (cleanupError) {
      console.warn('📄 [PDF-EXTRACT] Error during cleanup:', cleanupError);
    }
    
    // Provide helpful error message
    if (errorMessage.includes('timeout')) {
      throw new Error(
        `PDF loading timed out. The file "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB) may be too complex for browser extraction. ` +
        `The server will attempt extraction instead.`
      );
    } else if (errorMessage.includes('Invalid PDF') || errorMessage.includes('format')) {
      throw new Error(
        `Invalid or corrupted PDF file: "${file.name}". Please check the file and try again.`
      );
    } else {
      throw new Error(
        `Failed to load PDF: ${errorMessage}. The server will attempt extraction instead.`
      );
    }
  }
  
  // Report initial progress with total pages
  onProgress?.(0, pdf.numPages);
  console.log(`📄 [PDF-EXTRACT] Starting extraction of ${pdf.numPages} pages...`);
  
  // Array to store page texts in order
  const pageTexts: string[] = new Array(pdf.numPages);
  
  // Helper function to extract text from a single page
  // Process sequentially with UI thread yielding for better responsiveness
  async function extractPage(pageIndex: number): Promise<void> {
    try {
      const page = await pdf.getPage(pageIndex + 1); // PDF.js uses 1-based indexing
      const textContent = await page.getTextContent({
        includeMarkedContent: true,
        disableCombineTextItems: false,
      });
      
      // Join text items preserving order
      const pageText = textContent.items
        .map((item: any) => {
          if ('str' in item && typeof item.str === 'string') {
            return item.str;
          }
          return '';
        })
        .join(' ')
        .trim();
      
      pageTexts[pageIndex] = pageText;
      
      // Free resources for this page
      try {
        page.cleanup();
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      // Report progress
      const currentPage = pageIndex + 1;
      onProgress?.(currentPage, pdf.numPages);
      
      // Log progress for every page
      const progressPercentage = Math.round((currentPage / pdf.numPages) * 100);
      console.log(`📄 [PDF-EXTRACT] Extracted page ${currentPage}/${pdf.numPages} (${progressPercentage}%)`);
      
      // Also log every 10 pages for less verbose output in console
      if (currentPage % 10 === 0 || currentPage === pdf.numPages) {
        console.log(`📄 [PDF-EXTRACT] Progress: ${currentPage}/${pdf.numPages} pages extracted (${progressPercentage}%)`);
      }
      
      // Yield to UI thread between pages to keep browser responsive
      // This is especially helpful for long PDFs
      await new Promise((resolve) => setTimeout(resolve, 0));
      
    } catch (pageError: any) {
      console.error(`📄 [PDF-EXTRACT] Error extracting page ${pageIndex + 1}:`, pageError);
      // Store empty text for failed pages
      pageTexts[pageIndex] = `[Error extracting page ${pageIndex + 1}: ${pageError?.message || 'Unknown error'}]`;
      // Still report progress to continue
      const currentPage = pageIndex + 1;
      onProgress?.(currentPage, pdf.numPages);
    }
  }
  
  // Process pages sequentially (not in batches) for better resource management
  // This approach yields to UI thread and cleans up resources properly
  console.log(`📄 [PDF-EXTRACT] Processing ${pdf.numPages} pages sequentially...`);
  
  for (let i = 0; i < pdf.numPages; i++) {
    await extractPage(i);
  }
  
  // Cleanup PDF document
  try {
    await loadingTask?.destroy();
  } catch (cleanupError) {
    console.warn('📄 [PDF-EXTRACT] Error during final cleanup:', cleanupError);
  }
  
  console.log(`📄 [PDF-EXTRACT] All pages extracted successfully`);
  
  // Combine all pages with page markers
  const fullText = pageTexts
    .map((text, index) => {
      if (text) {
        return `--- Page ${index + 1} ---\n${text}`;
      }
      return `--- Page ${index + 1} ---\n[No text content found]`;
    })
    .join('\n\n');
  
  console.log(`📄 [PDF-EXTRACT] PDF extraction complete: ${fullText.length} characters`);
  
  return fullText;
}
