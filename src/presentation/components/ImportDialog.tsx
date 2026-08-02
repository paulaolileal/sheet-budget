import { useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { parseCsvFile } from "@/lib/csvParser";
import { downloadImportTemplate } from "@/lib/importTemplates";
import {
  IMPORT_COLUMNS,
  IMPORT_KIND_LABELS,
  IMPORT_KINDS,
  IMPORT_ROW_SCHEMAS,
  type ImportKind,
} from "@/domain/importSchemas";
import { useImportRows } from "@/hooks/queries";

interface RowResult {
  raw: Record<string, string>;
  data?: Record<string, unknown>;
  error?: string;
}

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<ImportKind>("transacoes");
  const [rows, setRows] = useState<RowResult[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const importRows = useImportRows();

  function reset() {
    setRows(null);
    setFileName(null);
  }

  function handleKindChange(value: string) {
    setKind(value as ImportKind);
    reset();
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);

    const rawRows = await parseCsvFile(file);
    const schema = IMPORT_ROW_SCHEMAS[kind];
    setRows(
      rawRows.map((raw) => {
        const parsed = schema.safeParse(raw);
        return parsed.success
          ? { raw, data: parsed.data as Record<string, unknown> }
          : { raw, error: parsed.error.issues.map((issue) => issue.message).join("; ") };
      }),
    );
  }

  const validRows = rows?.filter((r) => r.data) ?? [];
  const invalidCount = (rows?.length ?? 0) - validRows.length;

  async function handleConfirm() {
    if (validRows.length === 0) return;
    await importRows.mutateAsync({
      kind,
      rows: validRows.map((r) => r.data),
    } as Parameters<typeof importRows.mutateAsync>[0]);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar planilha</DialogTitle>
          <DialogDescription>
            Importe dados de um arquivo CSV formatado conforme o modelo do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Tipo de dado</Label>
            <Select value={kind} onValueChange={handleKindChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {IMPORT_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 px-0 -mt-2"
            onClick={() => downloadImportTemplate(kind)}
          >
            <Download className="h-3.5 w-3.5" />
            Baixar modelo CSV
          </Button>

          <div>
            <Label className="mb-1.5 block">Arquivo CSV</Label>
            <Input type="file" accept=".csv" onChange={handleFile} />
            {fileName && <p className="text-xs text-muted-foreground mt-1">{fileName}</p>}
          </div>

          {rows && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{validRows.length} válida(s)</Badge>
                {invalidCount > 0 && <Badge variant="destructive">{invalidCount} com erro</Badge>}
              </div>
              <div className="max-h-64 overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {IMPORT_COLUMNS[kind].map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                      <TableHead>status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        {IMPORT_COLUMNS[kind].map((col) => (
                          <TableCell key={col} className="text-xs">
                            {r.raw[col] ?? ""}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs">
                          {r.error ? (
                            <span title={r.error} className="text-destructive">
                              erro
                            </span>
                          ) : (
                            <span className="text-emerald-600">válido</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={validRows.length === 0 || importRows.isPending}
            onClick={handleConfirm}
          >
            {importRows.isPending
              ? "Importando..."
              : `Importar${validRows.length ? ` (${validRows.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
