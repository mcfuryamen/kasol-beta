export type PaperSize = "58mm" | "80mm" | "a4";
export type ConnectionType = "usb" | "bluetooth" | "network";
export type PrintJobStatus = "pending" | "printing" | "done" | "error";

export interface PrinterConfig {
  enabled: boolean;
  paperSize: PaperSize;
  connectionType: ConnectionType;
  ipAddress?: string;
  autoPrint: boolean;
  copies: number;
  headerText: string;
  footerText: string;
  printBarcode: boolean;
}

export interface PrintJob {
  id: string;
  type: "receipt" | "label" | "report" | "test";
  status: PrintJobStatus;
  content: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}
