// Type declarations for exceljs to bypass TypeScript issues
declare module 'exceljs' {
  export interface Workbook {
    addWorksheet(name: string): Worksheet;
    xlsx: {
      writeBuffer(): Promise<ArrayBuffer>;
    };
  }

  export interface Worksheet {
    addRows(rows: any[][]): void;
    columns: Column[];
  }

  export interface Column {
    width?: number;
    values?: any[];
  }

  export class Workbook {
    constructor();
    addWorksheet(name: string): Worksheet;
    get xlsx(): { writeBuffer(): Promise<ArrayBuffer> };
  }
}