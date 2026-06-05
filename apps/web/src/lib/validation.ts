export type ColumnDiff = {
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
};

export type RowCountDiff = {
  expected: number;
  actual: number;
};

export type DataDiff = {
  missingRows: Record<string, unknown>[];
  extraRows: Record<string, unknown>[];
};

export type ResultDiff = {
  columnDiff?: ColumnDiff;
  rowCountDiff?: RowCountDiff;
  dataDiff?: DataDiff;
  sqlError?: string;
  verificationLabel?: string;
};
